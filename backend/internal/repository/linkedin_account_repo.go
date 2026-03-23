package repository

import (
	"time"

	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// LinkedInAccountRepository handles database operations for LinkedIn accounts.
type LinkedInAccountRepository struct {
	db *gorm.DB
}

// NewLinkedInAccountRepository creates a new repository instance.
func NewLinkedInAccountRepository(db *gorm.DB) *LinkedInAccountRepository {
	return &LinkedInAccountRepository{db: db}
}

// FindAllByUser returns all LinkedIn accounts for a user, ordered by creation date (newest first).
// Preloads the associated Proxy relation.
func (r *LinkedInAccountRepository) FindAllByUser(userID uuid.UUID) ([]models.LinkedInAccount, error) {
	var accounts []models.LinkedInAccount
	err := r.db.
		Preload("Proxy").
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&accounts).Error
	return accounts, err
}

// FindByID returns a single LinkedIn account by ID.
func (r *LinkedInAccountRepository) FindByID(id uuid.UUID) (*models.LinkedInAccount, error) {
	var account models.LinkedInAccount
	err := r.db.Preload("Proxy").First(&account, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &account, nil
}

// FindByIDAndUser returns a single LinkedIn account by ID scoped to a user.
func (r *LinkedInAccountRepository) FindByIDAndUser(id, userID uuid.UUID) (*models.LinkedInAccount, error) {
	var account models.LinkedInAccount
	err := r.db.Preload("Proxy").
		Where("id = ? AND user_id = ?", id, userID).
		First(&account).Error
	if err != nil {
		return nil, err
	}
	return &account, nil
}

// FindByEmailAndUser returns a LinkedIn account by email scoped to a user.
func (r *LinkedInAccountRepository) FindByEmailAndUser(email string, userID uuid.UUID) (*models.LinkedInAccount, error) {
	var account models.LinkedInAccount
	err := r.db.
		Where("email = ? AND user_id = ?", email, userID).
		First(&account).Error
	if err != nil {
		return nil, err
	}
	return &account, nil
}

// Create inserts a new LinkedIn account.
func (r *LinkedInAccountRepository) Create(account *models.LinkedInAccount) error {
	return r.db.Create(account).Error
}

// Update persists changes to an existing LinkedIn account.
func (r *LinkedInAccountRepository) Update(account *models.LinkedInAccount) error {
	account.UpdatedAt = time.Now()
	return r.db.Save(account).Error
}

// UpdateFields updates only the specified fields of a LinkedIn account.
func (r *LinkedInAccountRepository) UpdateFields(id uuid.UUID, fields map[string]interface{}) error {
	fields["updated_at"] = time.Now()
	return r.db.Model(&models.LinkedInAccount{}).Where("id = ?", id).Updates(fields).Error
}

// Delete removes a LinkedIn account by ID.
func (r *LinkedInAccountRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.LinkedInAccount{}, "id = ?", id).Error
}

// DeleteByIDAndUser removes a LinkedIn account by ID scoped to a user.
func (r *LinkedInAccountRepository) DeleteByIDAndUser(id, userID uuid.UUID) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&models.LinkedInAccount{}).Error
}

// UpdateStatus updates only the status and optional error message.
func (r *LinkedInAccountRepository) UpdateStatus(id uuid.UUID, status models.AccountStatus, errorMsg *string) error {
	fields := map[string]interface{}{
		"status":     status,
		"updated_at": time.Now(),
	}
	if errorMsg != nil {
		fields["error_message"] = *errorMsg
	} else {
		fields["error_message"] = nil
	}
	return r.db.Model(&models.LinkedInAccount{}).Where("id = ?", id).Updates(fields).Error
}

// UpdateDailyLimits updates the daily limits for an account.
func (r *LinkedInAccountRepository) UpdateDailyLimits(id uuid.UUID, limits *models.DailyLimits) error {
	return r.db.Model(&models.LinkedInAccount{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"daily_limits": limits,
			"updated_at":   time.Now(),
		}).Error
}

// UpdateProxy assigns or removes a proxy from an account.
func (r *LinkedInAccountRepository) UpdateProxy(id uuid.UUID, proxyID *uuid.UUID) error {
	return r.db.Model(&models.LinkedInAccount{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"proxy_id":   proxyID,
			"updated_at": time.Now(),
		}).Error
}

// UpdateAssignedCampaigns updates the assigned campaigns for an account.
func (r *LinkedInAccountRepository) UpdateAssignedCampaigns(id uuid.UUID, campaignIDs models.StringArray) error {
	return r.db.Model(&models.LinkedInAccount{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"assigned_campaigns": campaignIDs,
			"updated_at":         time.Now(),
		}).Error
}

// UpdateSessionCookies updates session cookies and profile data after login/reconnect.
func (r *LinkedInAccountRepository) UpdateSessionCookies(id uuid.UUID, cookies models.JSONB, profileData map[string]interface{}) error {
	fields := map[string]interface{}{
		"session_cookies":  cookies,
		"status":           models.AccountStatusActive,
		"error_message":    nil,
		"last_activity_at": time.Now(),
		"updated_at":       time.Now(),
	}
	for k, v := range profileData {
		fields[k] = v
	}
	return r.db.Model(&models.LinkedInAccount{}).Where("id = ?", id).Updates(fields).Error
}

// FindAllActive returns all active accounts (optionally scoped to a user).
func (r *LinkedInAccountRepository) FindAllActive(userID *uuid.UUID) ([]models.LinkedInAccount, error) {
	var accounts []models.LinkedInAccount
	query := r.db.Where("status = ?", models.AccountStatusActive)
	if userID != nil {
		query = query.Where("user_id = ?", *userID)
	}
	err := query.Find(&accounts).Error
	return accounts, err
}

// CountByUser returns the number of LinkedIn accounts for a user.
func (r *LinkedInAccountRepository) CountByUser(userID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.Model(&models.LinkedInAccount{}).Where("user_id = ?", userID).Count(&count).Error
	return count, err
}
