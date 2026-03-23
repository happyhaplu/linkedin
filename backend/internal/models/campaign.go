package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ── Enum types ──────────────────────────────────────────────────────────────

type CampaignStatus string

const (
	CampaignStatusDraft     CampaignStatus = "draft"
	CampaignStatusActive    CampaignStatus = "active"
	CampaignStatusPaused    CampaignStatus = "paused"
	CampaignStatusCompleted CampaignStatus = "completed"
	CampaignStatusCanceled  CampaignStatus = "canceled"
)

type CampaignLeadStatus string

const (
	CampaignLeadStatusPending    CampaignLeadStatus = "pending"
	CampaignLeadStatusInProgress CampaignLeadStatus = "in_progress"
	CampaignLeadStatusCompleted  CampaignLeadStatus = "completed"
	CampaignLeadStatusPaused     CampaignLeadStatus = "paused"
	CampaignLeadStatusFailed     CampaignLeadStatus = "failed"
	CampaignLeadStatusRemoved    CampaignLeadStatus = "removed"
	CampaignLeadStatusSkipped    CampaignLeadStatus = "skipped"
)

type SequenceStepType string

const (
	StepTypeFollow            SequenceStepType = "follow"
	StepTypeLikePost          SequenceStepType = "like_post"
	StepTypeConnectionRequest SequenceStepType = "connection_request"
	StepTypeMessage           SequenceStepType = "message"
	StepTypeEmail             SequenceStepType = "email"
	StepTypeInMail            SequenceStepType = "inmail"
	StepTypeViewProfile       SequenceStepType = "view_profile"
	StepTypeDelay             SequenceStepType = "delay"
)

type ConditionType string

const (
	ConditionAccepted    ConditionType = "accepted"
	ConditionNotAccepted ConditionType = "not_accepted"
	ConditionReplied     ConditionType = "replied"
	ConditionNotReplied  ConditionType = "not_replied"
	ConditionOpened      ConditionType = "opened"
	ConditionClicked     ConditionType = "clicked"
)

type ActivityType string

const (
	ActivityFollow            ActivityType = "follow"
	ActivityUnfollow          ActivityType = "unfollow"
	ActivityLikePost          ActivityType = "like_post"
	ActivityConnectionRequest ActivityType = "connection_request"
	ActivityMessageSent       ActivityType = "message_sent"
	ActivityReplyReceived     ActivityType = "reply_received"
	ActivityInMailSent        ActivityType = "inmail_sent"
	ActivityEmailSent         ActivityType = "email_sent"
	ActivityProfileView       ActivityType = "profile_view"
)

type ActivityStatus string

const (
	ActivityStatusSuccess ActivityStatus = "success"
	ActivityStatusFailed  ActivityStatus = "failed"
	ActivityStatusPending ActivityStatus = "pending"
	ActivityStatusSkipped ActivityStatus = "skipped"
)

// ── Campaign ────────────────────────────────────────────────────────────────

