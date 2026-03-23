package repository

import (
	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// NetworkConnectionRepository handles CRUD for the network_connections table.
type NetworkConnectionRepository struct {
	db *gorm.DB
}

func NewNetworkConnectionRepository(db *gorm.DB) *NetworkConnectionRepository {
	return &NetworkConnectionRepository{db: db}
}

// FindAllByUser returns connections with optional filters, preloading LinkedInAccount.
func (r *NetworkConnectionRepository) FindAllByUser(userID uuid.UUID, f models.GetConnectionsFilter) ([]models.NetworkConnection, error) {
	var conns []models.NetworkConnection
	q := r.db.Preload("LinkedInAccount").Where("network_connections.user_id = ?", userID)

	if f.LinkedInAccountID != "" {
		q = q.Where("network_connections.linkedin_account_id = ?", f.LinkedInAccountID)
	}
	if f.ConnectionStatus != "" {
		q = q.Where("network_connections.connection_status = ?", f.ConnectionStatus)
	}
	if f.IsFavorite != nil {
		q = q.Where("network_connections.is_favorite = ?", *f.IsFavorite)
	}
	if f.Search != "" {
		p := "%" + f.Search + "%"
		q = q.Where("(network_connections.full_name ILIKE ? OR network_connections.company ILIKE ? OR network_connections.position ILIKE ? OR network_connections.headline ILIKE ?)",
			p, p, p, p)
	}
	if f.Tags != "" {
		// Tags arrive as comma-separated; use array overlap for text[]
		q = q.Where("network_connections.tags && string_to_array(?, ',')", f.Tags)
	}

	err := q.Order("network_connections.connected_at DESC").Find(&conns).Error
	return conns, err
}

// FindByID returns a single connection owned by the user.
func (r *NetworkConnectionRepository) FindByID(id, userID uuid.UUID) (*models.NetworkConnection, error) {
	var conn models.NetworkConnection
	if err := r.db.Preload("LinkedInAccount").Where("id = ? AND user_id = ?", id, userID).First(&conn).Error; err != nil {
		return nil, err
	}
	return &conn, nil
}

// Create inserts a new network connection.
func (r *NetworkConnectionRepository) Create(conn *models.NetworkConnection) error {
	return r.db.Create(conn).Error
}

// Update persists changes to an existing connection.
func (r *NetworkConnectionRepository) Update(conn *models.NetworkConnection) error {
	return r.db.Save(conn).Error
}

// Delete removes a connection by ID for a given user.
func (r *NetworkConnectionRepository) Delete(id, userID uuid.UUID) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&models.NetworkConnection{}).Error
}

// BulkDelete removes connections matching the given IDs.
func (r *NetworkConnectionRepository) BulkDelete(ids []uuid.UUID, userID uuid.UUID) error {
	if len(ids) == 0 {
		return nil
	}
	return r.db.Where("id IN ? AND user_id = ?", ids, userID).Delete(&models.NetworkConnection{}).Error
}

// BulkUpdateTags sets tags on multiple connections.
func (r *NetworkConnectionRepository) BulkUpdateTags(ids []uuid.UUID, userID uuid.UUID, tags models.StringArray) error {
	if len(ids) == 0 {
		return nil
	}
	return r.db.Model(&models.NetworkConnection{}).
		Where("id IN ? AND user_id = ?", ids, userID).
		Updates(map[string]interface{}{
			"tags": tags,
		}).Error
}

// ── Stats helpers ────────────────────────────────────────────────────────────

// CountConnected returns total connected count for a user.
func (r *NetworkConnectionRepository) CountConnected(userID uuid.UUID) (int64, error) {
	var c int64
	err := r.db.Model(&models.NetworkConnection{}).
		Where("user_id = ? AND connection_status = ?", userID, models.ConnectionStatusConnected).
		Count(&c).Error
	return c, err
}

// CountFavorites returns total favorites for a user.
func (r *NetworkConnectionRepository) CountFavorites(userID uuid.UUID) (int64, error) {
	var c int64
	err := r.db.Model(&models.NetworkConnection{}).
		Where("user_id = ? AND is_favorite = ?", userID, true).
		Count(&c).Error
	return c, err
}
