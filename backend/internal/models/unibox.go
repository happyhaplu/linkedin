package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ──────────────────────────────────────────────────────────────────────────────
// Conversation
// ──────────────────────────────────────────────────────────────────────────────

type Conversation struct {
	ID                  uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	LinkedInAccountID   uuid.UUID `gorm:"column:linkedin_account_id;type:uuid;not null;index" json:"linkedin_account_id"`
	ParticipantName     string    `gorm:"type:varchar(255);not null" json:"participant_name"`
	ParticipantProfileURL *string `gorm:"type:varchar(500)" json:"participant_profile_url"`
	ParticipantHeadline *string   `gorm:"type:varchar(500)" json:"participant_headline"`
	ParticipantAvatarURL *string  `gorm:"type:text" json:"participant_avatar_url"`
	LastMessageAt       *time.Time `gorm:"type:timestamptz" json:"last_message_at"`
	LastMessagePreview  *string   `gorm:"type:text" json:"last_message_preview"`
	UnreadCount         int       `gorm:"type:integer;default:0" json:"unread_count"`
	IsArchived          bool      `gorm:"type:boolean;default:false" json:"is_archived"`
	ThreadID            string    `gorm:"type:varchar(255);uniqueIndex" json:"thread_id"`
	Label               *string   `gorm:"type:text" json:"label"`
	CreatedAt           time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt           time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Relations
	LinkedInAccount *LinkedInAccount `gorm:"foreignKey:LinkedInAccountID;references:ID" json:"linkedin_account,omitempty"`
}

func (Conversation) TableName() string { return "conversations" }

func (c *Conversation) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}

// ──────────────────────────────────────────────────────────────────────────────
// Message
// ──────────────────────────────────────────────────────────────────────────────

type Message struct {
	ID                uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ConversationID    uuid.UUID `gorm:"type:uuid;not null;index" json:"conversation_id"`
	LinkedInAccountID uuid.UUID `gorm:"column:linkedin_account_id;type:uuid;not null;index" json:"linkedin_account_id"`
	MessageID         string    `gorm:"type:varchar(255);uniqueIndex" json:"message_id"`
	SenderName        string    `gorm:"type:varchar(255)" json:"sender_name"`
	SenderProfileURL  *string   `gorm:"type:varchar(500)" json:"sender_profile_url"`
	IsFromMe          bool      `gorm:"type:boolean;default:false" json:"is_from_me"`
	Content           string    `gorm:"type:text" json:"content"`
	SentAt            time.Time `gorm:"type:timestamptz;not null" json:"sent_at"`
	IsRead            bool      `gorm:"type:boolean;default:false" json:"is_read"`
	HasAttachment     bool      `gorm:"type:boolean;default:false" json:"has_attachment"`
	AttachmentURL     *string   `gorm:"type:text" json:"attachment_url"`
	CreatedAt         time.Time `gorm:"autoCreateTime" json:"created_at"`

	// Relations
	Conversation *Conversation `gorm:"foreignKey:ConversationID;references:ID" json:"-"`
}

func (Message) TableName() string { return "messages" }

func (m *Message) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}

// ──────────────────────────────────────────────────────────────────────────────
// DTOs — Conversations
// ──────────────────────────────────────────────────────────────────────────────

// GetConversationsFilter maps to the TS filters for getConversations.
type GetConversationsFilter struct {
	AccountID   string `query:"account_id"`
	ShowArchived *bool  `query:"show_archived"` // pointer so we can distinguish missing vs false
	OnlyUnread  bool   `query:"only_unread"`
	SearchQuery string `query:"search_query"`
	Label       string `query:"label"`
}

// ArchiveConversationRequest is the body for archive/unarchive.
type ArchiveConversationRequest struct {
	Archive *bool `json:"archive"` // pointer; defaults to true when nil
}

// SetLabelRequest is the body for setting a conversation label.
type SetLabelRequest struct {
	Label *string `json:"label"` // null clears the label
}

// ──────────────────────────────────────────────────────────────────────────────
// DTOs — Messages
// ──────────────────────────────────────────────────────────────────────────────

// SendMessageRequest is the body for sending a reply.
type SendMessageRequest struct {
	ConversationID    string `json:"conversation_id" validate:"required"`
	LinkedInAccountID string `json:"linkedin_account_id" validate:"required"`
	Content           string `json:"content" validate:"required"`
}

// ──────────────────────────────────────────────────────────────────────────────
// DTOs — Sync
// ──────────────────────────────────────────────────────────────────────────────

// TriggerSyncResponse is returned after a sync trigger.
type TriggerSyncResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

// ──────────────────────────────────────────────────────────────────────────────
// DTOs — Campaign Context
// ──────────────────────────────────────────────────────────────────────────────

// CampaignContextResponse is inline context shown in thread view.
type CampaignContextResponse struct {
	CampaignName *string `json:"campaignName"`
	LeadStatus   *string `json:"leadStatus"`
	Company      *string `json:"company"`
	Position     *string `json:"position"`
}
