package queue

import "time"

// ── Queue Names ─────────────────────────────────────────────────────────────

const (
	QueueCampaignProcessor = "campaign-processor"
	QueueConnectionSender  = "connection-sender"
	QueueMessageSender     = "message-sender"
	QueueInMailSender      = "inmail-sender"
	QueueStatusChecker     = "status-checker"
	QueueInboxScanner      = "inbox-scanner"
	QueueMessageSync       = "message-sync"
)

// AllCampaignQueues lists every campaign-related queue name.
var AllCampaignQueues = []string{
	QueueCampaignProcessor,
	QueueConnectionSender,
	QueueMessageSender,
	QueueInMailSender,
	QueueStatusChecker,
	QueueInboxScanner,
}

// ── Job Data Types ──────────────────────────────────────────────────────────

// CampaignLeadJobData is the payload for campaign step processing jobs.
type CampaignLeadJobData struct {
	CampaignID      string `json:"campaign_id"`
	CampaignLeadID  string `json:"campaign_lead_id"`
	LeadID          string `json:"lead_id"`
	SenderAccountID string `json:"sender_account_id"`
	StepID          string `json:"step_id"`
	StepType        string `json:"step_type"`
	MessageTemplate string `json:"message_template,omitempty"`
	SubjectTemplate string `json:"subject_template,omitempty"`
	DelayDays       int    `json:"delay_days,omitempty"`
	DelayHours      int    `json:"delay_hours,omitempty"`
	// Immediate skips the working-hours check and fires right away.
	Immediate bool `json:"immediate,omitempty"`
}

// StatusCheckJobData is the payload for connection status / reply detection jobs.
type StatusCheckJobData struct {
	CampaignID      string `json:"campaign_id"`
	CampaignLeadID  string `json:"campaign_lead_id"`
	LeadID          string `json:"lead_id"`
	SenderAccountID string `json:"sender_account_id"`
	// CheckType is either "connection_status" or "reply_detection".
	CheckType string `json:"check_type"`
}

// MessageSyncJobData is the payload for message sync / reply sending jobs.
type MessageSyncJobData struct {
	// Type is one of: "sync-all", "sync-account", "send-reply".
	Type              string `json:"type"`
	LinkedInAccountID string `json:"linkedinAccountId,omitempty"`
	UserID            string `json:"userId,omitempty"`
	ThreadID          string `json:"threadId,omitempty"`
	MessageText       string `json:"messageText,omitempty"`
	ConversationID    string `json:"conversationId,omitempty"`
}

// ── Job Wrapper ─────────────────────────────────────────────────────────────

// JobStatus represents the lifecycle stage of a job.
type JobStatus string

const (
	JobStatusWaiting   JobStatus = "waiting"
	JobStatusDelayed   JobStatus = "delayed"
	JobStatusActive    JobStatus = "active"
	JobStatusCompleted JobStatus = "completed"
	JobStatusFailed    JobStatus = "failed"
)

// Job is the internal representation of a queued job.
type Job struct {
	ID          string      `json:"id"`
	Queue       string      `json:"queue"`
	Name        string      `json:"name"`
	Data        interface{} `json:"data"`
	Status      JobStatus   `json:"status"`
	Attempts    int         `json:"attempts"`
	MaxAttempts int         `json:"max_attempts"`
	Delay       time.Duration `json:"-"`       // initial delay before first execution
	RunAt       time.Time   `json:"run_at"`    // when the job should run (Now + Delay)
	CreatedAt   time.Time   `json:"created_at"`
	Error       string      `json:"error,omitempty"`
}

// ── Queue Stats ─────────────────────────────────────────────────────────────

// QueueStats holds counts for each job state in a queue.
type QueueStats struct {
	Waiting   int `json:"waiting"`
	Active    int `json:"active"`
	Completed int `json:"completed"`
	Failed    int `json:"failed"`
	Delayed   int `json:"delayed"`
	Total     int `json:"total"`
}

// ── Default Job Options ─────────────────────────────────────────────────────

const (
	DefaultMaxAttempts    = 3
	DefaultBackoffBase    = 5 * time.Second  // exponential: 5s → 10s → 20s
	DefaultCompletedTTL   = 24 * time.Hour
	DefaultFailedTTL      = 7 * 24 * time.Hour
)
