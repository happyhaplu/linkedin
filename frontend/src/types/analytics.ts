// ─── Analytics Types ─────────────────────────────────────────────────────────

// ─── Overview ────────────────────────────────────────────────────────────────

export interface WeekOverWeek {
  connectionsSent: number
  messagesSent: number
}

export interface OverviewMetrics {
  connectionsSent: number
  connectionsAccepted: number
  acceptanceRate: number
  messagesSent: number
  repliesReceived: number
  replyRate: number
  totalLeads: number
  activeCampaigns: number
  outreachScore: number
  weekOverWeek: WeekOverWeek
}

// ─── Funnel ──────────────────────────────────────────────────────────────────

export interface FunnelStep {
  label: string
  value: number
  pct: number
  color: string
}

// ─── Daily Activity ──────────────────────────────────────────────────────────

export interface DailyActivity {
  date: string
  label: string
  connectionsSent: number
  messagesSent: number
  replies: number
  total: number
}

// ─── Campaign Row ────────────────────────────────────────────────────────────

export interface CampaignRow {
  id: string
  name: string
  status: string
  totalLeads: number
  connectionsSent: number
  acceptanceRate: number
  messagesSent: number
  replyRate: number
}

// ─── Activity Event ──────────────────────────────────────────────────────────

export interface ActivityEvent {
  id: string
  type: string
  status: string
  leadName: string | null
  campaignName: string
  time: string
}

// ─── Top-Level Response ──────────────────────────────────────────────────────

export interface AnalyticsData {
  overview: OverviewMetrics
  funnel: FunnelStep[]
  dailyActivity: DailyActivity[]
  campaigns: CampaignRow[]
  recentActivity: ActivityEvent[]
}

// ─── Config Constants ────────────────────────────────────────────────────────

export const ACTIVITY_META: Record<string, { emoji: string; label: string }> = {
  connection_request: { emoji: '🔗', label: 'Connection request sent to' },
  message_sent:       { emoji: '💬', label: 'Message sent to' },
  reply_received:     { emoji: '✅', label: 'Reply received from' },
  profile_view:       { emoji: '👁️', label: 'Viewed profile of' },
  follow:             { emoji: '➕', label: 'Followed' },
  like_post:          { emoji: '👍', label: 'Liked a post by' },
  inmail_sent:        { emoji: '📩', label: 'InMail sent to' },
  email_sent:         { emoji: '📧', label: 'Email sent to' },
}

export const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active:    { label: 'Active',   cls: 'bg-green-100 text-green-700' },
  running:   { label: 'Running',  cls: 'bg-green-100 text-green-700' },
  paused:    { label: 'Paused',   cls: 'bg-yellow-100 text-yellow-700' },
  draft:     { label: 'Draft',    cls: 'bg-gray-100 text-gray-600' },
  completed: { label: 'Done',     cls: 'bg-blue-100 text-blue-700' },
  canceled:  { label: 'Canceled', cls: 'bg-red-100 text-red-700' },
}
