package repository

import (
	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// LeadListRepository handles CRUD for the "lists" table.
type LeadListRepository struct {
	db *gorm.DB
}

func NewLeadListRepository(db *gorm.DB) *LeadListRepository {
	return &LeadListRepository{db: db}
}

// FindAllByUser returns all lists belonging to a user, ordered newest first.
func (r *LeadListRepository) FindAllByUser(userID uuid.UUID) ([]models.LeadList, error) {
	var lists []models.LeadList
	err := r.db.Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&lists).Error
	return lists, err
}

// FindByID returns a single list owned by the given user.
func (r *LeadListRepository) FindByID(id, userID uuid.UUID) (*models.LeadList, error) {
	var list models.LeadList
	if err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&list).Error; err != nil {
		return nil, err
	}
	return &list, nil
}

// FindByName returns a list matching an exact name for a user.
func (r *LeadListRepository) FindByName(userID uuid.UUID, name string) (*models.LeadList, error) {
	var list models.LeadList
	if err := r.db.Where("user_id = ? AND name = ?", userID, name).First(&list).Error; err != nil {
		return nil, err
	}
	return &list, nil
}

// Create inserts a new list.
func (r *LeadListRepository) Create(list *models.LeadList) error {
	return r.db.Create(list).Error
}

// Update persists changes to an existing list.
func (r *LeadListRepository) Update(list *models.LeadList) error {
	return r.db.Save(list).Error
}

// Delete removes a list. Leads should cascade-delete via DB FK or be handled by service.
func (r *LeadListRepository) Delete(id, userID uuid.UUID) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&models.LeadList{}).Error
}

// UpdateLeadCount recalculates the lead_count for a list.
func (r *LeadListRepository) UpdateLeadCount(listID uuid.UUID) error {
	var count int64
	if err := r.db.Model(&models.Lead{}).Where("list_id = ?", listID).Count(&count).Error; err != nil {
		return err
	}
	return r.db.Model(&models.LeadList{}).Where("id = ?", listID).
		Update("lead_count", count).Error
}