type Campaign struct {
	ID          uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	Name        string         `gorm:"type:text;not null" json:"name"`
	Description *string        `gorm:"type:text" json:"description,omitempty"`
	Status      CampaignStatus `gorm:"type:text;default:'draft'" json:"status"`

	// Lead list association
	LeadListID *uuid.UUID `gorm:"type:uuid" json:"lead_list_id,omitempty"`

	// Configuration
	DailyLimit int    `gorm:"default:50" json:"daily_limit"`
	Timezone   string `gorm:"type:text;default:'UTC'" json:"timezone"`

	// Safety Controls
	WorkingHoursStart       *string     `gorm:"type:text" json:"working_hours_start,omitempty"`
	WorkingHoursEnd         *string     `gorm:"type:text" json:"working_hours_end,omitempty"`
	WorkingDays             StringArray `gorm:"type:jsonb" json:"working_days,omitempty"`
	DelayMinSeconds         *int        `gorm:"default:45" json:"delay_min_seconds,omitempty"`
	DelayMaxSeconds         *int        `gorm:"default:120" json:"delay_max_seconds,omitempty"`
	WarmUpEnabled           *bool       `gorm:"default:false" json:"warm_up_enabled,omitempty"`
	WarmUpDays              *int        `gorm:"default:14" json:"warm_up_days,omitempty"`
	WarmUpStartDate         *time.Time  `gorm:"type:timestamptz" json:"warm_up_start_date,omitempty"`
	AutoPauseBelowAccept    *float64    `gorm:"column:auto_pause_below_acceptance" json:"auto_pause_below_acceptance,omitempty"`
	SkipAlreadyContacted    *bool       `gorm:"default:true" json:"skip_already_contacted,omitempty"`
	StopOnReply             *bool       `gorm:"default:true" json:"stop_on_reply,omitempty"`

	// Performance Metrics (aggregates)
	TotalLeads     int `gorm:"default:0" json:"total_leads"`
	PendingLeads   int `gorm:"default:0" json:"pending_leads"`
	CompletedLeads int `gorm:"default:0" json:"completed_leads"`
	RepliedLeads   int `gorm:"default:0" json:"replied_leads"`

	// Stats
	ConnectionSent     int `gorm:"default:0" json:"connection_sent"`
	ConnectionAccepted int `gorm:"default:0" json:"connection_accepted"`
	MessagesSent       int `gorm:"default:0" json:"messages_sent"`
	RepliesReceived    int `gorm:"default:0" json:"replies_received"`
	FailedLeads        int `gorm:"default:0" json:"failed_leads"`

	// Timestamps
	StartedAt   *time.Time `gorm:"type:timestamptz" json:"started_at,omitempty"`
	PausedAt    *time.Time `gorm:"type:timestamptz" json:"paused_at,omitempty"`
	CompletedAt *time.Time `gorm:"type:timestamptz" json:"completed_at,omitempty"`
	CreatedAt   time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time  `gorm:"autoUpdateTime" json:"updated_at"`

	// Relations (not stored in DB — populated by service layer)
	Senders   []CampaignSender   `gorm:"-" json:"senders,omitempty"`
	Sequences []CampaignSequence `gorm:"-" json:"sequences,omitempty"`
	Leads     []CampaignLead     `gorm:"-" json:"leads,omitempty"`
}

func (Campaign) TableName() string { return "campaigns" }

func (c *Campaign) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}

// ── CampaignSender ──────────────────────────────────────────────────────────

type CampaignSender struct {
	ID                 uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	CampaignID         uuid.UUID `gorm:"type:uuid;not null;index" json:"campaign_id"`
	LinkedInAccountID  uuid.UUID `gorm:"column:linkedin_account_id;type:uuid;not null" json:"linkedin_account_id"`
	IsActive           bool      `gorm:"default:true" json:"is_active"`
	DailyLimit         int       `gorm:"default:50" json:"daily_limit"`

	// Performance Metrics
	LeadsAssigned      int `gorm:"default:0" json:"leads_assigned"`
	ConnectionSent     int `gorm:"default:0" json:"connection_sent"`
	ConnectionAccepted int `gorm:"default:0" json:"connection_accepted"`
	MessagesSent       int `gorm:"default:0" json:"messages_sent"`
	RepliesReceived    int `gorm:"default:0" json:"replies_received"`

	// Timestamps
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Relations
	LinkedInAccount *LinkedInAccount `gorm:"foreignKey:LinkedInAccountID" json:"linkedin_account,omitempty"`
}

func (CampaignSender) TableName() string { return "campaign_senders" }

func (cs *CampaignSender) BeforeCreate(tx *gorm.DB) error {
	if cs.ID == uuid.Nil {
		cs.ID = uuid.New()
	}
	return nil
}

// ── CampaignSequence ────────────────────────────────────────────────────────

