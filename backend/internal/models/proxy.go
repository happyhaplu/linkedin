package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ── Proxy enum types ────────────────────────────────────────────────────────

type ProxyType string

const (
	ProxyTypeHTTP   ProxyType = "http"
	ProxyTypeHTTPS  ProxyType = "https"
	ProxyTypeSOCKS4 ProxyType = "socks4"
	ProxyTypeSOCKS5 ProxyType = "socks5"
)

type TestStatus string

const (
	TestStatusSuccess   TestStatus = "success"
	TestStatusFailed    TestStatus = "failed"
	TestStatusNotTested TestStatus = "not_tested"
)

// ── Proxy model ─────────────────────────────────────────────────────────────

// Proxy mirrors the "proxies" table.
type Proxy struct {
	ID                uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID            uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	Name              string     `gorm:"type:varchar(255);not null" json:"name"`
	Type              ProxyType  `gorm:"type:varchar(50);not null" json:"type"`
	Host              string     `gorm:"type:varchar(255);not null" json:"host"`
	Port              int        `gorm:"not null" json:"port"`
	Username          *string    `gorm:"type:varchar(255)" json:"username,omitempty"`
	PasswordEncrypted *string    `gorm:"type:text" json:"-"`
	IsActive          bool       `gorm:"default:true" json:"is_active"`
	LastTestedAt      *time.Time `json:"last_tested_at,omitempty"`
	TestStatus        TestStatus `gorm:"type:varchar(50);default:'not_tested'" json:"test_status"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

func (Proxy) TableName() string {
	return "proxies"
}

func (p *Proxy) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
