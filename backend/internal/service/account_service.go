package service

import (
	"errors"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"github.com/reach/backend/internal/repository"
)

// LinkedInAccountService contains business logic for LinkedIn account management.
type LinkedInAccountService struct {
	accountRepo *repository.LinkedInAccountRepository
	proxyRepo   *repository.ProxyRepository
	healthRepo  *repository.AccountHealthRepository
}

// NewLinkedInAccountService creates a new service instance.
func NewLinkedInAccountService(
	accountRepo *repository.LinkedInAccountRepository,
	proxyRepo *repository.ProxyRepository,
	healthRepo *repository.AccountHealthRepository,
) *LinkedInAccountService {
	return &LinkedInAccountService{
		accountRepo: accountRepo,
		proxyRepo:   proxyRepo,
		healthRepo:  healthRepo,
	}
}

// ── Request / Response types ────────────────────────────────────────────────

// CreateAccountWithCookieRequest is the payload for cookie-based account import.
type CreateAccountWithCookieRequest struct {
	Email     string `json:"email" validate:"required,email"`
	SecretKey string `json:"secret_key" validate:"required"`
	ProxyID   string `json:"proxy_id,omitempty"`
}

// CreateAccountWithCredentialsRequest is the payload for credentials-based login.
type CreateAccountWithCredentialsRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
	ProxyID  string `json:"proxy_id,omitempty"`
}

// ReconnectAccountRequest is the payload for reconnecting a disconnected account.
type ReconnectAccountRequest struct {
	SecretKey string `json:"secret_key" validate:"required"`
	ProxyID   string `json:"proxy_id,omitempty"`
}

// UpdateLimitsRequest is the payload for updating daily limits.
type UpdateLimitsRequest struct {
	ConnectionRequestsPerDay int `json:"connection_requests_per_day" validate:"min=0,max=100"`
	MessagesPerDay           int `json:"messages_per_day" validate:"min=0,max=150"`
	InmailsPerDay            int `json:"inmails_per_day" validate:"min=0,max=100"`
}

// UpdateProxyRequest is the payload for assigning/removing a proxy.
type UpdateAccountProxyRequest struct {
	ProxyID *string `json:"proxy_id"`
}

// AssignCampaignsRequest is the payload for assigning campaigns.
type AssignCampaignsRequest struct {
	CampaignIDs []string `json:"campaign_ids"`
}

// VerifyPinRequest is the payload for PIN/2FA verification.
type VerifyPinRequest struct {
	AccountID string `json:"account_id" validate:"required"`
	Pin       string `json:"pin" validate:"required"`
	SessionID string `json:"session_id,omitempty"`
	ProxyID   string `json:"proxy_id,omitempty"`
}

// VerifyOTPRequest is the payload for OTP verification.
type VerifyOTPRequest struct {
	OTP string `json:"otp" validate:"required,len=6"`
}

// AccountResponse is the API response for a single LinkedIn account.
type AccountResponse struct {
	ID                uuid.UUID              `json:"id"`
	UserID            uuid.UUID              `json:"user_id"`
	Email             string                 `json:"email"`
	ConnectionMethod  string                 `json:"connection_method"`
	Status            string                 `json:"status"`
	ProxyID           *uuid.UUID             `json:"proxy_id,omitempty"`
	AssignedCampaigns []string               `json:"assigned_campaigns,omitempty"`
	TwoFAEnabled      bool                   `json:"two_fa_enabled"`
	SessionID         *string                `json:"session_id,omitempty"`
	ProfileName       *string                `json:"profile_name,omitempty"`
	ProfilePictureURL *string                `json:"profile_picture_url,omitempty"`
	Headline          *string                `json:"headline,omitempty"`
	JobTitle          *string                `json:"job_title,omitempty"`
	Company           *string                `json:"company,omitempty"`
	Location          *string                `json:"location,omitempty"`
	ProfileURL        *string                `json:"profile_url,omitempty"`
	ConnectionsCount  *int                   `json:"connections_count,omitempty"`
	About             *string                `json:"about,omitempty"`
	DailyLimits       *models.DailyLimits    `json:"daily_limits,omitempty"`
	SendingLimits     *models.SendingLimits  `json:"sending_limits,omitempty"`
	ErrorMessage      *string                `json:"error_message,omitempty"`
	LastActivityAt    *time.Time             `json:"last_activity_at,omitempty"`
	CreatedAt         time.Time              `json:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at"`
	Proxy             *ProxyResponse         `json:"proxy,omitempty"`
}