type CampaignSequence struct {
	ID         uuid.UUID        `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	CampaignID uuid.UUID        `gorm:"type:uuid;not null;index" json:"campaign_id"`
	StepNumber int              `gorm:"not null" json:"step_number"`
	StepType   SequenceStepType `gorm:"type:text;not null" json:"step_type"`

	// Action Details
	MessageTemplate  *string `gorm:"type:text" json:"message_template,omitempty"`
	SubjectTemplate  *string `gorm:"type:text" json:"subject_template,omitempty"`
	PostURL          *string `gorm:"type:text" json:"post_url,omitempty"`

	// A/B Testing
	MessageTemplateB *string `gorm:"type:text" json:"message_template_b,omitempty"`
	ABTestEnabled    *bool   `gorm:"default:false" json:"ab_test_enabled,omitempty"`
	ABTestWinner     *string `gorm:"type:text" json:"ab_test_winner,omitempty"`

	// Timing
	DelayDays  int `gorm:"default:0" json:"delay_days"`
	DelayHours int `gorm:"default:0" json:"delay_hours"`

	// Conditional Logic
	ConditionType *ConditionType `gorm:"type:text" json:"condition_type,omitempty"`
	ParentStepID  *uuid.UUID     `gorm:"type:uuid" json:"parent_step_id,omitempty"`

	// Performance
	TotalExecuted int `gorm:"default:0" json:"total_executed"`
	TotalSuccess  int `gorm:"default:0" json:"total_success"`
	TotalFailed   int `gorm:"default:0" json:"total_failed"`

	// Timestamps
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (CampaignSequence) TableName() string { return "campaign_sequences" }

func (cs *CampaignSequence) BeforeCreate(tx *gorm.DB) error {
	if cs.ID == uuid.Nil {
		cs.ID = uuid.New()
	}
	return nil
}

// ── CampaignLead ────────────────────────────────────────────────────────────

type CampaignLead struct {
	ID               uuid.UUID          `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	CampaignID       uuid.UUID          `gorm:"type:uuid;not null;index" json:"campaign_id"`
	LeadID           uuid.UUID          `gorm:"type:uuid;not null" json:"lead_id"`
	SenderID         *uuid.UUID         `gorm:"type:uuid" json:"sender_id,omitempty"`
	SenderAccountID  *uuid.UUID         `gorm:"type:uuid" json:"sender_account_id,omitempty"`

	// Lead data (populated via Preload)
	Lead *Lead `gorm:"foreignKey:LeadID" json:"lead,omitempty"`

	// A/B Variant
	Variant *string `gorm:"type:text" json:"variant,omitempty"`

	// Status
	Status            CampaignLeadStatus `gorm:"type:text;default:'pending'" json:"status"`
	CurrentStepID     *uuid.UUID         `gorm:"type:uuid" json:"current_step_id,omitempty"`
	CurrentStepNumber *int               `gorm:"type:int" json:"current_step_number,omitempty"`

	// Engagement
	ConnectionSentAt     *time.Time `gorm:"type:timestamptz" json:"connection_sent_at,omitempty"`
	ConnectionAcceptedAt *time.Time `gorm:"type:timestamptz" json:"connection_accepted_at,omitempty"`
	FirstMessageSentAt   *time.Time `gorm:"type:timestamptz" json:"first_message_sent_at,omitempty"`
	FirstReplyAt         *time.Time `gorm:"type:timestamptz" json:"first_reply_at,omitempty"`
	RepliedAt            *time.Time `gorm:"type:timestamptz" json:"replied_at,omitempty"`
	LastActivityAt       *time.Time `gorm:"type:timestamptz" json:"last_activity_at,omitempty"`

	// Stats
	TotalMessagesSent    int `gorm:"default:0" json:"total_messages_sent"`
	TotalRepliesReceived int `gorm:"default:0" json:"total_replies_received"`

	// Scheduling
	NextActionAt *time.Time `gorm:"type:timestamptz" json:"next_action_at,omitempty"`

	// Error Handling
	ErrorMessage *string `gorm:"type:text" json:"error_message,omitempty"`
	RetryCount   int     `gorm:"default:0" json:"retry_count"`

	// Timestamps
	AddedAt     time.Time  `gorm:"autoCreateTime" json:"added_at"`
	StartedAt   *time.Time `gorm:"type:timestamptz" json:"started_at,omitempty"`
	CompletedAt *time.Time `gorm:"type:timestamptz" json:"completed_at,omitempty"`
	CreatedAt   time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
}

