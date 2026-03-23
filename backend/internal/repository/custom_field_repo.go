package repository

import (
	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// CustomFieldRepository handles CRUD for the custom_fields table.
type CustomFieldRepository struct {
	db *gorm.DB
}

func NewCustomFieldRepository(db *gorm.DB) *CustomFieldRepository {
	return &CustomFieldRepository{db: db}
}

// FindAllByUser returns all custom fields for a user, ordered by creation date.
func (r *CustomFieldRepository) FindAllByUser(userID uuid.UUID) ([]models.CustomField, error) {
	var fields []models.CustomField
	err := r.db.Where("user_id = ?", userID).
		Order("created_at ASC").
		Find(&fields).Error
	return fields, err
}

// FindByID returns a single custom field owned by the given user.
func (r *CustomFieldRepository) FindByID(id, userID uuid.UUID) (*models.CustomField, error) {
	var field models.CustomField
	if err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&field).Error; err != nil {
		return nil, err
	}
	return &field, nil
}

// Create inserts a new custom field.
func (r *CustomFieldRepository) Create(field *models.CustomField) error {
	return r.db.Create(field).Error
}

// Update persists changes to a custom field.
func (r *CustomFieldRepository) Update(field *models.CustomField) error {
	return r.db.Save(field).Error
}

// Delete removes a custom field.
func (r *CustomFieldRepository) Delete(id, userID uuid.UUID) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&models.CustomField{}).Error
}