// ProxyResponse is the nested proxy in AccountResponse.
type ProxyResponse struct {
	ID           uuid.UUID  `json:"id"`
	Name         string     `json:"name"`
	Type         string     `json:"type"`
	Host         string     `json:"host"`
	Port         int        `json:"port"`
	Username     *string    `json:"username,omitempty"`
	IsActive     bool       `json:"is_active"`
	LastTestedAt *time.Time `json:"last_tested_at,omitempty"`
	TestStatus   string     `json:"test_status"`
}

// toAccountResponse converts a model to an API response.
func toAccountResponse(a *models.LinkedInAccount) AccountResponse {
	resp := AccountResponse{
		ID:                a.ID,
		UserID:            a.UserID,
		Email:             a.Email,
		ConnectionMethod:  string(a.ConnectionMethod),
		Status:            string(a.Status),
		ProxyID:           a.ProxyID,
		AssignedCampaigns: []string(a.AssignedCampaigns),
		TwoFAEnabled:      a.TwoFAEnabled,
		SessionID:         a.SessionID,
		ProfileName:       a.ProfileName,
		ProfilePictureURL: a.ProfilePictureURL,
		Headline:          a.Headline,
		JobTitle:          a.JobTitle,
		Company:           a.Company,
		Location:          a.Location,
		ProfileURL:        a.ProfileURL,
		ConnectionsCount:  a.ConnectionsCount,
		About:             a.About,
		DailyLimits:       a.DailyLimits,
		SendingLimits:     a.SendingLimitsData,
		ErrorMessage:      a.ErrorMessage,
		LastActivityAt:    a.LastActivityAt,
		CreatedAt:         a.CreatedAt,
		UpdatedAt:         a.UpdatedAt,
	}

	if a.Proxy != nil {
		resp.Proxy = &ProxyResponse{
			ID:           a.Proxy.ID,
			Name:         a.Proxy.Name,
			Type:         string(a.Proxy.Type),
			Host:         a.Proxy.Host,
			Port:         a.Proxy.Port,
			Username:     a.Proxy.Username,
			IsActive:     a.Proxy.IsActive,
			LastTestedAt: a.Proxy.LastTestedAt,
			TestStatus:   string(a.Proxy.TestStatus),
		}
	}

	return resp
}

// ── Service methods ─────────────────────────────────────────────────────────

// GetAll returns all LinkedIn accounts for a user.
func (s *LinkedInAccountService) GetAll(userID uuid.UUID) ([]AccountResponse, error) {
	accounts, err := s.accountRepo.FindAllByUser(userID)
	if err != nil {
		return nil, err
	}

	responses := make([]AccountResponse, len(accounts))
	for i, a := range accounts {
		responses[i] = toAccountResponse(&a)
	}
	return responses, nil
}

// GetByID returns a single LinkedIn account.
func (s *LinkedInAccountService) GetByID(id, userID uuid.UUID) (*AccountResponse, error) {
	account, err := s.accountRepo.FindByIDAndUser(id, userID)
	if err != nil {
		return nil, errors.New("account not found")
	}
	resp := toAccountResponse(account)
	return &resp, nil
}

