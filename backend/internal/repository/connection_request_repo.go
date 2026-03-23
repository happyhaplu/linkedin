package repository

import (
	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// ConnectionRequestRepository handles CRUD for the connection_requests table.
type ConnectionRequestRepository struct {
	db *gorm.DB
}

func NewConnectionRequestRepository(db *gorm.DB) *ConnectionRequestRepository {
	return &ConnectionRequestRepository{db: db}
}

// FindAllByUser returns connection requests with optional filters.
func (r *ConnectionRequestRepository) FindAllByUser(userID uuid.UUID, f models.GetConnectionRequestsFilter) ([]models.ConnectionRequest, error) {
	var reqs []models.ConnectionRequest
	q := r.db.Preload("LinkedInAccount").Where("connection_requests.user_id = ?", userID)

	if f.LinkedInAccountID != "" {
		q = q.Where("connection_requests.linkedin_account_id = ?", f.LinkedInAccountID)
	}
	if f.RequestType != "" {
		q = q.Where("connection_requests.request_type = ?", f.RequestType)
	}
	if f.RequestStatus != "" {
		q = q.Where("connection_requests.request_status = ?", f.RequestStatus)
	}
	if f.Search != "" {
		p := "%" + f.Search + "%"
		q = q.Where("(connection_requests.full_name ILIKE ? OR connection_requests.company ILIKE ? OR connection_requests.position ILIKE ?)",
			p, p, p)
	}

	err := q.Order("connection_requests.sent_at DESC").Find(&reqs).Error
	return reqs, err
}

// FindByID returns a single request owned by the user.
func (r *ConnectionRequestRepository) FindByID(id, userID uuid.UUID) (*models.ConnectionRequest, error) {
	var req models.ConnectionRequest
	if err := r.db.Preload("LinkedInAccount").Where("id = ? AND user_id = ?", id, userID).First(&req).Error; err != nil {
		return nil, err
	}
	return &req, nil
}

// Create inserts a new connection request.
func (r *ConnectionRequestRepository) Create(req *models.ConnectionRequest) error {
	return r.db.Create(req).Error
}

// Update persists changes to a connection request.
func (r *ConnectionRequestRepository) Update(req *models.ConnectionRequest) error {
	return r.db.Save(req).Error
}

// Delete removes a request.
func (r *ConnectionRequestRepository) Delete(id, userID uuid.UUID) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&models.ConnectionRequest{}).Error
}

// BulkUpdateStatus sets request_status + responded_at on multiple requests.
func (r *ConnectionRequestRepository) BulkUpdateStatus(ids []uuid.UUID, userID uuid.UUID, status models.RequestStatus, respondedAt string) error {
	if len(ids) == 0 {
		return nil
	}
	return r.db.Model(&models.ConnectionRequest{}).
		Where("id IN ? AND user_id = ?", ids, userID).
		Updates(map[string]interface{}{
			"request_status": status,
			"responded_at":   respondedAt,
		}).Error
}

// ── Stats helpers ────────────────────────────────────────────────────────────

// CountPendingSent returns pending sent requests for a user.
func (r *ConnectionRequestRepository) CountPendingSent(userID uuid.UUID) (int64, error) {
	var c int64
	err := r.db.Model(&models.ConnectionRequest{}).
		Where("user_id = ? AND request_type = ? AND request_status = ?",
			userID, models.RequestTypeSent, models.RequestStatusPending).
		Count(&c).Error
	return c, err
}

// CountPendingReceived returns pending received requests for a user.
func (r *ConnectionRequestRepository) CountPendingReceived(userID uuid.UUID) (int64, error) {
	var c int64
	err := r.db.Model(&models.ConnectionRequest{}).
		Where("user_id = ? AND request_type = ? AND request_status = ?",
			userID, models.RequestTypeReceived, models.RequestStatusPending).
		Count(&c).Error
	return c, err
}

// FindAllByUserForAnalytics returns all requests for analytics (filtered by account if provided).
func (r *ConnectionRequestRepository) FindAllByUserForAnalytics(userID uuid.UUID, accountID *uuid.UUID) ([]models.ConnectionRequest, error) {
	var reqs []models.ConnectionRequest
	q := r.db.Where("user_id = ?", userID)
	if accountID != nil {
		q = q.Where("linkedin_account_id = ?", *accountID)
	}
	err := q.Find(&reqs).Error
	return reqs, err
}

// CountConnectedByAccount returns total connected count scoped to an optional account.
func (r *ConnectionRequestRepository) CountConnectedByAccount(userID uuid.UUID, accountID *uuid.UUID) (int64, error) {
	var c int64
	q := r.db.Model(&models.NetworkConnection{}).
		Where("user_id = ? AND connection_status = ?", userID, models.ConnectionStatusConnected)
	if accountID != nil {
		q = q.Where("linkedin_account_id = ?", *accountID)
	}
	err := q.Count(&c).Error
	return c, err
}
