package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ──────────────────────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────────────────────

type ConnectionStatus string

const (
	ConnectionStatusConnected ConnectionStatus = "connected"
	ConnectionStatusPending   ConnectionStatus = "pending"
	ConnectionStatusWithdrawn ConnectionStatus = "withdrawn"
	ConnectionStatusIgnored   ConnectionStatus = "ignored"
)

type RequestType string

const (
	RequestTypeSent     RequestType = "sent"
	RequestTypeReceived RequestType = "received"
)

type RequestStatus string

const (
	RequestStatusPending   RequestStatus = "pending"
	RequestStatusAccepted  RequestStatus = "accepted"
	RequestStatusDeclined  RequestStatus = "declined"
	RequestStatusWithdrawn RequestStatus = "withdrawn"
	RequestStatusExpired   RequestStatus = "expired"
)

type SyncType string

const (
	SyncTypeFull               SyncType = "full"
	SyncTypeIncremental        SyncType = "incremental"
	SyncTypeConnectionRequests SyncType = "connection_requests"
)

type SyncStatus string

const (
	SyncStatusInProgress SyncStatus = "in_progress"
	SyncStatusCompleted  SyncStatus = "completed"
	SyncStatusFailed     SyncStatus = "failed"
	SyncStatusPartial    SyncStatus = "partial"
)

// ──────────────────────────────────────────────────────────────────────────────
// NetworkConnection
// ──────────────────────────────────────────────────────────────────────────────

type NetworkConnection struct {
	ID                uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID            uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	LinkedInAccountID uuid.UUID `gorm:"column:linkedin_account_id;type:uuid;not null;index" json:"linkedin_account_id"`

	// Connection Details
	ConnectionLinkedInURL *string `gorm:"column:connection_linkedin_url;type:text" json:"connection_linkedin_url,omitempty"`
	ConnectionProfileID   *string `gorm:"type:text" json:"connection_profile_id,omitempty"`
	FirstName             *string `gorm:"type:text" json:"first_name,omitempty"`
	LastName              *string `gorm:"type:text" json:"last_name,omitempty"`
	FullName              *string `gorm:"type:text" json:"full_name,omitempty"`
	Headline              *string `gorm:"type:text" json:"headline,omitempty"`
	ProfilePictureURL     *string `gorm:"type:text" json:"profile_picture_url,omitempty"`
	Location              *string `gorm:"type:text" json:"location,omitempty"`
	Company               *string `gorm:"type:text" json:"company,omitempty"`
	Position              *string `gorm:"type:text" json:"position,omitempty"`

	// Connection Metadata
	ConnectionStatus       ConnectionStatus `gorm:"type:text;default:'connected'" json:"connection_status"`
	ConnectedAt            *time.Time       `gorm:"type:timestamptz" json:"connected_at,omitempty"`
	MutualConnectionsCount int              `gorm:"type:integer;default:0" json:"mutual_connections_count"`

	// Tags and Notes
	Tags       StringArray `gorm:"type:text[]" json:"tags,omitempty"`
	Notes      *string     `gorm:"type:text" json:"notes,omitempty"`
	IsFavorite bool        `gorm:"type:boolean;default:false" json:"is_favorite"`

	// Sync Information
	LastSyncedAt *time.Time `gorm:"type:timestamptz" json:"last_synced_at,omitempty"`
	IsSynced     bool       `gorm:"type:boolean;default:false" json:"is_synced"`

	// Timestamps
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Relations
	LinkedInAccount *LinkedInAccount `gorm:"foreignKey:LinkedInAccountID;references:ID" json:"linkedin_account,omitempty"`
}

func (NetworkConnection) TableName() string { return "network_connections" }

func (nc *NetworkConnection) BeforeCreate(tx *gorm.DB) error {
	if nc.ID == uuid.Nil {
		nc.ID = uuid.New()
	}
	return nil
}

// ──────────────────────────────────────────────────────────────────────────────
// ConnectionRequest
// ──────────────────────────────────────────────────────────────────────────────

