// ─── Campaign module type definitions ─────────────────────────────────────
// Maps 1:1 with Go backend models in backend/internal/models/campaign.go

// ── Enum types ────────────────────────────────────────────────────────────

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'canceled'

export type CampaignLeadStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'replied'
  | 'paused'
  | 'failed'
  | 'removed'
  | 'skipped'

export type SequenceStepType =
  | 'follow'
  | 'like_post'
  | 'connection_request'
  | 'message'
  | 'email'
  | 'inmail'
  | 'view_profile'
  | 'delay'

export type ConditionType =
  | 'accepted'
  | 'not_accepted'
  | 'replied'
  | 'not_replied'
  | 'opened'
  | 'clicked'

export type ActivityType =
  | 'follow'
  | 'unfollow'
  | 'like_post'
  | 'connection_request'
  | 'message_sent'
  | 'reply_received'
  | 'inmail_sent'
  | 'email_sent'
  | 'profile_view'

export type ActivityStatus = 'success' | 'failed' | 'pending' | 'skipped'

// ── Campaign ──────────────────────────────────────────────────────────────

export interface Campaign {
  id: string
  user_id: string
  name: string
  description?: string
  status: CampaignStatus

  // Lead list association
  lead_list_id?: string

  // Configuration
  daily_limit: number
  timezone: string

  // Safety Controls
  working_hours_start?: string
  working_hours_end?: string
  working_days?: string[]
  delay_min_seconds?: number
  delay_max_seconds?: number
  warm_up_enabled?: boolean
  warm_up_days?: number
  warm_up_start_date?: string
  auto_pause_below_acceptance?: number
  skip_already_contacted?: boolean
  stop_on_reply?: boolean

  // Performance Metrics (aggregates)
  total_leads: number
  pending_leads: number
  completed_leads: number
  replied_leads: number

  // Stats
  connection_sent: number
  connection_accepted: number
  messages_sent: number
  replies_received: number
  failed_leads: number

  // Timestamps
  started_at?: string
  paused_at?: string
  completed_at?: string
  created_at: string
  updated_at: string

  // Relations (populated by service layer)
  senders?: CampaignSender[]
  sequences?: CampaignSequence[]
  leads?: CampaignLead[]
}

// ── CampaignSender ────────────────────────────────────────────────────────

export interface CampaignSender {
  id: string
  campaign_id: string
  linkedin_account_id: string
  is_active: boolean
  daily_limit: number

  // Performance Metrics
  leads_assigned: number
  connection_sent: number
  connection_accepted: number
  messages_sent: number
  replies_received: number

  // Timestamps
  created_at: string
  updated_at: string

  // Relations
  linkedin_account?: {
    id: string
    email: string
    profile_name?: string
    profile_picture_url?: string
    status: string
  }
}

// ── CampaignSequence ──────────────────────────────────────────────────────

export interface CampaignSequence {
  id: string
  campaign_id: string
  step_number: number
  step_type: SequenceStepType

  // Action Details
  message_template?: string
  subject_template?: string
  post_url?: string

  // A/B Testing
  message_template_b?: string
  ab_test_enabled?: boolean
  ab_test_winner?: string

  // Timing
  delay_days: number
  delay_hours: number

  // Conditional Logic
  condition_type?: ConditionType
  parent_step_id?: string

  // Performance
  total_executed: number
  total_success: number
  total_failed: number

  // Timestamps
  created_at: string
  updated_at: string
}

// ── CampaignLead ──────────────────────────────────────────────────────────

export interface CampaignLead {
  id: string
  campaign_id: string
  lead_id: string
  sender_id?: string
  sender_account_id?: string

  // Lead data (populated via Preload)
  lead?: {
    id: string
    first_name?: string
    last_name?: string
    full_name?: string
    email?: string
    company?: string
    title?: string
    linkedin_url?: string
  }

  // A/B Variant
  variant?: string

  // Status
  status: CampaignLeadStatus
  current_step_id?: string
  current_step_number?: number

  // Engagement
  connection_sent_at?: string
  connection_accepted_at?: string
  first_message_sent_at?: string
  first_reply_at?: string
  replied_at?: string
  last_activity_at?: string

  // Stats
  total_messages_sent: number
  total_replies_received: number

  // Scheduling
  next_action_at?: string

  // Error Handling
  error_message?: string
  retry_count: number

  // Timestamps
  added_at: string
  started_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
}

// ── CampaignActivityLog ───────────────────────────────────────────────────

export interface CampaignActivityLog {
  id: string
  campaign_id: string
  campaign_lead_id?: string
  sequence_step_id?: string
  activity_type: ActivityType
  activity_status: ActivityStatus
  message_content?: string
  error_message?: string
  metadata?: Record<string, unknown>
  executed_at: string
  created_at: string

