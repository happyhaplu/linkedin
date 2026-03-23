package repository

import (
	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// CampaignSenderRepository handles campaign sender DB operations.
type CampaignSenderRepository struct {
	db *gorm.DB
}

func NewCampaignSenderRepository(db *gorm.DB) *CampaignSenderRepository {
	return &CampaignSenderRepository{db: db}
}

// FindByCampaignID returns all senders for a campaign.
func (r *CampaignSenderRepository) FindByCampaignID(campaignID uuid.UUID) ([]models.CampaignSender, error) {
	var senders []models.CampaignSender
	err := r.db.Where("campaign_id = ?", campaignID).Find(&senders).Error
	return senders, err
}

// FindByCampaignIDWithAccount returns senders with linked account data.
func (r *CampaignSenderRepository) FindByCampaignIDWithAccount(campaignID uuid.UUID) ([]models.CampaignSender, error) {
	var senders []models.CampaignSender
	err := r.db.Preload("LinkedInAccount").Where("campaign_id = ?", campaignID).Find(&senders).Error
	return senders, err
}

// FindActiveByCampaignID returns active senders for a campaign.
func (r *CampaignSenderRepository) FindActiveByCampaignID(campaignID uuid.UUID) ([]models.CampaignSender, error) {
	var senders []models.CampaignSender
	err := r.db.Where("campaign_id = ? AND is_active = ?", campaignID, true).Find(&senders).Error
	return senders, err
}

// FindByID returns a single sender by ID.
func (r *CampaignSenderRepository) FindByID(senderID uuid.UUID) (*models.CampaignSender, error) {
	var s models.CampaignSender
	if err := r.db.Where("id = ?", senderID).First(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

// Create inserts campaign senders.
func (r *CampaignSenderRepository) Create(senders []models.CampaignSender) error {
	if len(senders) == 0 {
		return nil
	}
	return r.db.Create(&senders).Error
}

// Upsert inserts or updates a sender (unique on campaign_id + linkedin_account_id).
func (r *CampaignSenderRepository) Upsert(sender *models.CampaignSender) error {
	return r.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "campaign_id"}, {Name: "linkedin_account_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"is_active", "daily_limit", "updated_at"}),
	}).Create(sender).Error
}

// DeleteByCampaignID removes all senders for a campaign.
func (r *CampaignSenderRepository) DeleteByCampaignID(campaignID uuid.UUID) error {
	return r.db.Where("campaign_id = ?", campaignID).Delete(&models.CampaignSender{}).Error
}

// Delete removes a specific sender.
func (r *CampaignSenderRepository) Delete(senderID, campaignID uuid.UUID) error {
	return r.db.Where("id = ? AND campaign_id = ?", senderID, campaignID).Delete(&models.CampaignSender{}).Error
}

// IncrementStat atomically increments a stat column on a campaign sender.
func (r *CampaignSenderRepository) IncrementStat(campaignID, accountID uuid.UUID, column string) error {
	return r.db.Model(&models.CampaignSender{}).
		Where("campaign_id = ? AND linkedin_account_id = ?", campaignID, accountID).
		UpdateColumn(column, gorm.Expr(column+" + 1")).Error
}

// FindByCampaignIDs returns senders for multiple campaigns (for list view).
func (r *CampaignSenderRepository) FindByCampaignIDs(campaignIDs []uuid.UUID) ([]models.CampaignSender, error) {
	var senders []models.CampaignSender
	err := r.db.Preload("LinkedInAccount").Where("campaign_id IN ?", campaignIDs).Find(&senders).Error
	return senders, err
}
