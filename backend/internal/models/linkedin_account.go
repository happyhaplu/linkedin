package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ── Enum types ──────────────────────────────────────────────────────────────

type ConnectionMethod string

const (
	ConnectionMethodCredentials ConnectionMethod = "credentials"
	ConnectionMethodExtension   ConnectionMethod = "extension"
	ConnectionMethodProxy       ConnectionMethod = "proxy"
	ConnectionMethodCookie      ConnectionMethod = "cookie"
	ConnectionMethodAutomated   ConnectionMethod = "automated"
	ConnectionMethodProxyLogin  ConnectionMethod = "proxy_login"
)

type AccountStatus string

const (
	AccountStatusActive              AccountStatus = "active"
	AccountStatusPaused              AccountStatus = "paused"
	AccountStatusError               AccountStatus = "error"
	AccountStatusPending             AccountStatus = "pending"
	AccountStatusConnecting          AccountStatus = "connecting"
	AccountStatusPendingVerification AccountStatus = "pending_verification"
	AccountStatusDisconnected        AccountStatus = "disconnected"
)

// ── JSON field types ────────────────────────────────────────────────────────

// JSONB is a generic JSONB wrapper for GORM.
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(bytes, j)
}

// StringArray is a PostgreSQL TEXT[] wrapper.
type StringArray []string

func (a StringArray) Value() (driver.Value, error) {
	if a == nil {
		return nil, nil
	}
	return json.Marshal(a)
}

func (a *StringArray) Scan(value interface{}) error {
	if value == nil {
		*a = nil
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	// Try JSON first (GORM serialization), then PostgreSQL array literal
	if err := json.Unmarshal(bytes, a); err != nil {
		// Fallback: try postgres-style {a,b,c}
		s := string(bytes)
		if len(s) >= 2 && s[0] == '{' && s[len(s)-1] == '}' {
			s = s[1 : len(s)-1]
			if s == "" {
				*a = []string{}
			} else {
				parts := splitPGArray(s)
				*a = parts
			}
			return nil
		}
		return err
	}
	return nil
}

func splitPGArray(s string) []string {
	var result []string
	var current []byte
	inQuote := false
	for i := 0; i < len(s); i++ {
		switch {
		case s[i] == '"':
			inQuote = !inQuote
		case s[i] == ',' && !inQuote:
			result = append(result, string(current))
			current = nil
		default:
			current = append(current, s[i])
		}
	}
	if len(current) > 0 || len(s) > 0 {
		result = append(result, string(current))
	}
	return result
}

// DailyLimits represents the daily sending limits.
type DailyLimits struct {
	ConnectionRequestsPerDay int `json:"connection_requests_per_day"`
	MessagesPerDay           int `json:"messages_per_day"`
	InmailsPerDay            int `json:"inmails_per_day"`
}

func (d DailyLimits) Value() (driver.Value, error) {
	return json.Marshal(d)
}

func (d *DailyLimits) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(bytes, d)
}

// SendingLimits matches the frontend SendingLimits type.
type SendingLimits struct {
	ConnectionRequestsPerDay int `json:"connection_requests_per_day"`
	MessagesPerDay           int `json:"messages_per_day"`
	InmailsPerDay            int `json:"inmails_per_day"`
}

func (s SendingLimits) Value() (driver.Value, error) {
	return json.Marshal(s)
}

func (s *SendingLimits) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(bytes, s)
}

// ── LinkedIn Account model ─────────────────────────────────────────────────

// LinkedInAccount mirrors the "linkedin_accounts" table.
type LinkedInAccount struct {
	ID                 uuid.UUID        `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID             uuid.UUID        `gorm:"type:uuid;not null;index" json:"user_id"`
	Email              string           `gorm:"type:varchar(255);not null" json:"email"`
	PasswordEncrypted  *string          `gorm:"type:text" json:"-"`
	ConnectionMethod   ConnectionMethod `gorm:"type:varchar(50);not null" json:"connection_method"`
	Status             AccountStatus    `gorm:"type:varchar(50);not null;default:'connecting'" json:"status"`
	ProxyID            *uuid.UUID       `gorm:"type:uuid;index" json:"proxy_id,omitempty"`
	AssignedCampaigns  StringArray      `gorm:"type:text[]" json:"assigned_campaigns,omitempty"`
	TwoFAEnabled       bool             `gorm:"default:false" json:"two_fa_enabled"`
	TwoFASecret        *string          `gorm:"type:text" json:"-"`
	SessionCookies     JSONB            `gorm:"type:jsonb" json:"-"`
	SessionID          *string          `gorm:"type:text" json:"session_id,omitempty"`
	ProfileName        *string          `gorm:"type:varchar(255)" json:"profile_name,omitempty"`
	ProfilePictureURL  *string          `gorm:"type:text" json:"profile_picture_url,omitempty"`
	Headline           *string          `gorm:"type:text" json:"headline,omitempty"`
	JobTitle           *string          `gorm:"type:varchar(255)" json:"job_title,omitempty"`
	Company            *string          `gorm:"type:varchar(255)" json:"company,omitempty"`
	Location           *string          `gorm:"type:varchar(255)" json:"location,omitempty"`
	ProfileURL         *string          `gorm:"type:text" json:"profile_url,omitempty"`
	ConnectionsCount   *int             `gorm:"type:integer" json:"connections_count,omitempty"`
	About              *string          `gorm:"type:text" json:"about,omitempty"`
	DailyLimits        *DailyLimits     `gorm:"type:jsonb" json:"daily_limits,omitempty"`
	SendingLimitsData  *SendingLimits   `gorm:"column:sending_limits;type:jsonb" json:"sending_limits,omitempty"`
	ErrorMessage       *string          `gorm:"type:text" json:"error_message,omitempty"`
	LastActivityAt     *time.Time       `json:"last_activity_at,omitempty"`
	CreatedAt          time.Time        `json:"created_at"`
	UpdatedAt          time.Time        `json:"updated_at"`

	// Relations
	Proxy *Proxy `gorm:"foreignKey:ProxyID" json:"proxy,omitempty"`
}

func (LinkedInAccount) TableName() string {
	return "linkedin_accounts"
}

func (a *LinkedInAccount) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}

// AccountHealthLog mirrors the "account_health_logs" table.
type AccountHealthLog struct {
	ID                uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	LinkedInAccountID uuid.UUID  `gorm:"column:linkedin_account_id;type:uuid;not null;index" json:"linkedin_account_id"`
	Status            string     `gorm:"type:varchar(50);not null" json:"status"`
	ErrorMessage      *string    `gorm:"type:text" json:"error_message,omitempty"`
	SessionValid      *bool      `json:"session_valid,omitempty"`
	ResponseTime      *int       `json:"response_time,omitempty"`
	CheckedAt         time.Time  `gorm:"default:now()" json:"checked_at"`

	// Relations
	LinkedInAccount *LinkedInAccount `gorm:"foreignKey:LinkedInAccountID" json:"linkedin_account,omitempty"`
}

func (AccountHealthLog) TableName() string {
	return "account_health_logs"
}

func (h *AccountHealthLog) BeforeCreate(tx *gorm.DB) error {
	if h.ID == uuid.Nil {
		h.ID = uuid.New()
	}
	return nil
}