  // Populated relation
  campaign_lead?: CampaignLead
}

// ── CampaignWebhook ──────────────────────────────────────────────────────

export interface CampaignWebhook {
  id: string
  campaign_id: string
  user_id: string
  url: string
  secret?: string
  description?: string
  events: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

// ── CampaignWebhookLog ──────────────────────────────────────────────────

export interface CampaignWebhookLog {
  id: string
  webhook_id: string
  campaign_id: string
  event: string
  success: boolean
  status_code?: number
  error_message?: string
  created_at: string
  webhook?: CampaignWebhook
}

// ── Analytics DTOs ────────────────────────────────────────────────────────

export interface CampaignAnalyticsFunnel {
  total_leads: number
  sent: number
  sent_pct: number
  accepted: number
  accepted_pct: number
  messaged: number
  messaged_pct: number
  replied: number
  replied_pct: number
}

export interface CampaignAnalyticsToday {
  connections_sent: number
  connections_accepted: number
  messages_sent: number
  replies_received: number
  daily_limit: number
}

export interface CampaignAnalyticsTrend {
  date: string
  connections: number
  replies: number
}

export interface CampaignAnalyticsPerStep {
  step_number: number
  step_type: string
  sent: number
  converted: number
  rate: number
}

export interface CampaignAnalyticsABResult {
  step_id: string
  variant_a_sent: number
  variant_a_replied: number
  variant_a_rate: number
  variant_b_sent: number
  variant_b_replied: number
  variant_b_rate: number
  winner?: string
}

export interface CampaignAnalyticsPerSender {
  account_id: string
  profile_name: string
  connections_sent: number
  accepted: number
  messages_sent: number
  replied: number
}

export interface CampaignAnalytics {
  funnel: CampaignAnalyticsFunnel
  today: CampaignAnalyticsToday
  trend: CampaignAnalyticsTrend[]
  per_step: CampaignAnalyticsPerStep[]
  ab_results: CampaignAnalyticsABResult[]
  per_sender: CampaignAnalyticsPerSender[]
}

// ── Campaign Stats ────────────────────────────────────────────────────────

export interface CampaignStats {
  totalCampaigns: number
  activeCampaigns: number
  totalLeads: number
  repliedLeads: number
  connectionAcceptRate: number
  replyRate: number
}

// ── Campaign Template ─────────────────────────────────────────────────────

export interface CampaignTemplateStep {
  step_number: number
  step_type: string
  message_template?: string
  subject_template?: string
  delay_days?: number
  delay_hours?: number
  condition_type?: string
  ab_test_enabled?: boolean
  message_template_b?: string
}

export interface CampaignTemplate {
  id: string
  name: string
  description: string
  icon?: string
  step_count: number
  estimated_acceptance_rate: string
  steps: CampaignTemplateStep[]
}

// ── Campaign Lead Stats ───────────────────────────────────────────────────

export interface CampaignLeadStats {
  total: number
  pending: number
  in_progress: number
  paused: number
  completed: number
  failed: number
  removed: number
}

// ── Request DTOs ──────────────────────────────────────────────────────────

export interface CreateCampaignInput {
  name: string
  description?: string
  lead_list_id?: string
  daily_limit?: number
  timezone?: string
  sender_ids: string[]
  sequences: CreateSequenceInput[]
  working_hours_start?: string
  working_hours_end?: string
  working_days?: string[]
  delay_min_seconds?: number
  delay_max_seconds?: number
  warm_up_enabled?: boolean
  warm_up_days?: number
  auto_pause_below_acceptance?: number
  skip_already_contacted?: boolean
  stop_on_reply?: boolean
}

export interface CreateSequenceInput {
  step_number: number
  step_type: SequenceStepType
  message_template?: string
  subject_template?: string
  post_url?: string
  delay_days?: number
  delay_hours?: number
  condition_type?: ConditionType | string
  parent_step_id?: string
  message_template_b?: string
  ab_test_enabled?: boolean
  ab_test_winner?: string
}

export interface UpdateCampaignInput {
  name?: string
  description?: string
  daily_limit?: number
  timezone?: string
  status?: string
  working_hours_start?: string
  working_hours_end?: string
  working_days?: string[]
  delay_min_seconds?: number
  delay_max_seconds?: number
  warm_up_enabled?: boolean
  warm_up_days?: number
  auto_pause_below_acceptance?: number
  skip_already_contacted?: boolean
  stop_on_reply?: boolean
}

export interface CreateWebhookInput {
  url: string
  secret?: string
  description?: string
  events?: string[]
}
