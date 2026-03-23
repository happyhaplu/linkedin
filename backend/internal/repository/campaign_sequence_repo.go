package repository

import (
	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// CampaignSequenceRepository handles campaign sequence DB operations.
type CampaignSequenceRepository struct {
	db *gorm.DB
}

func NewCampaignSequenceRepository(db *gorm.DB) *CampaignSequenceRepository {
	return &CampaignSequenceRepository{db: db}
}

// FindByCampaignID returns all sequences for a campaign, ordered by step_number.
func (r *CampaignSequenceRepository) FindByCampaignID(campaignID uuid.UUID) ([]models.CampaignSequence, error) {
	var seqs []models.CampaignSequence
	err := r.db.Where("campaign_id = ?", campaignID).Order("step_number ASC").Find(&seqs).Error
	return seqs, err
}

// FindByID returns a single sequence by ID.
func (r *CampaignSequenceRepository) FindByID(seqID uuid.UUID) (*models.CampaignSequence, error) {
	var s models.CampaignSequence
	if err := r.db.Where("id = ?", seqID).First(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

// Create inserts campaign sequences.
func (r *CampaignSequenceRepository) Create(seqs []models.CampaignSequence) error {
	if len(seqs) == 0 {
		return nil
	}
	return r.db.Create(&seqs).Error
}

// Update saves changes to a sequence.
func (r *CampaignSequenceRepository) Update(seq *models.CampaignSequence) error {
	return r.db.Save(seq).Error
}

// UpdateFields updates specific columns on a sequence.
func (r *CampaignSequenceRepository) UpdateFields(seqID uuid.UUID, fields map[string]interface{}) error {
	return r.db.Model(&models.CampaignSequence{}).Where("id = ?", seqID).Updates(fields).Error
}

// DeleteByCampaignID removes all sequences for a campaign.
func (r *CampaignSequenceRepository) DeleteByCampaignID(campaignID uuid.UUID) error {
	return r.db.Where("campaign_id = ?", campaignID).Delete(&models.CampaignSequence{}).Error
}

// FindNextSteps returns remaining steps after a given step_number for a campaign.
func (r *CampaignSequenceRepository) FindNextSteps(campaignID uuid.UUID, afterStepNumber int) ([]models.CampaignSequence, error) {
	var seqs []models.CampaignSequence
	err := r.db.Where("campaign_id = ? AND step_number > ?", campaignID, afterStepNumber).
		Order("step_number ASC").Find(&seqs).Error
	return seqs, err
}

// FindFirstStep returns the first step of a campaign sequence.
func (r *CampaignSequenceRepository) FindFirstStep(campaignID uuid.UUID) (*models.CampaignSequence, error) {
	var s models.CampaignSequence
	err := r.db.Where("campaign_id = ?", campaignID).Order("step_number ASC").First(&s).Error
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// FindABTestSteps returns sequences with A/B testing enabled.
func (r *CampaignSequenceRepository) FindABTestSteps(campaignID uuid.UUID) ([]models.CampaignSequence, error) {
	var seqs []models.CampaignSequence
	err := r.db.Where("campaign_id = ? AND ab_test_enabled = ?", campaignID, true).
		Order("step_number ASC").Find(&seqs).Error
	return seqs, err
}
