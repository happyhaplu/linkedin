package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ──────────────────────────────────────────────────────────────────────────────
// Lead Status
// ──────────────────────────────────────────────────────────────────────────────

type LeadStatus string

const (
	LeadStatusNew          LeadStatus = "new"
	LeadStatusContacted    LeadStatus = "contacted"
	LeadStatusReplied      LeadStatus = "replied"
	LeadStatusQualified    LeadStatus = "qualified"
	LeadStatusUnqualified  LeadStatus = "unqualified"
	LeadStatusDoNotContact LeadStatus = "do_not_contact"
)

// ──────────────────────────────────────────────────────────────────────────────
// Lead
// ──────────────────────────────────────────────────────────────────────────────

type Lead struct {
	ID                     uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID                 uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	ListID                 *uuid.UUID `gorm:"type:uuid;index" json:"list_id,omitempty"`
	LinkedInURL            *string    `gorm:"column:linkedin_url;type:text" json:"linkedin_url,omitempty"`
	FirstName              *string    `gorm:"type:text" json:"first_name,omitempty"`
	LastName               *string    `gorm:"type:text" json:"last_name,omitempty"`
	FullName               *string    `gorm:"type:text" json:"full_name,omitempty"`
	Headline               *string    `gorm:"type:text" json:"headline,omitempty"`
	Company                *string    `gorm:"type:text" json:"company,omitempty"`
	CompanyURL             *string    `gorm:"type:text" json:"company_url,omitempty"`
	Position               *string    `gorm:"type:text" json:"position,omitempty"`
	JobTitle               *string    `gorm:"type:text" json:"job_title,omitempty"`
	Location               *string    `gorm:"type:text" json:"location,omitempty"`
	Email                  *string    `gorm:"type:text" json:"email,omitempty"`
	EnrichedEmail          *string    `gorm:"type:text" json:"enriched_email,omitempty"`
	CustomAddress          *string    `gorm:"type:text" json:"custom_address,omitempty"`
	Phone                  *string    `gorm:"type:text" json:"phone,omitempty"`
	ProfilePicture         *string    `gorm:"type:text" json:"profile_picture,omitempty"`
	Notes                  *string    `gorm:"type:text" json:"notes,omitempty"`
	Tags                   *string    `gorm:"type:text" json:"tags,omitempty"`
	CustomFieldValues      JSONB      `gorm:"type:jsonb;default:'{}'" json:"custom_field_values,omitempty"`
	Status                 LeadStatus `gorm:"type:text;default:'new'" json:"status"`
	ImportedAt             *time.Time `gorm:"type:timestamptz" json:"imported_at,omitempty"`
	LastContactedAt        *time.Time `gorm:"type:timestamptz" json:"last_contacted_at,omitempty"`
	AIIcebreaker           *string    `gorm:"column:ai_icebreaker;type:text" json:"ai_icebreaker,omitempty"`
	AIIcebreakerGeneratedAt *time.Time `gorm:"column:ai_icebreaker_generated_at;type:timestamptz" json:"ai_icebreaker_generated_at,omitempty"`
	CreatedAt              time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt              time.Time  `gorm:"autoUpdateTime" json:"updated_at"`

	// Associations (preloaded, not stored in this table)
	List *LeadList `gorm:"foreignKey:ListID;references:ID" json:"list,omitempty"`
}

func (Lead) TableName() string { return "leads" }

func (l *Lead) BeforeCreate(tx *gorm.DB) error {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	now := time.Now()
	if l.ImportedAt == nil {
		l.ImportedAt = &now
	}
	return nil
}

// ──────────────────────────────────────────────────────────────────────────────
// LeadList (maps to "lists" table)
// ──────────────────────────────────────────────────────────────────────────────

