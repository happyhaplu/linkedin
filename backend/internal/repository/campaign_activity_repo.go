package repository

import (
	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// CampaignActivityRepository handles campaign activity log DB operations.
type CampaignActivityRepository struct {
	db *gorm.DB
}

func NewCampaignActivityRepository(db *gorm.DB) *CampaignActivityRepository {
	return &CampaignActivityRepository{db: db}
}

// Create inserts a new activity log entry.
func (r *CampaignActivityRepository) Create(log *models.CampaignActivityLog) error {
	return r.db.Create(log).Error
}

// FindByCampaignID returns activity logs for a campaign.
func (r *CampaignActivityRepository) FindByCampaignID(campaignID uuid.UUID, limit int) ([]models.CampaignActivityLog, error) {
	var logs []models.CampaignActivityLog
	q := r.db.Where("campaign_id = ?", campaignID).
		Order("executed_at DESC")

	if limit > 0 {
		q = q.Limit(limit)
	}

	if err := q.Find(&logs).Error; err != nil {
		return nil, err
	}
	return logs, nil
}

// FindDailyActivity returns activity logs for chart data.
func (r *CampaignActivityRepository) FindDailyActivity(campaignID uuid.UUID) ([]models.CampaignActivityLog, error) {
	var logs []models.CampaignActivityLog
	err := r.db.Select("executed_at, activity_type, activity_status").
		Where("campaign_id = ?", campaignID).
		Order("executed_at ASC").Find(&logs).Error
	return logs, err
}
