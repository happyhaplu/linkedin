package repository

import (
	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// AccountHealthRepository handles database operations for account health logs.
type AccountHealthRepository struct {
	db *gorm.DB
}

// NewAccountHealthRepository creates a new repository instance.
func NewAccountHealthRepository(db *gorm.DB) *AccountHealthRepository {
	return &AccountHealthRepository{db: db}
}

// Create inserts a new health log entry.
func (r *AccountHealthRepository) Create(log *models.AccountHealthLog) error {
	return r.db.Create(log).Error
}

// FindByAccountID returns health logs for a specific account, ordered by checked_at desc.
func (r *AccountHealthRepository) FindByAccountID(accountID uuid.UUID, limit int) ([]models.AccountHealthLog, error) {
	var logs []models.AccountHealthLog
	query := r.db.
		Where("linkedin_account_id = ?", accountID).
		Order("checked_at DESC")
	if limit > 0 {
		query = query.Limit(limit)
	}
	err := query.Find(&logs).Error
	return logs, err
}