type LeadList struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID      uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	Name        string    `gorm:"type:text;not null" json:"name"`
	Description *string   `gorm:"type:text" json:"description,omitempty"`
	LeadCount   int       `gorm:"type:integer;default:0" json:"lead_count"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (LeadList) TableName() string { return "lists" }

func (l *LeadList) BeforeCreate(tx *gorm.DB) error {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	return nil
}

// ──────────────────────────────────────────────────────────────────────────────
// CustomField
// ──────────────────────────────────────────────────────────────────────────────

type CustomFieldType string

const (
	CustomFieldText     CustomFieldType = "text"
	CustomFieldNumber   CustomFieldType = "number"
	CustomFieldEmail    CustomFieldType = "email"
	CustomFieldPhone    CustomFieldType = "phone"
	CustomFieldURL      CustomFieldType = "url"
	CustomFieldDate     CustomFieldType = "date"
	CustomFieldTextarea CustomFieldType = "textarea"
)

type CustomField struct {
	ID         uuid.UUID       `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID     uuid.UUID       `gorm:"type:uuid;not null;index" json:"user_id"`
	Name       string          `gorm:"type:text;not null" json:"name"`
	FieldType  CustomFieldType `gorm:"type:text;not null" json:"field_type"`
	IsRequired bool            `gorm:"type:boolean;default:false" json:"is_required"`
	Options    JSONB           `gorm:"type:jsonb" json:"options,omitempty"`
	CreatedAt  time.Time       `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt  time.Time       `gorm:"autoUpdateTime" json:"updated_at"`
}

func (CustomField) TableName() string { return "custom_fields" }

func (cf *CustomField) BeforeCreate(tx *gorm.DB) error {
	if cf.ID == uuid.Nil {
		cf.ID = uuid.New()
	}
	return nil
}

// ──────────────────────────────────────────────────────────────────────────────
// DTOs — Leads
// ──────────────────────────────────────────────────────────────────────────────

type GetLeadsFilter struct {
	ListID string `query:"list_id"`
	Status string `query:"status"`
	Search string `query:"search"`
}

type ImportLeadRow struct {
	LinkedInURL   *string `json:"linkedin_url,omitempty"`
	FirstName     *string `json:"first_name,omitempty"`
	LastName      *string `json:"last_name,omitempty"`
	FullName      *string `json:"full_name,omitempty"`
	Headline      *string `json:"headline,omitempty"`
	Company       *string `json:"company,omitempty"`
	CompanyURL    *string `json:"company_url,omitempty"`
	Position      *string `json:"position,omitempty"`
	Location      *string `json:"location,omitempty"`
	Email         *string `json:"email,omitempty"`
	EnrichedEmail *string `json:"enriched_email,omitempty"`
	CustomAddress *string `json:"custom_address,omitempty"`
	Phone         *string `json:"phone,omitempty"`
	Notes         *string `json:"notes,omitempty"`
	Tags          *string `json:"tags,omitempty"`
}

type ImportLeadsRequest struct {
	ListID string          `json:"list_id" validate:"required"`
	Leads  []ImportLeadRow `json:"leads" validate:"required,min=1"`
}

type UpdateLeadRequest struct {
	FirstName         *string          `json:"first_name,omitempty"`
	LastName          *string          `json:"last_name,omitempty"`
	FullName          *string          `json:"full_name,omitempty"`
	Headline          *string          `json:"headline,omitempty"`
	Company           *string          `json:"company,omitempty"`
	CompanyURL        *string          `json:"company_url,omitempty"`
	Position          *string          `json:"position,omitempty"`
	Location          *string          `json:"location,omitempty"`
	Email             *string          `json:"email,omitempty"`
	EnrichedEmail     *string          `json:"enriched_email,omitempty"`
	CustomAddress     *string          `json:"custom_address,omitempty"`
	Phone             *string          `json:"phone,omitempty"`
	Notes             *string          `json:"notes,omitempty"`
	Tags              *string          `json:"tags,omitempty"`
	Status            *LeadStatus      `json:"status,omitempty"`
	LinkedInURL       *string          `json:"linkedin_url,omitempty"`
	ProfilePicture    *string          `json:"profile_picture,omitempty"`
	CustomFieldValues *json.RawMessage `json:"custom_field_values,omitempty"`
}

type BulkStatusRequest struct {
	LeadIDs []string   `json:"lead_ids" validate:"required,min=1"`
	Status  LeadStatus `json:"status" validate:"required"`
}

type BulkDeleteRequest struct {
	LeadIDs []string `json:"lead_ids" validate:"required,min=1"`
}

type AddFromConnectionRequest struct {
	ConnectionID   *string `json:"connection_id,omitempty"`
	FullName       string  `json:"full_name" validate:"required"`
	LinkedInURL    *string `json:"linkedin_url,omitempty"`
	Position       *string `json:"position,omitempty"`
	Company        *string `json:"company,omitempty"`
	ProfilePicture *string `json:"profile_picture,omitempty"`
	ListID         *string `json:"list_id,omitempty"`
}

// ──────────────────────────────────────────────────────────────────────────────
// DTOs — Lists
// ──────────────────────────────────────────────────────────────────────────────

type CreateListRequest struct {
	Name        string  `json:"name" validate:"required"`
	Description *string `json:"description,omitempty"`
}

type UpdateListRequest struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
}

// ──────────────────────────────────────────────────────────────────────────────
// DTOs — Custom Fields
// ──────────────────────────────────────────────────────────────────────────────

type CreateCustomFieldRequest struct {
	Name       string          `json:"name" validate:"required"`
	FieldType  CustomFieldType `json:"field_type" validate:"required"`
	IsRequired *bool           `json:"is_required,omitempty"`
	Options    json.RawMessage `json:"options,omitempty"`
}

type UpdateCustomFieldRequest struct {
	Name       *string          `json:"name,omitempty"`
	FieldType  *CustomFieldType `json:"field_type,omitempty"`
	IsRequired *bool            `json:"is_required,omitempty"`
	Options    json.RawMessage  `json:"options,omitempty"`
}

// JSONB type is defined in linkedin_account.go (shared across models).