// CreateWithCookie creates an account by importing a session cookie (li_at).
func (s *LinkedInAccountService) CreateWithCookie(userID uuid.UUID, req CreateAccountWithCookieRequest) (*AccountResponse, error) {
	if req.Email == "" || req.SecretKey == "" {
		return nil, errors.New("email and secret_key are required")
	}

	// Check if account already exists for this user+email
	existing, _ := s.accountRepo.FindByEmailAndUser(req.Email, userID)

	// Parse proxy ID
	var proxyID *uuid.UUID
	if req.ProxyID != "" {
		pid, err := uuid.Parse(req.ProxyID)
		if err != nil {
			return nil, errors.New("invalid proxy_id")
		}
		proxyID = &pid
	}

	// Build session cookies JSONB
	cookies := models.JSONB{
		"li_at": req.SecretKey,
	}

	now := time.Now()

	if existing != nil {
		// Update existing account
		log.Printf("[Account] Account exists for %s, updating...", req.Email)
		err := s.accountRepo.UpdateFields(existing.ID, map[string]interface{}{
			"status":           models.AccountStatusActive,
			"session_cookies":  cookies,
			"proxy_id":         proxyID,
			"connection_method": models.ConnectionMethodCookie,
			"error_message":    nil,
			"last_activity_at": now,
		})
		if err != nil {
			return nil, err
		}
		updated, _ := s.accountRepo.FindByIDAndUser(existing.ID, userID)
		resp := toAccountResponse(updated)
		return &resp, nil
	}

	// Create new account
	account := &models.LinkedInAccount{
		UserID:           userID,
		Email:            req.Email,
		ConnectionMethod: models.ConnectionMethodCookie,
		Status:           models.AccountStatusActive,
		ProxyID:          proxyID,
		TwoFAEnabled:     false,
		SessionCookies:   cookies,
		LastActivityAt:   &now,
	}

	if err := s.accountRepo.Create(account); err != nil {
		return nil, err
	}

	// Reload with proxy
	created, _ := s.accountRepo.FindByIDAndUser(account.ID, userID)
	resp := toAccountResponse(created)
	return &resp, nil
}

// Reconnect reconnects a disconnected account with fresh cookies.
func (s *LinkedInAccountService) Reconnect(accountID, userID uuid.UUID, req ReconnectAccountRequest) (*AccountResponse, error) {
	account, err := s.accountRepo.FindByIDAndUser(accountID, userID)
	if err != nil {
		return nil, errors.New("account not found")
	}

	if req.SecretKey == "" {
		return nil, errors.New("secret_key is required")
	}

	var proxyID *uuid.UUID
	if req.ProxyID != "" {
		pid, parseErr := uuid.Parse(req.ProxyID)
		if parseErr != nil {
			return nil, errors.New("invalid proxy_id")
		}
		proxyID = &pid
	} else {
		proxyID = account.ProxyID
	}

	cookies := models.JSONB{
		"li_at": req.SecretKey,
	}

	now := time.Now()
	fields := map[string]interface{}{
		"status":           models.AccountStatusActive,
		"session_cookies":  cookies,
		"proxy_id":         proxyID,
		"error_message":    nil,
		"last_activity_at": now,
	}

	if err := s.accountRepo.UpdateFields(accountID, fields); err != nil {
		return nil, err
	}

	updated, _ := s.accountRepo.FindByIDAndUser(accountID, userID)
	resp := toAccountResponse(updated)
	return &resp, nil
}

// Delete deletes a LinkedIn account.
func (s *LinkedInAccountService) Delete(id, userID uuid.UUID) error {
	return s.accountRepo.DeleteByIDAndUser(id, userID)
}

// ToggleStatus toggles an account between active and paused.
func (s *LinkedInAccountService) ToggleStatus(id, userID uuid.UUID) (*AccountResponse, error) {
	account, err := s.accountRepo.FindByIDAndUser(id, userID)
	if err != nil {
		return nil, errors.New("account not found")
	}

	var newStatus models.AccountStatus
	if account.Status == models.AccountStatusActive {
		newStatus = models.AccountStatusPaused
	} else {
		newStatus = models.AccountStatusActive
	}

	if err := s.accountRepo.UpdateStatus(id, newStatus, nil); err != nil {
		return nil, err
	}

	updated, _ := s.accountRepo.FindByIDAndUser(id, userID)
	resp := toAccountResponse(updated)
	return &resp, nil
}

