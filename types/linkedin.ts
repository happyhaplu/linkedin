export type ConnectionMethod = 'credentials' | 'extension' | 'proxy' | 'cookie' | 'automated'
export type AccountStatus = 'active' | 'paused' | 'error' | 'pending' | 'connecting' | 'pending_verification' | 'disconnected'
export type ProxyType = 'http' | 'https' | 'socks4' | 'socks5'

export interface SendingLimits {
  connection_requests_per_day: number
  messages_per_day: number
  inmails_per_day: number
}

export interface LinkedInAccount {
  id: string
  user_id: string
  email: string
  password_encrypted?: string
  connection_method: ConnectionMethod
  status: AccountStatus
  proxy_id?: string
  assigned_campaigns?: string[]
  two_fa_enabled: boolean
  two_fa_secret?: string
  session_cookies?: any
  session_id?: string
  profile_name?: string
  profile_picture_url?: string
  headline?: string
  job_title?: string
  company?: string
  location?: string
  profile_url?: string
  connections_count?: number
  about?: string
  daily_limits?: {
    connection_requests_per_day?: number
    messages_per_day?: number
    inmails_per_day?: number
  }
  error_message?: string
  last_activity_at?: string
  created_at: string
  updated_at: string
  proxy?: Proxy
  sending_limits?: SendingLimits
}

export interface Proxy {
  id: string
  user_id: string
  name: string
  type: ProxyType
  host: string
  port: number
  username?: string
  password_encrypted?: string
  is_active: boolean
  last_tested_at?: string
  test_status?: 'success' | 'failed' | 'not_tested'
  created_at: string
  updated_at: string
}

export type LeadStatus = 'new' | 'contacted' | 'replied' | 'qualified' | 'unqualified' | 'do_not_contact'

export type CustomFieldType = 'text' | 'number' | 'email' | 'phone' | 'url' | 'date' | 'textarea'

export interface CustomField {
  id: string
  user_id: string
  name: string
  field_type: CustomFieldType
  is_required: boolean
  options?: any
  created_at: string
  updated_at: string
}

export interface List {
  id: string
  user_id: string
  name: string
  description?: string
  lead_count: number
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  list_id: string
  user_id: string
  linkedin_url?: string
  first_name?: string
  last_name?: string
  full_name?: string
  headline?: string
  company?: string
  company_url?: string
  position?: string
  location?: string
  email?: string
  enriched_email?: string
  custom_address?: string
  phone?: string
  profile_picture?: string
  notes?: string
  tags?: string
  custom_field_values?: Record<string, any>
  status: LeadStatus
  imported_at: string
  last_contacted_at?: string
  ai_icebreaker?: string
  ai_icebreaker_generated_at?: string
  created_at: string
  updated_at: string
  list?: List
}

// Network Module Types
export type ConnectionStatus = 'connected' | 'pending' | 'withdrawn' | 'ignored'
export type RequestType = 'sent' | 'received'
export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'expired'
export type SyncType = 'full' | 'incremental' | 'connection_requests'
export type SyncStatus = 'in_progress' | 'completed' | 'failed' | 'partial'

export interface NetworkConnection {
  id: string
  user_id: string
  linkedin_account_id: string
  
  // Connection Details
  connection_linkedin_url?: string
  connection_profile_id?: string
  first_name?: string
  last_name?: string
  full_name?: string
  headline?: string
  profile_picture_url?: string
  location?: string
  company?: string
  position?: string
  
  // Connection Metadata
  connection_status: ConnectionStatus
  connected_at?: string
  mutual_connections_count: number
  
  // Tags and Notes
  tags?: string[]
  notes?: string
  is_favorite: boolean
  
  // Sync Information
  last_synced_at: string
  is_synced: boolean
  
  // Timestamps
  created_at: string
  updated_at: string
  
  // Relations
  linkedin_account?: LinkedInAccount
}

export interface ConnectionRequest {
  id: string
  user_id: string
  linkedin_account_id: string
  
  // Request Details
  target_linkedin_url: string
  target_profile_id?: string
  first_name?: string
  last_name?: string
  full_name?: string
  headline?: string
  profile_picture_url?: string
  location?: string
  company?: string
  position?: string
  
  // Request Metadata
  request_type: RequestType
  request_status: RequestStatus
  message?: string
  
  // Dates
  sent_at: string
  responded_at?: string
  expires_at?: string
  
  // Campaign association
  campaign_id?: string
  is_automated: boolean
  
  // Timestamps
  created_at: string
  updated_at: string
  
  // Relations
  linkedin_account?: LinkedInAccount
}

export interface NetworkSyncLog {
  id: string
  user_id: string
  linkedin_account_id: string
  
  // Sync Details
  sync_type: SyncType
  sync_status: SyncStatus
  