func (CampaignLead) TableName() string { return "campaign_leads" }

func (cl *CampaignLead) BeforeCreate(tx *gorm.DB) error {
	if cl.ID == uuid.Nil {
		cl.ID = uuid.New()
	}
	return nil
}

// ── CampaignActivityLog ─────────────────────────────────────────────────────

type CampaignActivityLog struct {
	ID              uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	CampaignID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"campaign_id"`
	CampaignLeadID  *uuid.UUID     `gorm:"type:uuid" json:"campaign_lead_id,omitempty"`
	SequenceStepID  *uuid.UUID     `gorm:"type:uuid" json:"sequence_step_id,omitempty"`
	ActivityType    ActivityType   `gorm:"type:text;not null" json:"activity_type"`
	ActivityStatus  ActivityStatus `gorm:"type:text;not null" json:"activity_status"`
	MessageContent  *string        `gorm:"type:text" json:"message_content,omitempty"`
	ErrorMessage    *string        `gorm:"type:text" json:"error_message,omitempty"`
	Metadata        JSONB          `gorm:"type:jsonb" json:"metadata,omitempty"`
	ExecutedAt      time.Time      `gorm:"autoCreateTime" json:"executed_at"`
	CreatedAt       time.Time      `gorm:"autoCreateTime" json:"created_at"`
}

func (CampaignActivityLog) TableName() string { return "campaign_activity_log" }

func (l *CampaignActivityLog) BeforeCreate(tx *gorm.DB) error {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	return nil
}

// ── AccountDailyCounter ─────────────────────────────────────────────────────

type AccountDailyCounter struct {
	ID                uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	LinkedInAccountID uuid.UUID `gorm:"column:linkedin_account_id;type:uuid;not null;index" json:"linkedin_account_id"`
	Date              string    `gorm:"type:date;not null" json:"date"`
	ConnectionsSent   int       `gorm:"default:0" json:"connections_sent"`
	MessagesSent      int       `gorm:"default:0" json:"messages_sent"`
	InMailsSent       int       `gorm:"column:inmails_sent;default:0" json:"inmails_sent"`
	ProfileViews      int       `gorm:"default:0" json:"profile_views"`
	TotalActions      int       `gorm:"default:0" json:"total_actions"`
	CreatedAt         time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt         time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (AccountDailyCounter) TableName() string { return "account_daily_counters" }

func (c *AccountDailyCounter) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}

// ── CampaignWebhook ─────────────────────────────────────────────────────────

type CampaignWebhook struct {
	ID          uuid.UUID   `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	CampaignID  uuid.UUID   `gorm:"type:uuid;not null;index" json:"campaign_id"`
	UserID      uuid.UUID   `gorm:"type:uuid;not null" json:"user_id"`
	URL         string      `gorm:"type:text;not null" json:"url"`
	Secret      *string     `gorm:"type:text" json:"secret,omitempty"`
	Description *string     `gorm:"type:text" json:"description,omitempty"`
	Events      StringArray `gorm:"type:jsonb" json:"events"`
	IsActive    bool        `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time   `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time   `gorm:"autoUpdateTime" json:"updated_at"`
}

func (CampaignWebhook) TableName() string { return "campaign_webhooks" }

func (w *CampaignWebhook) BeforeCreate(tx *gorm.DB) error {
	if w.ID == uuid.Nil {
		w.ID = uuid.New()
	}
	return nil
}

// ── CampaignWebhookLog ──────────────────────────────────────────────────────

type CampaignWebhookLog struct {
	ID           uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	WebhookID    uuid.UUID `gorm:"type:uuid;not null;index" json:"webhook_id"`
	CampaignID   uuid.UUID `gorm:"type:uuid;not null" json:"campaign_id"`
	Event        string    `gorm:"type:text;not null" json:"event"`
	Success      bool      `gorm:"default:false" json:"success"`
	StatusCode   *int      `gorm:"type:int" json:"status_code,omitempty"`
	ErrorMessage *string   `gorm:"type:text" json:"error_message,omitempty"`
	CreatedAt    time.Time `gorm:"autoCreateTime" json:"created_at"`

	// Relations
	Webhook *CampaignWebhook `gorm:"foreignKey:WebhookID" json:"webhook,omitempty"`
}