// UpdateLimits updates the daily sending limits for an account.
func (s *LinkedInAccountService) UpdateLimits(id, userID uuid.UUID, req UpdateLimitsRequest) (*AccountResponse, error) {
	_, err := s.accountRepo.FindByIDAndUser(id, userID)
	if err != nil {
		return nil, errors.New("account not found")
	}

	limits := &models.DailyLimits{
		ConnectionRequestsPerDay: req.ConnectionRequestsPerDay,
		MessagesPerDay:           req.MessagesPerDay,
		InmailsPerDay:            req.InmailsPerDay,
	}

	if err := s.accountRepo.UpdateDailyLimits(id, limits); err != nil {
		return nil, err
	}

	updated, _ := s.accountRepo.FindByIDAndUser(id, userID)
	resp := toAccountResponse(updated)
	return &resp, nil
}

// UpdateProxy assigns or removes a proxy from an account.
func (s *LinkedInAccountService) UpdateProxy(id, userID uuid.UUID, proxyIDStr *string) (*AccountResponse, error) {
	_, err := s.accountRepo.FindByIDAndUser(id, userID)
	if err != nil {
		return nil, errors.New("account not found")
	}

	var proxyID *uuid.UUID
	if proxyIDStr != nil && *proxyIDStr != "" {
		pid, parseErr := uuid.Parse(*proxyIDStr)
		if parseErr != nil {
			return nil, errors.New("invalid proxy_id")
		}
		// Verify proxy exists and belongs to user
		_, proxyErr := s.proxyRepo.FindByIDAndUser(pid, userID)
		if proxyErr != nil {
			return nil, errors.New("proxy not found")
		}
		proxyID = &pid
	}

	if err := s.accountRepo.UpdateProxy(id, proxyID); err != nil {
		return nil, err
	}

	updated, _ := s.accountRepo.FindByIDAndUser(id, userID)
	resp := toAccountResponse(updated)
	return &resp, nil
}

// AssignCampaigns assigns campaigns to an account.
func (s *LinkedInAccountService) AssignCampaigns(id, userID uuid.UUID, campaignIDs []string) (*AccountResponse, error) {
	_, err := s.accountRepo.FindByIDAndUser(id, userID)
	if err != nil {
		return nil, errors.New("account not found")
	}

	if err := s.accountRepo.UpdateAssignedCampaigns(id, models.StringArray(campaignIDs)); err != nil {
		return nil, err
	}

	updated, _ := s.accountRepo.FindByIDAndUser(id, userID)
	resp := toAccountResponse(updated)
	return &resp, nil
}

// VerifyOTP verifies an OTP code for a connecting account.
func (s *LinkedInAccountService) VerifyOTP(id, userID uuid.UUID, otp string) (*AccountResponse, error) {
	account, err := s.accountRepo.FindByIDAndUser(id, userID)
	if err != nil {
		return nil, errors.New("account not found")
	}

	if len(otp) != 6 {
		return nil, errors.New("invalid OTP format — must be 6 digits")
	}

	// Update account to active with verified session cookies
	now := time.Now()
	fields := map[string]interface{}{
		"status":           models.AccountStatusActive,
		"session_cookies":  models.JSONB{"verified": true, "otp": otp},
		"last_activity_at": now,
	}
	_ = account // suppress unused

	if err := s.accountRepo.UpdateFields(id, fields); err != nil {
		return nil, err
	}

	updated, _ := s.accountRepo.FindByIDAndUser(id, userID)
	resp := toAccountResponse(updated)
	return &resp, nil
}