  // Sync Results
  total_connections_synced: number
  new_connections_added: number
  connections_updated: number
  connections_removed: number
  
  // Connection Requests Results
  total_requests_synced: number
  pending_requests: number
  accepted_requests: number
  
  // Error Tracking
  error_message?: string
  error_details?: any
  
  // Timing
  started_at: string
  completed_at?: string
  duration_seconds?: number
  
  // Timestamps
  created_at: string
  updated_at: string
  
  // Relations
  linkedin_account?: LinkedInAccount
}

// =============================================
// CAMPAIGNS MODULE TYPES
// =============================================

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'canceled'
export type CampaignLeadStatus = 'pending' | 'in_progress' | 'completed' | 'paused' | 'failed' | 'removed'
export type SequenceStepType = 'follow' | 'like_post' | 'connection_request' | 'message' | 'email' | 'inmail' | 'view_profile'
export type ConditionType = 'accepted' | 'not_accepted' | 'replied' | 'not_replied' | 'opened' | 'clicked' | null
export type ActivityType = 'follow' | 'unfollow' | 'like_post' | 'connection_request' | 'message_sent' | 'reply_received' | 'inmail_sent' | 'email_sent' | 'profile_view'
export type ActivityStatus = 'success' | 'failed' | 'pending' | 'skipped'

export interface Campaign {
  id: string
  user_id: string
  
  // Campaign Details
  name: string
  description?: string
  status: CampaignStatus
  
  // Configuration
  lead_list_id?: string
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
  
  // Performance Metrics
  total_leads: number
  pending_leads: number
  completed_leads: number
  replied_leads: number
  
  // Stats
  connection_sent: number
  connection_accepted: number
  messages_sent: number
  replies_received: number
  
  // Timestamps
  started_at?: string
  paused_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
  
  // Relations
  lead_list?: List
  senders?: CampaignSender[]
  sequences?: CampaignSequence[]
  leads?: CampaignLead[]
}

export interface CampaignSender {
  id: string
  campaign_id: string
  linkedin_account_id: string
  
  // Sender Settings
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
  linkedin_account?: LinkedInAccount
  campaign?: Campaign
}

export interface CampaignSequence {
  id: string
  campaign_id: string
  
  // Sequence Step Details
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
  
  // Relations
  campaign?: Campaign
  parent_step?: CampaignSequence
}

export interface CampaignLead {
  id: string
  campaign_id: string
  lead_id: string
  sender_id?: string
  sender_account_id?: string

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
  
  // Relations
  campaign?: Campaign
  lead?: Lead
  sender?: CampaignSender
  current_step?: CampaignSequence
}

export interface CampaignActivityLog {
  id: string
  campaign_id: string
  campaign_lead_id?: string
  sequence_step_id?: string
  
  // Activity Details
  activity_type: ActivityType
  activity_status: ActivityStatus
  
  // Data
  message_content?: string
  error_message?: string
  metadata?: any
  
  // Timestamps
  executed_at: string
  created_at: string
  
  // Relations
  campaign?: Campaign
  campaign_lead?: CampaignLead
  sequence_step?: CampaignSequence
}

// Filters and Request Types
export interface CampaignFilters {
  status?: string
  search?: string
  sender_id?: string
}

export interface CampaignLeadFilters {
  status?: string
  search?: string
  sender_id?: string
}

export interface CampaignStats {
  totalCampaigns: number
  activeCampaigns: number
  totalLeads: number
  repliedLeads: number
  connectionAcceptRate: number
  replyRate: number
}

export interface CreateCampaignInput {
  name: string
  description?: string
  lead_list_id?: string
  daily_limit?: number
  timezone?: string
  sender_ids: string[]
  sequences: CreateSequenceInput[]

  // Safety Settings
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
  condition_type?: ConditionType
  parent_step_id?: string
  // A/B Testing
  message_template_b?: string
  ab_test_enabled?: boolean
  ab_test_winner?: string
}

export interface UpdateCampaignInput {
  name?: string
  description?: string
  daily_limit?: number
  timezone?: string
  status?: CampaignStatus
  // Safety
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

export interface AccountDailyCounter {
  id: string
  linkedin_account_id: string
  date: string
  connections_sent: number
  messages_sent: number
  inmails_sent: number
  profile_views: number
  total_actions: number
  created_at: string
  updated_at: string
}

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
  winner: string | null
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

export interface CampaignTemplateStep {
  step_number: number
  step_type: SequenceStepType
  message_template?: string
  subject_template?: string
  delay_days?: number
  delay_hours?: number
  condition_type?: ConditionType
}

export interface CampaignTemplate {
  id: string
  name: string
  description: string
  step_count: number
  estimated_acceptance_rate: string
  steps: CampaignTemplateStep[]
}
