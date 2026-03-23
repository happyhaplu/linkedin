package service

import (
	"errors"
	"fmt"
	"log"
	"net"
	"time"

	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"github.com/reach/backend/internal/repository"
)

// ProxyService contains business logic for proxy management.
type ProxyService struct {
	repo *repository.ProxyRepository
}

// NewProxyService creates a new service instance.
func NewProxyService(repo *repository.ProxyRepository) *ProxyService {
	return &ProxyService{repo: repo}
}

// ── Request / Response types ────────────────────────────────────────────────

// CreateProxyRequest is the payload for creating a proxy.
type CreateProxyRequest struct {
	Name     string `json:"name" validate:"required"`
	Type     string `json:"type" validate:"required,oneof=http https socks4 socks5"`
	Host     string `json:"host" validate:"required"`
	Port     int    `json:"port" validate:"required,min=1,max=65535"`
	Username string `json:"username,omitempty"`
	Password string `json:"password,omitempty"`
}

// UpdateProxyRequest is the payload for updating a proxy.
type UpdateProxyRequest struct {
	Name     *string `json:"name,omitempty"`
	Type     *string `json:"type,omitempty"`
	Host     *string `json:"host,omitempty"`
	Port     *int    `json:"port,omitempty"`
	Username *string `json:"username,omitempty"`
	Password *string `json:"password,omitempty"`
	IsActive *bool   `json:"is_active,omitempty"`
}

// ── Service methods ─────────────────────────────────────────────────────────

// GetAll returns all proxies for a user.
func (s *ProxyService) GetAll(userID uuid.UUID) ([]models.Proxy, error) {
	return s.repo.FindAllByUser(userID)
}

// GetByID returns a proxy by ID scoped to a user.
func (s *ProxyService) GetByID(id, userID uuid.UUID) (*models.Proxy, error) {
	return s.repo.FindByIDAndUser(id, userID)
}

// Create creates a new proxy.
func (s *ProxyService) Create(userID uuid.UUID, req CreateProxyRequest) (*models.Proxy, error) {
	// Validate proxy configuration (IP/domain regex + port range — matches TS validateProxyConfig)
	if req.Host == "" {
		return nil, errors.New("host is required")
	}
	validation := ValidateProxyConfig(req.Host, req.Port)
	if !validation.Valid {
		return nil, errors.New(validation.Error)
	}

	proxy := &models.Proxy{
		UserID:     userID,
		Name:       req.Name,
		Type:       models.ProxyType(req.Type),
		Host:       req.Host,
		Port:       req.Port,
		IsActive:   true,
		TestStatus: models.TestStatusNotTested,
	}

	if req.Username != "" {
		proxy.Username = &req.Username
	}

	// Encrypt password if provided
	if req.Password != "" {
		encrypted, err := EncryptData(req.Password)
		if err != nil {
			return nil, fmt.Errorf("encrypt password: %w", err)
		}
		proxy.PasswordEncrypted = &encrypted
	}

	if err := s.repo.Create(proxy); err != nil {
		return nil, err
	}
	return proxy, nil
}

// Update updates an existing proxy.
func (s *ProxyService) Update(id, userID uuid.UUID, req UpdateProxyRequest) (*models.Proxy, error) {
	proxy, err := s.repo.FindByIDAndUser(id, userID)
	if err != nil {
		return nil, errors.New("proxy not found")
	}

	if req.Name != nil {
		proxy.Name = *req.Name
	}
	if req.Type != nil {
		proxy.Type = models.ProxyType(*req.Type)
	}
	if req.Host != nil {
		proxy.Host = *req.Host
	}
	if req.Port != nil {
		proxy.Port = *req.Port
	}
	if req.Username != nil {
		proxy.Username = req.Username
	}
	if req.Password != nil && *req.Password != "" {
		encrypted, encErr := EncryptData(*req.Password)
		if encErr != nil {
			return nil, fmt.Errorf("encrypt password: %w", encErr)
		}
		proxy.PasswordEncrypted = &encrypted
	}
	if req.IsActive != nil {
		proxy.IsActive = *req.IsActive
	}

	if err := s.repo.Update(proxy); err != nil {
		return nil, err
	}
	return proxy, nil
}

// Delete deletes a proxy.
func (s *ProxyService) Delete(id, userID uuid.UUID) error {
	return s.repo.DeleteByIDAndUser(id, userID)
}

// TestProxy tests the proxy connection by attempting a TCP dial.
func (s *ProxyService) TestProxy(id, userID uuid.UUID) (*models.Proxy, error) {
	proxy, err := s.repo.FindByIDAndUser(id, userID)
	if err != nil {
		return nil, errors.New("proxy not found")
	}

	// Test the proxy by attempting a TCP connection
	address := net.JoinHostPort(proxy.Host, fmt.Sprintf("%d", proxy.Port))
	conn, dialErr := net.DialTimeout("tcp", address, 10*time.Second)

	if dialErr != nil {
		// Update status to failed
		_ = s.repo.UpdateTestStatus(id, models.TestStatusFailed)
		log.Printf("[Proxy] Test failed for %s: %v", address, dialErr)

		// Reload to get updated data
		proxy, _ = s.repo.FindByIDAndUser(id, userID)
		return proxy, fmt.Errorf("proxy test failed: %w", dialErr)
	}
	conn.Close()

	// Update status to success
	_ = s.repo.UpdateTestStatus(id, models.TestStatusSuccess)
	log.Printf("[Proxy] Test succeeded for %s", address)

	// Reload to get updated data
	proxy, _ = s.repo.FindByIDAndUser(id, userID)
	return proxy, nil
}