type ConnectionRequest struct {
	ID                uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID            uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	LinkedInAccountID uuid.UUID `gorm:"column:linkedin_account_id;type:uuid;not null;index" json:"linkedin_account_id"`

	// Request Details
	TargetLinkedInURL *string `gorm:"column:target_linkedin_url;type:text" json:"target_linkedin_url,omitempty"`
	TargetProfileID   *string `gorm:"type:text" json:"target_profile_id,omitempty"`
	FirstName         *string `gorm:"type:text" json:"first_name,omitempty"`
	LastName          *string `gorm:"type:text" json:"last_name,omitempty"`
	FullName          *string `gorm:"type:text" json:"full_name,omitempty"`
	Headline          *string `gorm:"type:text" json:"headline,omitempty"`
	ProfilePictureURL *string `gorm:"type:text" json:"profile_picture_url,omitempty"`
	Location          *string `gorm:"type:text" json:"location,omitempty"`
	Company           *string `gorm:"type:text" json:"company,omitempty"`
	Position          *string `gorm:"type:text" json:"position,omitempty"`

	// Request Metadata
	RequestType   RequestType   `gorm:"type:text;not null" json:"request_type"`
	RequestStatus RequestStatus `gorm:"type:text;default:'pending'" json:"request_status"`
	Message       *string       `gorm:"type:text" json:"message,omitempty"`

	// Dates
	SentAt      *time.Time `gorm:"type:timestamptz" json:"sent_at,omitempty"`
	RespondedAt *time.Time `gorm:"type:timestamptz" json:"responded_at,omitempty"`
	ExpiresAt   *time.Time `gorm:"type:timestamptz" json:"expires_at,omitempty"`

	// Campaign association
	CampaignID  *uuid.UUID `gorm:"type:uuid" json:"campaign_id,omitempty"`
	IsAutomated bool       `gorm:"type:boolean;default:false" json:"is_automated"`

	// Timestamps
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Relations
	LinkedInAccount *LinkedInAccount `gorm:"foreignKey:LinkedInAccountID;references:ID" json:"linkedin_account,omitempty"`
}

func (ConnectionRequest) TableName() string { return "connection_requests" }

func (cr *ConnectionRequest) BeforeCreate(tx *gorm.DB) error {
	if cr.ID == uuid.Nil {
		cr.ID = uuid.New()
	}
	return nil
}

// ──────────────────────────────────────────────────────────────────────────────
// NetworkSyncLog
// ──────────────────────────────────────────────────────────────────────────────

type NetworkSyncLog struct {
	ID                uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID            uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	LinkedInAccountID uuid.UUID `gorm:"column:linkedin_account_id;type:uuid;not null;index" json:"linkedin_account_id"`

	// Sync Details
	SyncType   SyncType   `gorm:"type:text;not null" json:"sync_type"`
	SyncStatus SyncStatus `gorm:"type:text;default:'in_progress'" json:"sync_status"`

	// Sync Results
	TotalConnectionsSynced int `gorm:"type:integer;default:0" json:"total_connections_synced"`
	NewConnectionsAdded    int `gorm:"type:integer;default:0" json:"new_connections_added"`
	ConnectionsUpdated     int `gorm:"type:integer;default:0" json:"connections_updated"`
	ConnectionsRemoved     int `gorm:"type:integer;default:0" json:"connections_removed"`

	// Connection Requests Results
	TotalRequestsSynced int `gorm:"type:integer;default:0" json:"total_requests_synced"`
	PendingRequests     int `gorm:"type:integer;default:0" json:"pending_requests"`
	AcceptedRequests    int `gorm:"type:integer;default:0" json:"accepted_requests"`

	// Error Tracking
	ErrorMessage *string `gorm:"type:text" json:"error_message,omitempty"`
	ErrorDetails JSONB   `gorm:"type:jsonb" json:"error_details,omitempty"`

	// Timing
	StartedAt       time.Time  `gorm:"type:timestamptz;not null" json:"started_at"`
	CompletedAt     *time.Time `gorm:"type:timestamptz" json:"completed_at,omitempty"`
	DurationSeconds *int       `gorm:"type:integer" json:"duration_seconds,omitempty"`

	// Timestamps
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Relations
	LinkedInAccount *LinkedInAccount `gorm:"foreignKey:LinkedInAccountID;references:ID" json:"linkedin_account,omitempty"`
}

func (NetworkSyncLog) TableName() string { return "network_sync_logs" }

func (sl *NetworkSyncLog) BeforeCreate(tx *gorm.DB) error {
	if sl.ID == uuid.Nil {
		sl.ID = uuid.New()
	}
	return nil
}

// ──────────────────────────────────────────────────────────────────────────────
// DTOs — Network Connections
// ──────────────────────────────────────────────────────────────────────────────

type GetConnectionsFilter struct {
	LinkedInAccountID string `query:"linkedin_account_id"`
	ConnectionStatus  string `query:"connection_status"`
	Search            string `query:"search"`
	IsFavorite        *bool  `query:"is_favorite"`
	Tags              string `query:"tags"` // comma-separated
}

type CreateConnectionRequest struct {
	LinkedInAccountID    string   `json:"linkedin_account_id" validate:"required"`
	ConnectionLinkedInURL *string `json:"connection_linkedin_url,omitempty"`
	ConnectionProfileID  *string  `json:"connection_profile_id,omitempty"`
	FirstName            *string  `json:"first_name,omitempty"`
	LastName             *string  `json:"last_name,omitempty"`
	FullName             *string  `json:"full_name,omitempty"`
	Headline             *string  `json:"headline,omitempty"`
	ProfilePictureURL    *string  `json:"profile_picture_url,omitempty"`
	Location             *string  `json:"location,omitempty"`
	Company              *string  `json:"company,omitempty"`
	Position             *string  `json:"position,omitempty"`
	ConnectedAt          *string  `json:"connected_at,omitempty"`
	Tags                 []string `json:"tags,omitempty"`
	Notes                *string  `json:"notes,omitempty"`
}

