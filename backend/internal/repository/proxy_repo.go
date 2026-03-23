package repository

import (
	"time"

	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// ProxyRepository handles database operations for proxies.
type ProxyRepository struct {
	db *gorm.DB
}

// NewProxyRepository creates a new repository instance.
func NewProxyRepository(db *gorm.DB) *ProxyRepository {
	return &ProxyRepository{db: db}
}

// FindAllByUser returns all proxies for a user, ordered by creation date (newest first).
func (r *ProxyRepository) FindAllByUser(userID uuid.UUID) ([]models.Proxy, error) {
	var proxies []models.Proxy
	err := r.db.
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&proxies).Error
	return proxies, err
}

// FindByID returns a single proxy by ID.
func (r *ProxyRepository) FindByID(id uuid.UUID) (*models.Proxy, error) {
	var proxy models.Proxy
	err := r.db.First(&proxy, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &proxy, nil
}

// FindByIDAndUser returns a single proxy by ID scoped to a user.
func (r *ProxyRepository) FindByIDAndUser(id, userID uuid.UUID) (*models.Proxy, error) {
	var proxy models.Proxy
	err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&proxy).Error
	if err != nil {
		return nil, err
	}
	return &proxy, nil
}

// Create inserts a new proxy.
func (r *ProxyRepository) Create(proxy *models.Proxy) error {
	return r.db.Create(proxy).Error
}

// Update persists changes to an existing proxy.
func (r *ProxyRepository) Update(proxy *models.Proxy) error {
	proxy.UpdatedAt = time.Now()
	return r.db.Save(proxy).Error
}

// UpdateFields updates only the specified fields of a proxy.
func (r *ProxyRepository) UpdateFields(id uuid.UUID, fields map[string]interface{}) error {
	fields["updated_at"] = time.Now()
	return r.db.Model(&models.Proxy{}).Where("id = ?", id).Updates(fields).Error
}

// Delete removes a proxy by ID.
func (r *ProxyRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Proxy{}, "id = ?", id).Error
}

// DeleteByIDAndUser removes a proxy by ID scoped to a user.
func (r *ProxyRepository) DeleteByIDAndUser(id, userID uuid.UUID) error {
	result := r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&models.Proxy{})
	return result.Error
}

// UpdateTestStatus updates the test result for a proxy.
func (r *ProxyRepository) UpdateTestStatus(id uuid.UUID, status models.TestStatus) error {
	now := time.Now()
	return r.db.Model(&models.Proxy{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"test_status":    status,
			"last_tested_at": now,
			"updated_at":     now,
		}).Error
}

// CountByUser returns the number of proxies for a user.
func (r *ProxyRepository) CountByUser(userID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.Model(&models.Proxy{}).Where("user_id = ?", userID).Count(&count).Error
	return count, err
}