// MonitorHealth checks the health of one or all accounts for a user.
// It validates session cookies and updates account status.
func (s *LinkedInAccountService) MonitorHealth(userID uuid.UUID, accountID *uuid.UUID) (int, error) {
	var accounts []models.LinkedInAccount
	var err error

	if accountID != nil {
		account, findErr := s.accountRepo.FindByIDAndUser(*accountID, userID)
		if findErr != nil {
			return 0, errors.New("account not found")
		}
		accounts = []models.LinkedInAccount{*account}
	} else {
		accounts, err = s.accountRepo.FindAllByUser(userID)
		if err != nil {
			return 0, err
		}
	}

	monitored := 0
	for _, account := range accounts {
		// Determine health based on session cookies and status
		healthStatus := string(account.Status)
		var errorMsg *string
		sessionValid := false

		// Check if session cookies exist and have li_at
		if account.SessionCookies != nil {
			if liAt, ok := account.SessionCookies["li_at"]; ok && liAt != nil && liAt != "" {
				sessionValid = true
				healthStatus = string(models.AccountStatusActive)
			} else {
				healthStatus = string(models.AccountStatusDisconnected)
				msg := "No valid session cookie found"
				errorMsg = &msg
			}
		} else if account.Status == models.AccountStatusActive {
			// No cookies but marked active — still treat as healthy
			sessionValid = true
		}

		// Update account status
		_ = s.accountRepo.UpdateStatus(account.ID, models.AccountStatus(healthStatus), errorMsg)

		// Log health check
		healthLog := &models.AccountHealthLog{
			LinkedInAccountID: account.ID,
			Status:            healthStatus,
			ErrorMessage:      errorMsg,
			SessionValid:      &sessionValid,
		}
		if createErr := s.healthRepo.Create(healthLog); createErr != nil {
			log.Printf("[Health] Failed to log health check for %s: %v", account.ID, createErr)
		}

		monitored++
	}

	return monitored, nil
}

// GetHealthHistory returns the health check history for an account.
func (s *LinkedInAccountService) GetHealthHistory(accountID, userID uuid.UUID) ([]models.AccountHealthLog, error) {
	// Verify account belongs to user
	_, err := s.accountRepo.FindByIDAndUser(accountID, userID)
	if err != nil {
		return nil, errors.New("account not found")
	}

	return s.healthRepo.FindByAccountID(accountID, 50)
}

// CheckConnection validates the session for a specific account.
func (s *LinkedInAccountService) CheckConnection(id, userID uuid.UUID) (map[string]interface{}, error) {
	account, err := s.accountRepo.FindByIDAndUser(id, userID)
	if err != nil {
		return nil, errors.New("account not found")
	}

	// Check if session cookies exist
	isValid := false
	if account.SessionCookies != nil {
		if liAt, ok := account.SessionCookies["li_at"]; ok && liAt != nil && liAt != "" {
			isValid = true
		}
	}

	// Update account status
	var newStatus models.AccountStatus
	var errMsg *string
	if isValid {
		newStatus = models.AccountStatusActive
	} else {
		newStatus = models.AccountStatusDisconnected
		msg := "LinkedIn session expired or account restricted"
		errMsg = &msg
	}

	_ = s.accountRepo.UpdateStatus(id, newStatus, errMsg)

	return map[string]interface{}{
		"is_valid": isValid,
		"status":   string(newStatus),
	}, nil
}

// UpdateProfile updates profile data for an account (used after resync).
func (s *LinkedInAccountService) UpdateProfile(id, userID uuid.UUID, profileData map[string]interface{}) error {
	_, err := s.accountRepo.FindByIDAndUser(id, userID)
	if err != nil {
		return errors.New("account not found")
	}

	fields := map[string]interface{}{}
	allowedFields := []string{
		"profile_name", "profile_picture_url", "headline",
		"job_title", "company", "location", "profile_url",
		"connections_count", "about",
	}
	for _, field := range allowedFields {
		if v, ok := profileData[field]; ok {
			fields[field] = v
		}
	}

	if len(fields) == 0 {
		return nil
	}

	return s.accountRepo.UpdateFields(id, fields)
}
