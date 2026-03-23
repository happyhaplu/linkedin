package repository

import (
	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// CampaignLeadRepository handles campaign lead DB operations.
type CampaignLeadRepository struct {
	db *gorm.DB
}

func NewCampaignLeadRepository(db *gorm.DB) *CampaignLeadRepository {
	return &CampaignLeadRepository{db: db}
}

// FindByCampaignID returns all leads for a campaign with optional filters.
func (r *CampaignLeadRepository) FindByCampaignID(campaignID uuid.UUID, status, senderID *string) ([]models.CampaignLead, error) {
	var leads []models.CampaignLead
	q := r.db.Where("campaign_id = ?", campaignID).Order("created_at DESC")

	if status != nil && *status != "" {
		q = q.Where("status = ?", *status)
	}
	if senderID != nil && *senderID != "" {
		q = q.Where("sender_id = ?", *senderID)
	}

	if err := q.Find(&leads).Error; err != nil {
		return nil, err
	}
	return leads, nil
}

// FindByID returns a single campaign lead by ID.
func (r *CampaignLeadRepository) FindByID(clID uuid.UUID) (*models.CampaignLead, error) {
	var cl models.CampaignLead
	if err := r.db.Where("id = ?", clID).First(&cl).Error; err != nil {
		return nil, err
	}
	return &cl, nil
}

// Create inserts campaign leads in bulk.
func (r *CampaignLeadRepository) Create(leads []models.CampaignLead) error {
	if len(leads) == 0 {
		return nil
	}
	return r.db.CreateInBatches(&leads, 500).Error
}

// Delete removes campaign leads by IDs.
func (r *CampaignLeadRepository) Delete(ids []uuid.UUID) error {
	return r.db.Where("id IN ?", ids).Delete(&models.CampaignLead{}).Error
}

// DeleteByCampaignID removes all leads for a campaign.
func (r *CampaignLeadRepository) DeleteByCampaignID(campaignID uuid.UUID) error {
	return r.db.Where("campaign_id = ?", campaignID).Delete(&models.CampaignLead{}).Error
}

// UpdateFields updates specific columns on a campaign lead.
func (r *CampaignLeadRepository) UpdateFields(clID uuid.UUID, fields map[string]interface{}) error {
	return r.db.Model(&models.CampaignLead{}).Where("id = ?", clID).Updates(fields).Error
}

// UpdateStatusByIDs updates the status of multiple campaign leads.
func (r *CampaignLeadRepository) UpdateStatusByIDs(campaignID uuid.UUID, statuses []string, newStatus string) (int64, error) {
	result := r.db.Model(&models.CampaignLead{}).
		Where("campaign_id = ? AND status IN ?", campaignID, statuses).
		Update("status", newStatus)
	return result.RowsAffected, result.Error
}

// CountByStatus returns lead counts grouped by status for a campaign.
func (r *CampaignLeadRepository) CountByStatus(campaignID uuid.UUID) (models.CampaignLeadStats, error) {
	var stats models.CampaignLeadStats
	var leads []models.CampaignLead
	if err := r.db.Select("status").Where("campaign_id = ?", campaignID).Find(&leads).Error; err != nil {
		return stats, err
	}

	stats.Total = len(leads)
	for _, l := range leads {
		switch l.Status {
		case models.CampaignLeadStatusPending:
			stats.Pending++
		case models.CampaignLeadStatusInProgress:
			stats.InProgress++
		case models.CampaignLeadStatusPaused:
			stats.Paused++
		case models.CampaignLeadStatusCompleted:
			stats.Completed++
		case models.CampaignLeadStatusFailed:
			stats.Failed++
		case models.CampaignLeadStatusRemoved:
			stats.Removed++
		}
	}
	return stats, nil
}

// FindPendingByCampaignID returns pending leads for a campaign.
func (r *CampaignLeadRepository) FindPendingByCampaignID(campaignID uuid.UUID) ([]models.CampaignLead, error) {
	var leads []models.CampaignLead
	err := r.db.Where("campaign_id = ? AND status = ?", campaignID, "pending").Find(&leads).Error
	return leads, err
}

// FindInProgressByCampaignID returns in_progress leads for a campaign.
func (r *CampaignLeadRepository) FindInProgressByCampaignID(campaignID uuid.UUID) ([]models.CampaignLead, error) {
	var leads []models.CampaignLead
	err := r.db.Where("campaign_id = ? AND status = ?", campaignID, "in_progress").Find(&leads).Error
	return leads, err
}

// FindPendingAndInProgressByCampaignID returns leads needing processing.
func (r *CampaignLeadRepository) FindPendingAndInProgressByCampaignID(campaignID uuid.UUID) ([]models.CampaignLead, error) {
	var leads []models.CampaignLead
	err := r.db.Where("campaign_id = ? AND status IN ?", campaignID, []string{"pending", "in_progress"}).
		Find(&leads).Error
	return leads, err
}

// CountPendingOrInProgress returns the number of leads that are still being processed.
func (r *CampaignLeadRepository) CountPendingOrInProgress(campaignID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.Model(&models.CampaignLead{}).
		Where("campaign_id = ? AND status IN ?", campaignID, []string{"pending", "in_progress"}).
		Count(&count).Error
	return count, err
}

// FindExistingLeadIDs returns lead_ids already enrolled in a campaign.
func (r *CampaignLeadRepository) FindExistingLeadIDs(campaignID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := r.db.Model(&models.CampaignLead{}).
		Where("campaign_id = ?", campaignID).
		Pluck("lead_id", &ids).Error
	return ids, err
}

// FindAnalyticsLeads returns lightweight lead data for analytics computation.
func (r *CampaignLeadRepository) FindAnalyticsLeads(campaignID uuid.UUID) ([]models.CampaignLead, error) {
	var leads []models.CampaignLead
	err := r.db.Select(
		"id, status, connection_sent_at, connection_accepted_at, first_message_sent_at, first_reply_at, sender_id, created_at, variant",
	).Where("campaign_id = ?", campaignID).Find(&leads).Error
	return leads, err
}

// CountByCampaignID returns the total number of leads in a campaign.
func (r *CampaignLeadRepository) CountByCampaignID(campaignID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.Model(&models.CampaignLead{}).Where("campaign_id = ?", campaignID).Count(&count).Error
	return count, err
}
