package repository

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// LeadRepository provides full CRUD and query access to the leads table.
type LeadRepository struct {
	db *gorm.DB
}

func NewLeadRepository(db *gorm.DB) *LeadRepository {
	return &LeadRepository{db: db}
}

// ── Queries ──────────────────────────────────────────────────────────────────

// FindAllByUser returns leads for a user with optional filters.
// Preloads the List association.
func (r *LeadRepository) FindAllByUser(userID uuid.UUID, filter models.GetLeadsFilter) ([]models.Lead, error) {
	var leads []models.Lead
	q := r.db.Preload("List").Where("leads.user_id = ?", userID)

	if filter.ListID != "" {
		q = q.Where("leads.list_id = ?", filter.ListID)
	}
	if filter.Status != "" {
		q = q.Where("leads.status = ?", filter.Status)
	}
	if filter.Search != "" {
		pattern := "%" + filter.Search + "%"
		q = q.Where("(leads.full_name ILIKE ? OR leads.email ILIKE ? OR leads.company ILIKE ?)",
			pattern, pattern, pattern)
	}

	err := q.Order("leads.imported_at DESC").Find(&leads).Error
	return leads, err
}

// FindByListID returns all leads that belong to a given list.
func (r *LeadRepository) FindByListID(listID uuid.UUID) ([]models.Lead, error) {
	var leads []models.Lead
	err := r.db.Where("list_id = ?", listID).Find(&leads).Error
	return leads, err
}

// FindByIDs returns leads matching the given IDs.
func (r *LeadRepository) FindByIDs(ids []uuid.UUID) ([]models.Lead, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	var leads []models.Lead
	err := r.db.Where("id IN ?", ids).Find(&leads).Error
	return leads, err
}

// FindByID returns a single lead by ID.
func (r *LeadRepository) FindByID(id uuid.UUID) (*models.Lead, error) {
	var lead models.Lead
	if err := r.db.Where("id = ?", id).First(&lead).Error; err != nil {
		return nil, err
	}
	return &lead, nil
}

// FindByIDAndUser returns a single lead owned by the given user.
func (r *LeadRepository) FindByIDAndUser(id, userID uuid.UUID) (*models.Lead, error) {
	var lead models.Lead
	if err := r.db.Preload("List").Where("id = ? AND user_id = ?", id, userID).First(&lead).Error; err != nil {
		return nil, err
	}
	return &lead, nil
}

// FindByLinkedInURLInList checks for an existing lead with the same LinkedIn URL in a list.
func (r *LeadRepository) FindByLinkedInURLInList(userID, listID uuid.UUID, linkedInURL string) (*models.Lead, error) {
	var lead models.Lead
	err := r.db.Where("user_id = ? AND list_id = ? AND linkedin_url = ?", userID, listID, linkedInURL).
		First(&lead).Error
	if err != nil {
		return nil, err
	}
	return &lead, nil
}

// FindByFullNameInList checks for an existing lead with the same full name in a list.
func (r *LeadRepository) FindByFullNameInList(userID, listID uuid.UUID, fullName string) (*models.Lead, error) {
	var lead models.Lead
	err := r.db.Where("user_id = ? AND list_id = ? AND full_name = ?", userID, listID, fullName).
		First(&lead).Error
	if err != nil {
		return nil, err
	}
	return &lead, nil
}

// ── Mutations ────────────────────────────────────────────────────────────────

// Create inserts a single lead.
func (r *LeadRepository) Create(lead *models.Lead) error {
	return r.db.Create(lead).Error
}

// BulkCreate inserts many leads in a single statement.
func (r *LeadRepository) BulkCreate(leads []models.Lead) error {
	if len(leads) == 0 {
		return nil
	}
	return r.db.Create(&leads).Error
}

// Update persists changes to an existing lead.
func (r *LeadRepository) Update(lead *models.Lead) error {
	return r.db.Save(lead).Error
}

// Delete removes a lead by ID for a given user.
func (r *LeadRepository) Delete(id, userID uuid.UUID) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&models.Lead{}).Error
}

// BulkDelete removes leads matching the given IDs for a user.
func (r *LeadRepository) BulkDelete(ids []uuid.UUID, userID uuid.UUID) error {
	if len(ids) == 0 {
		return nil
	}
	return r.db.Where("id IN ? AND user_id = ?", ids, userID).Delete(&models.Lead{}).Error
}

// BulkUpdateStatus updates the status of multiple leads.
func (r *LeadRepository) BulkUpdateStatus(ids []uuid.UUID, userID uuid.UUID, status models.LeadStatus) error {
	if len(ids) == 0 {
		return nil
	}
	return r.db.Model(&models.Lead{}).
		Where("id IN ? AND user_id = ?", ids, userID).
		Update("status", status).Error
}

// DeleteByListID removes all leads in a list (used when deleting a list).
func (r *LeadRepository) DeleteByListID(listID, userID uuid.UUID) error {
	return r.db.Where("list_id = ? AND user_id = ?", listID, userID).Delete(&models.Lead{}).Error
}

// CountByListID returns the number of leads in a list.
func (r *LeadRepository) CountByListID(listID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.Model(&models.Lead{}).Where("list_id = ?", listID).Count(&count).Error
	return count, err
}

// IsBeingContactedInOtherCampaign checks if a lead is enrolled in another active campaign.
func (r *LeadRepository) IsBeingContactedInOtherCampaign(leadID, excludeCampaignID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.Model(&models.CampaignLead{}).
		Joins("JOIN campaigns ON campaigns.id = campaign_leads.campaign_id").
		Where("campaign_leads.lead_id = ?", leadID).
		Where("campaign_leads.campaign_id != ?", excludeCampaignID).
		Where("campaigns.status = ?", "active").
		Where("campaign_leads.status IN ?", []string{"pending", "in_progress"}).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// UpdateAIIcebreaker sets the ai_icebreaker field on a lead.
func (r *LeadRepository) UpdateAIIcebreaker(leadID uuid.UUID, icebreaker string) error {
	return r.db.Model(&models.Lead{}).Where("id = ?", leadID).
		Update("ai_icebreaker", icebreaker).Error
}

// AffectedListIDs returns distinct list IDs for the given lead IDs (for count refresh).
func (r *LeadRepository) AffectedListIDs(leadIDs []uuid.UUID) ([]uuid.UUID, error) {
	if len(leadIDs) == 0 {
		return nil, nil
	}
	var ids []uuid.UUID
	err := r.db.Model(&models.Lead{}).
		Where("id IN ?", leadIDs).
		Distinct("list_id").
		Pluck("list_id", &ids).Error
	if err != nil {
		return nil, fmt.Errorf("pluck list_id: %w", err)
	}
	return ids, err
}
