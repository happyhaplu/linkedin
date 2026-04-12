package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ── Plan ─────────────────────────────────────────────────────────────────────

// PlanType distinguishes Stripe-managed vs admin-assigned custom plans.
type PlanType string

const (
	PlanTypeStripe PlanType = "stripe"
	PlanTypeCustom PlanType = "custom"
)

// Plan defines a billing plan. Stripe plans mirror the Stripe product/price.
// Custom plans are created and assigned by admins only.
type Plan struct {
	ID                 string    `gorm:"type:uuid;primaryKey" json:"id"`
	Name               string    `gorm:"not null" json:"name"`
	Type               PlanType  `gorm:"type:varchar(20);not null;default:'stripe'" json:"type"`
	Description        string    `gorm:"type:text" json:"description"`
	PriceMonthly       int64     `gorm:"default:0" json:"price_monthly"` // cents
	StripePriceID      string    `gorm:"index" json:"stripe_price_id"`
	StripeProductID    string    `json:"stripe_product_id"`
	MaxLinkedInSenders int       `gorm:"default:2" json:"max_linkedin_senders"`
	MaxCampaigns       int       `gorm:"default:-1" json:"max_campaigns"`  // -1 = unlimited
	MaxLeads           int       `gorm:"default:-1" json:"max_leads"`      // -1 = unlimited
	Features           string    `gorm:"type:text" json:"features"`        // JSON array of feature strings
	IsActive           bool      `gorm:"default:true" json:"is_active"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

func (p *Plan) BeforeCreate(tx *gorm.DB) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	return nil
}

// ── UserPlan ─────────────────────────────────────────────────────────────────

// UserPlanStatus reflects the current billing state.
type UserPlanStatus string

const (
	UserPlanActive    UserPlanStatus = "active"
	UserPlanCanceled  UserPlanStatus = "canceled"
	UserPlanPastDue   UserPlanStatus = "past_due"
	UserPlanTrialing  UserPlanStatus = "trialing"
	UserPlanInactive  UserPlanStatus = "inactive"
)

// UserPlan links a user (by workspace_id) to a plan.
// There can be at most one active UserPlan per workspace.
type UserPlan struct {
	ID                     string         `gorm:"type:uuid;primaryKey" json:"id"`
	WorkspaceID            string         `gorm:"index;not null" json:"workspace_id"`
	UserEmail              string         `gorm:"not null" json:"user_email"`
	PlanID                 *string        `gorm:"type:uuid" json:"plan_id,omitempty"`
	Plan                   *Plan          `gorm:"foreignKey:PlanID" json:"plan,omitempty"`
	Status                 UserPlanStatus `gorm:"type:varchar(20);not null;default:'inactive'" json:"status"`
	// Stripe fields (empty for custom plans)
	StripeCustomerID       string         `gorm:"index" json:"stripe_customer_id"`
	StripeSubscriptionID   string         `gorm:"index" json:"stripe_subscription_id"`
	StripeCurrentPeriodEnd *time.Time     `json:"stripe_current_period_end,omitempty"`
	// Admin-editable limits (overrides plan defaults per user)
	MaxLinkedInSenders     int            `gorm:"default:0" json:"max_linkedin_senders"` // 0 = use plan default
	// Admin fields
	IsActive               bool           `gorm:"default:true" json:"is_active"` // admin can deactivate
	AssignedByAdmin        bool           `gorm:"default:false" json:"assigned_by_admin"`
	Notes                  string         `gorm:"type:text" json:"notes"`
	CreatedAt              time.Time      `json:"created_at"`
	UpdatedAt              time.Time      `json:"updated_at"`
}

func (up *UserPlan) BeforeCreate(tx *gorm.DB) error {
	if up.ID == "" {
		up.ID = uuid.New().String()
	}
	return nil
}

// EffectiveSenderLimit returns the actual LinkedIn sender limit for this user.
func (up *UserPlan) EffectiveSenderLimit() int {
	if up.MaxLinkedInSenders > 0 {
		return up.MaxLinkedInSenders
	}
	if up.Plan == nil {
		return 0
	}
	return up.Plan.MaxLinkedInSenders
}

// ── AdminSession ─────────────────────────────────────────────────────────────

// AdminSession is a DB-backed admin auth session.
type AdminSession struct {
	ID        string    `gorm:"type:uuid;primaryKey" json:"id"`
	Email     string    `gorm:"not null" json:"email"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `gorm:"index" json:"expires_at"`
}

func (as *AdminSession) BeforeCreate(tx *gorm.DB) error {
	if as.ID == "" {
		as.ID = uuid.New().String()
	}
	return nil
}

func (as *AdminSession) IsExpired() bool {
	return time.Now().After(as.ExpiresAt)
}
