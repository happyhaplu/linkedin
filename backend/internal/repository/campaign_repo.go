package repository

import (
	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// CampaignRepository handles all campaign DB operations.
type CampaignRepository struct {
	db *gorm.DB
}

func NewCampaignRepository(db *gorm.DB) *CampaignRepository {
	return &CampaignRepository{db: db}
}

// FindAllByUser returns all campaigns for a user with optional filters.
func (r *CampaignRepository) FindAllByUser(userID uuid.UUID, status, search *string) ([]models.Campaign, error) {
	var campaigns []models.Campaign
	q := r.db.Where("user_id = ?", userID).Order("created_at DESC")

	if status != nil && *status != "" {
		q = q.Where("status = ?", *status)
	}
	if search != nil && *search != "" {
		like := "%" + *search + "%"
		q = q.Where("(name ILIKE ? OR description ILIKE ?)", like, like)
	}

	if err := q.Find(&campaigns).Error; err != nil {
		return nil, err
	}
	return campaigns, nil
}

// FindByID returns a single campaign by ID, scoped to a user.
func (r *CampaignRepository) FindByID(campaignID, userID uuid.UUID) (*models.Campaign, error) {
	var c models.Campaign
	err := r.db.Where("id = ? AND user_id = ?", campaignID, userID).First(&c).Error
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// FindByIDUnscoped returns a campaign by ID without user scoping.
func (r *CampaignRepository) FindByIDUnscoped(campaignID uuid.UUID) (*models.Campaign, error) {
	var c models.Campaign
	if err := r.db.Where("id = ?", campaignID).First(&c).Error; err != nil {
		return nil, err
	}
	return &c, nil
}

// Create inserts a new campaign.
func (r *CampaignRepository) Create(c *models.Campaign) error {
	return r.db.Create(c).Error
}

// Update saves changes to an existing campaign.
func (r *CampaignRepository) Update(c *models.Campaign) error {
	return r.db.Save(c).Error
}

// UpdateFields updates specific columns on a campaign.
func (r *CampaignRepository) UpdateFields(campaignID uuid.UUID, fields map[string]interface{}) error {
	return r.db.Model(&models.Campaign{}).Where("id = ?", campaignID).Updates(fields).Error
}

// Delete removes a campaign by ID, scoped to a user.
func (r *CampaignRepository) Delete(campaignID, userID uuid.UUID) error {
	return r.db.Where("id = ? AND user_id = ?", campaignID, userID).Delete(&models.Campaign{}).Error
}

// CountByUser returns total campaigns for a user.
func (r *CampaignRepository) CountByUser(userID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.Model(&models.Campaign{}).Where("user_id = ?", userID).Count(&count).Error
	return count, err
}

// CountActiveByUser returns active campaigns for a user.
func (r *CampaignRepository) CountActiveByUser(userID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.Model(&models.Campaign{}).Where("user_id = ? AND status = ?", userID, "active").Count(&count).Error
	return count, err
}

// FindAllMetricsByUser returns lightweight campaign metrics for stats aggregation.
func (r *CampaignRepository) FindAllMetricsByUser(userID uuid.UUID) ([]models.Campaign, error) {
	var campaigns []models.Campaign
	err := r.db.Select("total_leads, replied_leads, connection_sent, connection_accepted").
		Where("user_id = ?", userID).Find(&campaigns).Error
	return campaigns, err
}

// IncrementStat atomically increments a stat column on a campaign.
func (r *CampaignRepository) IncrementStat(campaignID uuid.UUID, column string) error {
	return r.db.Model(&models.Campaign{}).
		Where("id = ?", campaignID).
		UpdateColumn(column, gorm.Expr(column+" + 1")).Error
}
