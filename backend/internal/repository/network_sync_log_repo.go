package repository

import (
	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// NetworkSyncLogRepository handles CRUD for the network_sync_logs table.
type NetworkSyncLogRepository struct {
	db *gorm.DB
}

func NewNetworkSyncLogRepository(db *gorm.DB) *NetworkSyncLogRepository {
	return &NetworkSyncLogRepository{db: db}
}

// Create inserts a new sync log.
func (r *NetworkSyncLogRepository) Create(log *models.NetworkSyncLog) error {
	return r.db.Create(log).Error
}

// Update persists changes to a sync log.
func (r *NetworkSyncLogRepository) Update(log *models.NetworkSyncLog) error {
	return r.db.Save(log).Error
}

// FindByID returns a single sync log.
func (r *NetworkSyncLogRepository) FindByID(id uuid.UUID) (*models.NetworkSyncLog, error) {
	var log models.NetworkSyncLog
	if err := r.db.Where("id = ?", id).First(&log).Error; err != nil {
		return nil, err
	}
	return &log, nil
}

// FindAllByUser returns sync logs with optional account filter, limited to 50.
func (r *NetworkSyncLogRepository) FindAllByUser(userID uuid.UUID, accountID *uuid.UUID) ([]models.NetworkSyncLog, error) {
	var logs []models.NetworkSyncLog
	q := r.db.Preload("LinkedInAccount").Where("network_sync_logs.user_id = ?", userID)

	if accountID != nil {
		q = q.Where("network_sync_logs.linkedin_account_id = ?", *accountID)
	}

	err := q.Order("network_sync_logs.created_at DESC").Limit(50).Find(&logs).Error
	return logs, err
}

// FindLatest returns the most recent sync log for an account.
func (r *NetworkSyncLogRepository) FindLatest(userID, accountID uuid.UUID) (*models.NetworkSyncLog, error) {
	var log models.NetworkSyncLog
	err := r.db.Preload("LinkedInAccount").
		Where("user_id = ? AND linkedin_account_id = ?", userID, accountID).
		Order("created_at DESC").
		First(&log).Error
	if err != nil {
		return nil, err
	}
	return &log, nil
}