func (CampaignWebhookLog) TableName() string { return "campaign_webhook_logs" }

func (l *CampaignWebhookLog) BeforeCreate(tx *gorm.DB) error {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	return nil
}

// ── Request / Response DTOs ─────────────────────────────────────────────────

type CreateCampaignInput struct {
	Name                    string               `json:"name" validate:"required"`
	Description             *string              `json:"description,omitempty"`
	LeadListID              *string              `json:"lead_list_id,omitempty"`
	DailyLimit              *int                 `json:"daily_limit,omitempty"`
	Timezone                *string              `json:"timezone,omitempty"`
	SenderIDs               []string             `json:"sender_ids"`
	Sequences               []CreateSequenceInput `json:"sequences"`
	WorkingHoursStart       *string              `json:"working_hours_start,omitempty"`
	WorkingHoursEnd         *string              `json:"working_hours_end,omitempty"`
	WorkingDays             []string             `json:"working_days,omitempty"`
	DelayMinSeconds         *int                 `json:"delay_min_seconds,omitempty"`
	DelayMaxSeconds         *int                 `json:"delay_max_seconds,omitempty"`
	WarmUpEnabled           *bool                `json:"warm_up_enabled,omitempty"`
	WarmUpDays              *int                 `json:"warm_up_days,omitempty"`
	AutoPauseBelowAcceptance *float64            `json:"auto_pause_below_acceptance,omitempty"`
	SkipAlreadyContacted    *bool                `json:"skip_already_contacted,omitempty"`
	StopOnReply             *bool                `json:"stop_on_reply,omitempty"`
}

type CreateSequenceInput struct {
	StepNumber       int     `json:"step_number"`
	StepType         string  `json:"step_type"`
	MessageTemplate  *string `json:"message_template,omitempty"`
	SubjectTemplate  *string `json:"subject_template,omitempty"`
	PostURL          *string `json:"post_url,omitempty"`
	DelayDays        *int    `json:"delay_days,omitempty"`
	DelayHours       *int    `json:"delay_hours,omitempty"`
	ConditionType    *string `json:"condition_type,omitempty"`
	ParentStepID     *string `json:"parent_step_id,omitempty"`
	MessageTemplateB *string `json:"message_template_b,omitempty"`
	ABTestEnabled    *bool   `json:"ab_test_enabled,omitempty"`
	ABTestWinner     *string `json:"ab_test_winner,omitempty"`
}

type UpdateCampaignInput struct {
	Name                    *string  `json:"name,omitempty"`
	Description             *string  `json:"description,omitempty"`
	DailyLimit              *int     `json:"daily_limit,omitempty"`
	Timezone                *string  `json:"timezone,omitempty"`
	Status                  *string  `json:"status,omitempty"`
	WorkingHoursStart       *string  `json:"working_hours_start,omitempty"`
	WorkingHoursEnd         *string  `json:"working_hours_end,omitempty"`
	WorkingDays             []string `json:"working_days,omitempty"`
	DelayMinSeconds         *int     `json:"delay_min_seconds,omitempty"`
	DelayMaxSeconds         *int     `json:"delay_max_seconds,omitempty"`
	WarmUpEnabled           *bool    `json:"warm_up_enabled,omitempty"`
	WarmUpDays              *int     `json:"warm_up_days,omitempty"`
	AutoPauseBelowAcceptance *float64 `json:"auto_pause_below_acceptance,omitempty"`
	SkipAlreadyContacted    *bool    `json:"skip_already_contacted,omitempty"`
	StopOnReply             *bool    `json:"stop_on_reply,omitempty"`
}

// ── Analytics DTOs ──────────────────────────────────────────────────────────

