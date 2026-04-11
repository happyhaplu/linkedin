package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Session is a DB-backed auth session. No JWT, no shared secret.
// Created on /auth/callback after Accounts API verifies the launch token.
// The session ID (UUID) is stored in the reach-session cookie.
type Session struct {
	ID            string    `gorm:"type:uuid;primaryKey" json:"id"`
	UserID        string    `gorm:"index;not null" json:"user_id"`
	Email         string    `gorm:"not null" json:"email"`
	WorkspaceID   string    `json:"workspace_id"`
	Subscribed    bool      `gorm:"default:true" json:"subscribed"`
	Plan          string    `json:"plan"`
	AccountsToken string    `gorm:"type:text" json:"-"` // raw launch token for server-to-server calls
	CreatedAt     time.Time `json:"created_at"`
	ExpiresAt     time.Time `gorm:"index" json:"expires_at"`
}

// BeforeCreate generates a UUID primary key if not already set.
func (s *Session) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	return nil
}

// IsExpired returns true if the session has passed its expiry time.
func (s *Session) IsExpired() bool {
	return time.Now().After(s.ExpiresAt)
}