type UpdateConnectionDTO struct {
	FirstName             *string          `json:"first_name,omitempty"`
	LastName              *string          `json:"last_name,omitempty"`
	FullName              *string          `json:"full_name,omitempty"`
	Headline              *string          `json:"headline,omitempty"`
	ProfilePictureURL     *string          `json:"profile_picture_url,omitempty"`
	Location              *string          `json:"location,omitempty"`
	Company               *string          `json:"company,omitempty"`
	Position              *string          `json:"position,omitempty"`
	ConnectionStatus      *ConnectionStatus `json:"connection_status,omitempty"`
	Tags                  *StringArray     `json:"tags,omitempty"`
	Notes                 *string          `json:"notes,omitempty"`
	IsFavorite            *bool            `json:"is_favorite,omitempty"`
	ConnectionLinkedInURL *string          `json:"connection_linkedin_url,omitempty"`
	ConnectionProfileID   *string          `json:"connection_profile_id,omitempty"`
}

type ToggleFavoriteRequest struct {
	IsFavorite bool `json:"is_favorite"`
}

type BulkConnectionIDsRequest struct {
	ConnectionIDs []string `json:"connection_ids" validate:"required,min=1"`
}

type BulkUpdateTagsRequest struct {
	ConnectionIDs []string `json:"connection_ids" validate:"required,min=1"`
	Tags          []string `json:"tags" validate:"required"`
}

// ──────────────────────────────────────────────────────────────────────────────
// DTOs — Connection Requests
// ──────────────────────────────────────────────────────────────────────────────

type GetConnectionRequestsFilter struct {
	LinkedInAccountID string `query:"linkedin_account_id"`
	RequestType       string `query:"request_type"`
	RequestStatus     string `query:"request_status"`
	Search            string `query:"search"`
}

type CreateConnReqDTO struct {
	LinkedInAccountID string  `json:"linkedin_account_id" validate:"required"`
	TargetLinkedInURL string  `json:"target_linkedin_url" validate:"required"`
	TargetProfileID   *string `json:"target_profile_id,omitempty"`
	FirstName         *string `json:"first_name,omitempty"`
	LastName          *string `json:"last_name,omitempty"`
	FullName          *string `json:"full_name,omitempty"`
	Headline          *string `json:"headline,omitempty"`
	ProfilePictureURL *string `json:"profile_picture_url,omitempty"`
	Location          *string `json:"location,omitempty"`
	Company           *string `json:"company,omitempty"`
	Position          *string `json:"position,omitempty"`
	RequestType       string  `json:"request_type" validate:"required"`
	Message           *string `json:"message,omitempty"`
	CampaignID        *string `json:"campaign_id,omitempty"`
	IsAutomated       *bool   `json:"is_automated,omitempty"`
}

type UpdateConnReqDTO struct {
	RequestStatus *RequestStatus `json:"request_status,omitempty"`
	RespondedAt   *string        `json:"responded_at,omitempty"`
	Message       *string        `json:"message,omitempty"`
}

type BulkRequestIDsRequest struct {
	RequestIDs []string `json:"request_ids" validate:"required,min=1"`
}

// ──────────────────────────────────────────────────────────────────────────────
// DTOs — Sync
// ──────────────────────────────────────────────────────────────────────────────

type StartSyncRequest struct {
	LinkedInAccountID string `json:"linkedin_account_id" validate:"required"`
	SyncType          string `json:"sync_type"` // full | incremental | connection_requests
}

// NetworkSyncResult holds results returned by the actual sync engine.
type NetworkSyncResult struct {
	TotalConnectionsSynced int `json:"total_connections_synced"`
	NewConnectionsAdded    int `json:"new_connections_added"`
	ConnectionsUpdated     int `json:"connections_updated"`
	TotalRequestsSynced    int `json:"total_requests_synced,omitempty"`
	PendingRequests        int `json:"pending_requests,omitempty"`
	AcceptedRequests       int `json:"accepted_requests,omitempty"`
}

// ──────────────────────────────────────────────────────────────────────────────
// DTOs — Stats / Analytics
// ──────────────────────────────────────────────────────────────────────────────

type ConnectionStatsResponse struct {
	TotalConnections int `json:"totalConnections"`
	PendingSent      int `json:"pendingSent"`
	PendingReceived  int `json:"pendingReceived"`
	Favorites        int `json:"favorites"`
}

type NetworkAnalyticsResponse struct {
	TotalConnections int    `json:"totalConnections"`
	PendingSent      int    `json:"pendingSent"`
	AcceptedRequests int    `json:"acceptedRequests"`
	DeclinedRequests int    `json:"declinedRequests"`
	AcceptanceRate   string `json:"acceptanceRate"`
}