type CampaignAnalyticsFunnel struct {
	TotalLeads  int `json:"total_leads"`
	Sent        int `json:"sent"`
	SentPct     int `json:"sent_pct"`
	Accepted    int `json:"accepted"`
	AcceptedPct int `json:"accepted_pct"`
	Messaged    int `json:"messaged"`
	MessagedPct int `json:"messaged_pct"`
	Replied     int `json:"replied"`
	RepliedPct  int `json:"replied_pct"`
}

type CampaignAnalyticsToday struct {
	ConnectionsSent     int `json:"connections_sent"`
	ConnectionsAccepted int `json:"connections_accepted"`
	MessagesSent        int `json:"messages_sent"`
	RepliesReceived     int `json:"replies_received"`
	DailyLimit          int `json:"daily_limit"`
}

type CampaignAnalyticsTrend struct {
	Date        string `json:"date"`
	Connections int    `json:"connections"`
	Replies     int    `json:"replies"`
}

type CampaignAnalyticsPerStep struct {
	StepNumber int    `json:"step_number"`
	StepType   string `json:"step_type"`
	Sent       int    `json:"sent"`
	Converted  int    `json:"converted"`
	Rate       int    `json:"rate"`
}

type CampaignAnalyticsABResult struct {
	StepID          string  `json:"step_id"`
	VariantASent    int     `json:"variant_a_sent"`
	VariantAReplied int     `json:"variant_a_replied"`
	VariantARate    int     `json:"variant_a_rate"`
	VariantBSent    int     `json:"variant_b_sent"`
	VariantBReplied int     `json:"variant_b_replied"`
	VariantBRate    int     `json:"variant_b_rate"`
	Winner          *string `json:"winner"`
}

type CampaignAnalyticsPerSender struct {
	AccountID       string `json:"account_id"`
	ProfileName     string `json:"profile_name"`
	ConnectionsSent int    `json:"connections_sent"`
	Accepted        int    `json:"accepted"`
	MessagesSent    int    `json:"messages_sent"`
	Replied         int    `json:"replied"`
}

type CampaignAnalytics struct {
	Funnel    CampaignAnalyticsFunnel      `json:"funnel"`
	Today     CampaignAnalyticsToday       `json:"today"`
	Trend     []CampaignAnalyticsTrend     `json:"trend"`
	PerStep   []CampaignAnalyticsPerStep   `json:"per_step"`
	ABResults []CampaignAnalyticsABResult  `json:"ab_results"`
	PerSender []CampaignAnalyticsPerSender `json:"per_sender"`
}

type CampaignStats struct {
	TotalCampaigns       int     `json:"totalCampaigns"`
	ActiveCampaigns      int     `json:"activeCampaigns"`
	TotalLeads           int     `json:"totalLeads"`
	RepliedLeads         int     `json:"repliedLeads"`
	ConnectionAcceptRate float64 `json:"connectionAcceptRate"`
	ReplyRate            float64 `json:"replyRate"`
}

// ── Campaign Template DTOs (static, no DB) ──────────────────────────────────

type CampaignTemplateStep struct {
	StepNumber      int     `json:"step_number"`
	StepType        string  `json:"step_type"`
	MessageTemplate *string `json:"message_template,omitempty"`
	SubjectTemplate *string `json:"subject_template,omitempty"`
	DelayDays       *int    `json:"delay_days,omitempty"`
	DelayHours      *int    `json:"delay_hours,omitempty"`
	ConditionType   *string `json:"condition_type,omitempty"`
}

type CampaignTemplate struct {
	ID                      string                 `json:"id"`
	Name                    string                 `json:"name"`
	Description             string                 `json:"description"`
	StepCount               int                    `json:"step_count"`
	EstimatedAcceptanceRate string                 `json:"estimated_acceptance_rate"`
	Steps                   []CampaignTemplateStep `json:"steps"`
}

// ── Lead Stats DTO ──────────────────────────────────────────────────────────

type CampaignLeadStats struct {
	Total      int `json:"total"`
	Pending    int `json:"pending"`
	InProgress int `json:"in_progress"`
	Paused     int `json:"paused"`
	Completed  int `json:"completed"`
	Failed     int `json:"failed"`
	Removed    int `json:"removed"`
}
