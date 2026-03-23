package service

import (
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"github.com/reach/backend/internal/repository"
	"gorm.io/gorm"
)

// NetworkSyncer is an interface for the actual LinkedIn sync engine.
// Provide a real implementation to perform browser-based scraping; nil = no-op.
type NetworkSyncer interface {
	Sync(sessionCookies models.JSONB, linkedinAccountID string, userID string, syncType string) (*models.NetworkSyncResult, error)
}

// NetworkService encapsulates all business logic for My Network.
type NetworkService struct {
	connRepo    *repository.NetworkConnectionRepository
	reqRepo     *repository.ConnectionRequestRepository
	syncLogRepo *repository.NetworkSyncLogRepository
	accountRepo *repository.LinkedInAccountRepository
	syncer      NetworkSyncer // nil = not wired yet
}

func NewNetworkService(
	connRepo *repository.NetworkConnectionRepository,
	reqRepo *repository.ConnectionRequestRepository,
	syncLogRepo *repository.NetworkSyncLogRepository,
	accountRepo *repository.LinkedInAccountRepository,
	syncer NetworkSyncer,
) *NetworkService {
	return &NetworkService{
		connRepo:    connRepo,
		reqRepo:     reqRepo,
		syncLogRepo: syncLogRepo,
		accountRepo: accountRepo,
		syncer:      syncer,
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTIONS — Query
// ═══════════════════════════════════════════════════════════════════════════════

// GetConnections returns connections with optional filters.
func (s *NetworkService) GetConnections(userID uuid.UUID, f models.GetConnectionsFilter) ([]models.NetworkConnection, error) {
	return s.connRepo.FindAllByUser(userID, f)
}

// GetConnectionByID returns a single connection.
func (s *NetworkService) GetConnectionByID(id, userID uuid.UUID) (*models.NetworkConnection, error) {
	return s.connRepo.FindByID(id, userID)
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTIONS — Mutation
// ═══════════════════════════════════════════════════════════════════════════════

// CreateConnection inserts a new network connection.
func (s *NetworkService) CreateConnection(userID uuid.UUID, req models.CreateConnectionRequest) (*models.NetworkConnection, error) {
	accountID, err := uuid.Parse(req.LinkedInAccountID)
	if err != nil {
		return nil, errors.New("invalid linkedin_account_id")
	}

	var connectedAt *time.Time
	if req.ConnectedAt != nil && *req.ConnectedAt != "" {
		t, err := time.Parse(time.RFC3339, *req.ConnectedAt)
		if err == nil {
			connectedAt = &t
		}
	}
	if connectedAt == nil {
		now := time.Now()
		connectedAt = &now
	}

	conn := models.NetworkConnection{
		UserID:                userID,
		LinkedInAccountID:     accountID,
		ConnectionLinkedInURL: req.ConnectionLinkedInURL,
		ConnectionProfileID:   req.ConnectionProfileID,
		FirstName:             req.FirstName,
		LastName:              req.LastName,
		FullName:              req.FullName,
		Headline:              req.Headline,
		ProfilePictureURL:     req.ProfilePictureURL,
		Location:              req.Location,
		Company:               req.Company,
		Position:              req.Position,
		ConnectionStatus:      models.ConnectionStatusConnected,
		ConnectedAt:           connectedAt,
		Tags:                  req.Tags,
		Notes:                 req.Notes,
	}

	if err := s.connRepo.Create(&conn); err != nil {
		return nil, err
	}
	return &conn, nil
}

// UpdateConnection modifies an existing connection.
func (s *NetworkService) UpdateConnection(id, userID uuid.UUID, dto models.UpdateConnectionDTO) (*models.NetworkConnection, error) {
	conn, err := s.connRepo.FindByID(id, userID)
	if err != nil {
		return nil, err
	}

	if dto.FirstName != nil {
		conn.FirstName = dto.FirstName
	}
	if dto.LastName != nil {
		conn.LastName = dto.LastName
	}
	if dto.FullName != nil {
		conn.FullName = dto.FullName
	}
	if dto.Headline != nil {
		conn.Headline = dto.Headline
	}
	if dto.ProfilePictureURL != nil {
		conn.ProfilePictureURL = dto.ProfilePictureURL
	}
	if dto.Location != nil {
		conn.Location = dto.Location
	}
	if dto.Company != nil {
		conn.Company = dto.Company
	}
	if dto.Position != nil {
		conn.Position = dto.Position
	}
	if dto.ConnectionStatus != nil {
		conn.ConnectionStatus = *dto.ConnectionStatus
	}
	if dto.Tags != nil {
		conn.Tags = *dto.Tags
	}
	if dto.Notes != nil {
		conn.Notes = dto.Notes
	}
	if dto.IsFavorite != nil {
		conn.IsFavorite = *dto.IsFavorite
	}
	if dto.ConnectionLinkedInURL != nil {
		conn.ConnectionLinkedInURL = dto.ConnectionLinkedInURL
	}
	if dto.ConnectionProfileID != nil {
		conn.ConnectionProfileID = dto.ConnectionProfileID
	}

	conn.UpdatedAt = time.Now()

	if err := s.connRepo.Update(conn); err != nil {
		return nil, err
	}
	return conn, nil
}

// DeleteConnection removes a connection.
func (s *NetworkService) DeleteConnection(id, userID uuid.UUID) error {
	return s.connRepo.Delete(id, userID)
}

// ToggleFavorite sets the is_favorite flag on a connection.
func (s *NetworkService) ToggleFavorite(id, userID uuid.UUID, isFavorite bool) (*models.NetworkConnection, error) {
	conn, err := s.connRepo.FindByID(id, userID)
	if err != nil {
		return nil, err
	}
	conn.IsFavorite = isFavorite
	conn.UpdatedAt = time.Now()
	if err := s.connRepo.Update(conn); err != nil {
		return nil, err
	}
	return conn, nil
}

// BulkDeleteConnections removes multiple connections.
func (s *NetworkService) BulkDeleteConnections(userID uuid.UUID, req models.BulkConnectionIDsRequest) error {
	ids, err := parseUUIDs(req.ConnectionIDs)
	if err != nil {
		return err
	}
	return s.connRepo.BulkDelete(ids, userID)
}

// BulkUpdateConnectionTags sets tags on multiple connections.
func (s *NetworkService) BulkUpdateConnectionTags(userID uuid.UUID, req models.BulkUpdateTagsRequest) error {
	ids, err := parseUUIDs(req.ConnectionIDs)
	if err != nil {
		return err
	}
	return s.connRepo.BulkUpdateTags(ids, userID, req.Tags)
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTION REQUESTS — Query
// ═══════════════════════════════════════════════════════════════════════════════

// GetConnectionRequests returns requests with optional filters.
func (s *NetworkService) GetConnectionRequests(userID uuid.UUID, f models.GetConnectionRequestsFilter) ([]models.ConnectionRequest, error) {
	return s.reqRepo.FindAllByUser(userID, f)
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTION REQUESTS — Mutation
// ═══════════════════════════════════════════════════════════════════════════════

// CreateConnectionReq creates a new connection request.
func (s *NetworkService) CreateConnectionReq(userID uuid.UUID, dto models.CreateConnReqDTO) (*models.ConnectionRequest, error) {
	accountID, err := uuid.Parse(dto.LinkedInAccountID)
	if err != nil {
		return nil, errors.New("invalid linkedin_account_id")
	}

	now := time.Now()
	targetURL := dto.TargetLinkedInURL

	var campaignID *uuid.UUID
	if dto.CampaignID != nil && *dto.CampaignID != "" {
		id, err := uuid.Parse(*dto.CampaignID)
		if err == nil {
			campaignID = &id
		}
	}

	isAutomated := false
	if dto.IsAutomated != nil {
		isAutomated = *dto.IsAutomated
	}

	req := models.ConnectionRequest{
		UserID:            userID,
		LinkedInAccountID: accountID,
		TargetLinkedInURL: &targetURL,
		TargetProfileID:   dto.TargetProfileID,
		FirstName:         dto.FirstName,
		LastName:          dto.LastName,
		FullName:          dto.FullName,
		Headline:          dto.Headline,
		ProfilePictureURL: dto.ProfilePictureURL,
		Location:          dto.Location,
		Company:           dto.Company,
		Position:          dto.Position,
		RequestType:       models.RequestType(dto.RequestType),
		RequestStatus:     models.RequestStatusPending,
		Message:           dto.Message,
		SentAt:            &now,
		CampaignID:        campaignID,
		IsAutomated:       isAutomated,
	}

	if err := s.reqRepo.Create(&req); err != nil {
		return nil, err
	}
	return &req, nil
}

// UpdateConnectionReq updates a connection request.
func (s *NetworkService) UpdateConnectionReq(id, userID uuid.UUID, dto models.UpdateConnReqDTO) (*models.ConnectionRequest, error) {
	req, err := s.reqRepo.FindByID(id, userID)
	if err != nil {
		return nil, err
	}

	if dto.RequestStatus != nil {
		req.RequestStatus = *dto.RequestStatus
	}
	if dto.RespondedAt != nil && *dto.RespondedAt != "" {
		t, err := time.Parse(time.RFC3339, *dto.RespondedAt)
		if err == nil {
			req.RespondedAt = &t
		}
	}
	if dto.Message != nil {
		req.Message = dto.Message
	}

	req.UpdatedAt = time.Now()

	if err := s.reqRepo.Update(req); err != nil {
		return nil, err
	}
	return req, nil
}

// AcceptConnectionRequest marks a request as accepted and creates a network connection.
func (s *NetworkService) AcceptConnectionRequest(id, userID uuid.UUID) (*models.ConnectionRequest, error) {
	req, err := s.reqRepo.FindByID(id, userID)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	req.RequestStatus = models.RequestStatusAccepted
	req.RespondedAt = &now
	req.UpdatedAt = now

	if err := s.reqRepo.Update(req); err != nil {
		return nil, err
	}

	// Create the network connection from the request details
	conn := models.NetworkConnection{
		UserID:                userID,
		LinkedInAccountID:     req.LinkedInAccountID,
		ConnectionLinkedInURL: req.TargetLinkedInURL,
		ConnectionProfileID:   req.TargetProfileID,
		FirstName:             req.FirstName,
		LastName:              req.LastName,
		FullName:              req.FullName,
		Headline:              req.Headline,
		ProfilePictureURL:     req.ProfilePictureURL,
		Location:              req.Location,
		Company:               req.Company,
		Position:              req.Position,
		ConnectionStatus:      models.ConnectionStatusConnected,
		ConnectedAt:           &now,
	}
	// Best-effort — if insert fails (e.g. duplicate), we still return the updated request.
	_ = s.connRepo.Create(&conn)

	return req, nil
}

// WithdrawConnectionRequest marks a request as withdrawn.
func (s *NetworkService) WithdrawConnectionRequest(id, userID uuid.UUID) (*models.ConnectionRequest, error) {
	now := time.Now()
	nowStr := now.Format(time.RFC3339)
	status := models.RequestStatusWithdrawn
	return s.UpdateConnectionReq(id, userID, models.UpdateConnReqDTO{
		RequestStatus: &status,
		RespondedAt:   &nowStr,
	})
}

// DeleteConnectionRequest removes a request.
func (s *NetworkService) DeleteConnectionRequest(id, userID uuid.UUID) error {
	return s.reqRepo.Delete(id, userID)
}

// BulkWithdrawRequests withdraws multiple requests at once.
func (s *NetworkService) BulkWithdrawRequests(userID uuid.UUID, req models.BulkRequestIDsRequest) error {
	ids, err := parseUUIDs(req.RequestIDs)
	if err != nil {
		return err
	}
	respondedAt := time.Now().Format(time.RFC3339)
	return s.reqRepo.BulkUpdateStatus(ids, userID, models.RequestStatusWithdrawn, respondedAt)
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════════════════

// GetConnectionStats returns aggregate stats for the user's network.
func (s *NetworkService) GetConnectionStats(userID uuid.UUID) (*models.ConnectionStatsResponse, error) {
	total, err := s.connRepo.CountConnected(userID)
	if err != nil {
		return nil, err
	}
	pendingSent, err := s.reqRepo.CountPendingSent(userID)
	if err != nil {
		return nil, err
	}
	pendingReceived, err := s.reqRepo.CountPendingReceived(userID)
	if err != nil {
		return nil, err
	}
	favorites, err := s.connRepo.CountFavorites(userID)
	if err != nil {
		return nil, err
	}
	return &models.ConnectionStatsResponse{
		TotalConnections: int(total),
		PendingSent:      int(pendingSent),
		PendingReceived:  int(pendingReceived),
		Favorites:        int(favorites),
	}, nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// NETWORK SYNC
// ═══════════════════════════════════════════════════════════════════════════════

// SyncNetworkFromLinkedIn initiates a network sync for a LinkedIn account.
func (s *NetworkService) SyncNetworkFromLinkedIn(userID uuid.UUID, req models.StartSyncRequest) (map[string]interface{}, error) {
	accountID, err := uuid.Parse(req.LinkedInAccountID)
	if err != nil {
		return nil, errors.New("invalid linkedin_account_id")
	}

	syncType := models.SyncType(req.SyncType)
	if syncType == "" {
		syncType = models.SyncTypeFull
	}

	// Create sync log
	now := time.Now()
	syncLog := models.NetworkSyncLog{
		UserID:            userID,
		LinkedInAccountID: accountID,
		SyncType:          syncType,
		SyncStatus:        models.SyncStatusInProgress,
		StartedAt:         now,
	}
	if err := s.syncLogRepo.Create(&syncLog); err != nil {
		return nil, err
	}

	// Get LinkedIn account & validate
	account, err := s.accountRepo.FindByIDAndUser(accountID, userID)
	if err != nil {
		s.markSyncFailed(&syncLog, "LinkedIn account not found or unauthorized")
		return nil, errors.New("LinkedIn account not found or unauthorized")
	}
	if account.Status != "active" {
		s.markSyncFailed(&syncLog, "LinkedIn account is not active. Please reconnect your account.")
		return nil, errors.New("LinkedIn account is not active. Please reconnect your account.")
	}
	liAt, _ := account.SessionCookies["li_at"].(string)
	if liAt == "" {
		s.markSyncFailed(&syncLog, "No valid session found. Please reconnect your account.")
		return nil, errors.New("No valid session found. Please reconnect your account.")
	}

	// Invoke the actual sync engine
	if s.syncer == nil {
		s.markSyncFailed(&syncLog, "Network sync engine not configured")
		return nil, errors.New("network sync engine not configured")
	}

	results, err := s.syncer.Sync(
		account.SessionCookies,
		accountID.String(),
		userID.String(),
		string(syncType),
	)
	if err != nil {
		s.markSyncFailed(&syncLog, err.Error())
		return nil, err
	}

	// Update sync log as completed
	completedAt := time.Now()
	duration := int(math.Floor(completedAt.Sub(syncLog.StartedAt).Seconds()))
	syncLog.SyncStatus = models.SyncStatusCompleted
	syncLog.CompletedAt = &completedAt
	syncLog.DurationSeconds = &duration
	syncLog.TotalConnectionsSynced = results.TotalConnectionsSynced
	syncLog.NewConnectionsAdded = results.NewConnectionsAdded
	syncLog.ConnectionsUpdated = results.ConnectionsUpdated
	syncLog.TotalRequestsSynced = results.TotalRequestsSynced
	syncLog.PendingRequests = results.PendingRequests
	syncLog.AcceptedRequests = results.AcceptedRequests
	_ = s.syncLogRepo.Update(&syncLog)

	return map[string]interface{}{
		"success":   true,
		"syncLogId": syncLog.ID,
		"results":   results,
	}, nil
}

func (s *NetworkService) markSyncFailed(syncLog *models.NetworkSyncLog, msg string) {
	now := time.Now()
	syncLog.SyncStatus = models.SyncStatusFailed
	syncLog.ErrorMessage = &msg
	syncLog.CompletedAt = &now
	_ = s.syncLogRepo.Update(syncLog)
}

// GetSyncLogs returns sync logs with optional account filter.
func (s *NetworkService) GetSyncLogs(userID uuid.UUID, accountIDStr string) ([]models.NetworkSyncLog, error) {
	var accountID *uuid.UUID
	if accountIDStr != "" {
		id, err := uuid.Parse(accountIDStr)
		if err == nil {
			accountID = &id
		}
	}
	return s.syncLogRepo.FindAllByUser(userID, accountID)
}

// GetLatestSyncLog returns the most recent sync log for an account.
func (s *NetworkService) GetLatestSyncLog(userID uuid.UUID, accountIDStr string) (*models.NetworkSyncLog, error) {
	accountID, err := uuid.Parse(accountIDStr)
	if err != nil {
		return nil, errors.New("invalid linkedin_account_id")
	}
	log, err := s.syncLogRepo.FindLatest(userID, accountID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil // no log yet
		}
		return nil, err
	}
	return log, nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

// GetNetworkAnalytics returns network analytics optionally scoped to an account.
func (s *NetworkService) GetNetworkAnalytics(userID uuid.UUID, accountIDStr string) (*models.NetworkAnalyticsResponse, error) {
	var accountID *uuid.UUID
	if accountIDStr != "" {
		id, err := uuid.Parse(accountIDStr)
		if err == nil {
			accountID = &id
		}
	}

	totalConnections, err := s.reqRepo.CountConnectedByAccount(userID, accountID)
	if err != nil {
		return nil, err
	}

	requests, err := s.reqRepo.FindAllByUserForAnalytics(userID, accountID)
	if err != nil {
		return nil, err
	}

	pendingSent := 0
	accepted := 0
	declined := 0
	for _, r := range requests {
		if r.RequestType == models.RequestTypeSent && r.RequestStatus == models.RequestStatusPending {
			pendingSent++
		}
		if r.RequestStatus == models.RequestStatusAccepted {
			accepted++
		}
		if r.RequestStatus == models.RequestStatusDeclined {
			declined++
		}
	}

	acceptanceRate := "0"
	total := accepted + declined
	if total > 0 {
		acceptanceRate = fmt.Sprintf("%.1f", float64(accepted)/float64(total)*100)
	}

	return &models.NetworkAnalyticsResponse{
		TotalConnections: int(totalConnections),
		PendingSent:      pendingSent,
		AcceptedRequests: accepted,
		DeclinedRequests: declined,
		AcceptanceRate:   acceptanceRate,
	}, nil
}
