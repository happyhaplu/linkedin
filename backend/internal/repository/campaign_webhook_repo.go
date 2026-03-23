package repository

import (
	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// CampaignWebhookRepository handles webhook DB operations.
type CampaignWebhookRepository struct {
	db *gorm.DB
}

func NewCampaignWebhookRepository(db *gorm.DB) *CampaignWebhookRepository {
	return &CampaignWebhookRepository{db: db}
}

// FindByCampaignID returns all webhooks for a campaign scoped to user.
func (r *CampaignWebhookRepository) FindByCampaignID(campaignID, userID uuid.UUID) ([]models.CampaignWebhook, error) {
	var webhooks []models.CampaignWebhook
	err := r.db.Where("campaign_id = ? AND user_id = ?", campaignID, userID).
		Order("created_at DESC").Find(&webhooks).Error
	return webhooks, err
}

// FindActiveByCampaignID returns active webhooks for firing.
func (r *CampaignWebhookRepository) FindActiveByCampaignID(campaignID uuid.UUID) ([]models.CampaignWebhook, error) {
	var webhooks []models.CampaignWebhook
	err := r.db.Where("campaign_id = ? AND is_active = ?", campaignID, true).Find(&webhooks).Error
	return webhooks, err
}

// FindByID returns a single webhook by ID.
func (r *CampaignWebhookRepository) FindByID(webhookID uuid.UUID) (*models.CampaignWebhook, error) {
	var w models.CampaignWebhook
	if err := r.db.Where("id = ?", webhookID).First(&w).Error; err != nil {
		return nil, err
	}
	return &w, nil
}

// Create inserts a new webhook.
func (r *CampaignWebhookRepository) Create(w *models.CampaignWebhook) error {
	return r.db.Create(w).Error
}

// Update saves changes to a webhook.
func (r *CampaignWebhookRepository) Update(w *models.CampaignWebhook) error {
	return r.db.Save(w).Error
}

// UpdateFields updates specific columns on a webhook.
func (r *CampaignWebhookRepository) UpdateFields(webhookID, userID uuid.UUID, fields map[string]interface{}) error {
	return r.db.Model(&models.CampaignWebhook{}).
		Where("id = ? AND user_id = ?", webhookID, userID).
		Updates(fields).Error
}

// Delete removes a webhook by ID, scoped to a user.
func (r *CampaignWebhookRepository) Delete(webhookID, userID uuid.UUID) error {
	return r.db.Where("id = ? AND user_id = ?", webhookID, userID).
		Delete(&models.CampaignWebhook{}).Error
}

// ── Webhook Logs ────────────────────────────────────────────────────────────

// CampaignWebhookLogRepository handles webhook log DB operations.
type CampaignWebhookLogRepository struct {
	db *gorm.DB
}

func NewCampaignWebhookLogRepository(db *gorm.DB) *CampaignWebhookLogRepository {
	return &CampaignWebhookLogRepository{db: db}
}

// Create inserts a new webhook log.
func (r *CampaignWebhookLogRepository) Create(log *models.CampaignWebhookLog) error {
	return r.db.Create(log).Error
}

// FindByCampaignID returns webhook logs for a campaign.
func (r *CampaignWebhookLogRepository) FindByCampaignID(campaignID uuid.UUID, limit int) ([]models.CampaignWebhookLog, error) {
	var logs []models.CampaignWebhookLog
	q := r.db.Preload("Webhook").Where("campaign_id = ?", campaignID).
		Order("created_at DESC")

	if limit > 0 {
		q = q.Limit(limit)
	}

	if err := q.Find(&logs).Error; err != nil {
		return nil, err
	}
	return logs, nil
}
