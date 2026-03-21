'use server'

import { createClient as createServerClient } from '@/lib/db/server'
import { DbClient } from '@/lib/db/query-builder'

function db() {
  return new DbClient()
}

// ─── Types ───────────────────────────────────────────────────────────────────

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
  weekOverWeek: {
    connectionsSent: number   // % change
    messagesSent: number
  }
}

export interface FunnelStep {
  label: string
  value: number
  pct: number
  color: string
}

export interface DailyActivity {
  date: string
  label: string          // e.g. "Feb 14"
  connectionsSent: number
  messagesSent: number
  replies: number
  total: number
}

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

export interface ActivityEvent {
  id: string
  type: string
  status: string
  leadName: string | null
  campaignName: string
  time: string
}

export interface AnalyticsData {
  overview: OverviewMetrics
  funnel: FunnelStep[]
  dailyActivity: DailyActivity[]
  campaigns: CampaignRow[]
  recentActivity: ActivityEvent[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function weekBounds() {
  const now = new Date()
  const day = now.getDay()
  const toMon = day === 0 ? 6 : day - 1

  const thisMonday = new Date(now)
  thisMonday.setDate(now.getDate() - toMon)
  thisMonday.setHours(0, 0, 0, 0)

  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(thisMonday.getDate() - 7)

  return { thisMonday, lastMonday }
}

function pctChange(cur: number, prev: number): number {
  if (prev === 0) return cur > 0 ? 100 : 0
  return Math.round(((cur - prev) / prev) * 100)
}

// ─── Main data fetcher ───────────────────────────────────────────────────────

export async function getAnalyticsData(): Promise<AnalyticsData> {
  const auth = await createServerClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const supabase = db()
  const userId = user.id

  // ── 1. Campaigns (aggregate metrics live here) ────────────────────────────
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, total_leads, pending_leads, completed_leads, replied_leads, connection_sent, connection_accepted, messages_sent, replies_received, started_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  const all = campaigns || []
  const campaignIds = all.map((c: any) => c.id)

  const activeCampaigns = all.filter((c: any) => ['active', 'running'].includes(c.status)).length
  const connectionsSent = all.reduce((s: any, c: any) => s + (c.connection_sent || 0), 0)
  const connectionsAccepted = all.reduce((s: any, c: any) => s + (c.connection_accepted || 0), 0)
  const messagesSent = all.reduce((s: any, c: any) => s + (c.messages_sent || 0), 0)
  const repliesReceived = all.reduce((s: any, c: any) => s + (c.replies_received || 0), 0)
  const totalLeads = all.reduce((s: any, c: any) => s + (c.total_leads || 0), 0)

  const acceptanceRate = connectionsSent > 0 ? connectionsAccepted / connectionsSent : 0
  const replyRate = messagesSent > 0 ? repliesReceived / messagesSent : 0

  // ── 2. Weekly comparison (campaign_activity_log) ──────────────────────────
  let weekOverWeek = { connectionsSent: 0, messagesSent: 0 }

  if (campaignIds.length > 0) {
    const { thisMonday, lastMonday } = weekBounds()

    const [twRes, lwRes] = await Promise.all([
      supabase
        .from('campaign_activity_log')
        .select('activity_type')
        .in('campaign_id', campaignIds)
        .gte('executed_at', thisMonday.toISOString())
        .eq('activity_status', 'success'),
      supabase
        .from('campaign_activity_log')
        .select('activity_type')
        .in('campaign_id', campaignIds)
        .gte('executed_at', lastMonday.toISOString())
        .lt('executed_at', thisMonday.toISOString())
        .eq('activity_status', 'success'),
    ])

    const count = (rows: any[] | null, type: string) =>
      (rows || []).filter(r => r.activity_type === type).length

    weekOverWeek = {
      connectionsSent: pctChange(
        count(twRes.data, 'connection_request'),
        count(lwRes.data, 'connection_request'),
      ),
      messagesSent: pctChange(
        count(twRes.data, 'message_sent'),
        count(lwRes.data, 'message_sent'),
      ),
    }
  }

  // ── 3. Outreach Score (0-100) ─────────────────────────────────────────────
  //    50% acceptance (capped at 50%=100), 30% reply (capped at 25%=100),
  //    20% having active campaigns
  const accScore = Math.min(100, (acceptanceRate / 0.5) * 100)
  const repScore = Math.min(100, (replyRate / 0.25) * 100)
  const activeScore = activeCampaigns > 0 ? 100 : 0
  const outreachScore = Math.round(accScore * 0.5 + repScore * 0.3 + activeScore * 0.2)

  // ── 4. Funnel ─────────────────────────────────────────────────────────────
  const funnel: FunnelStep[] = [
    { label: 'Total Leads', value: totalLeads, pct: 100, color: 'bg-gray-400' },
    { label: 'Connections Sent', value: connectionsSent, pct: totalLeads > 0 ? Math.round((connectionsSent / totalLeads) * 100) : 0, color: 'bg-blue-500' },
    { label: 'Accepted', value: connectionsAccepted, pct: totalLeads > 0 ? Math.round((connectionsAccepted / totalLeads) * 100) : 0, color: 'bg-emerald-500' },
    { label: 'Messages Sent', value: messagesSent, pct: totalLeads > 0 ? Math.round((messagesSent / totalLeads) * 100) : 0, color: 'bg-purple-500' },
    { label: 'Replies', value: repliesReceived, pct: totalLeads > 0 ? Math.round((repliesReceived / totalLeads) * 100) : 0, color: 'bg-amber-500' },
  ]

  // ── 5. Daily activity (14 days) ───────────────────────────────────────────
  let dailyActivity: DailyActivity[] = []

  // Initialise empty 14-day array
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().split('T')[0]
    dailyActivity.push({
      date: iso,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      connectionsSent: 0,
      messagesSent: 0,
      replies: 0,
      total: 0,
    })
  }

  if (campaignIds.length > 0) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 14)

    const { data: logs } = await supabase
      .from('campaign_activity_log')
      .select('activity_type, executed_at')
      .in('campaign_id', campaignIds)
      .gte('executed_at', cutoff.toISOString())
      .eq('activity_status', 'success')

    const dateMap = new Map(dailyActivity.map(d => [d.date, d]))

    for (const log of logs || []) {
      const key = new Date(log.executed_at).toISOString().split('T')[0]
      const entry = dateMap.get(key)
      if (!entry) continue
      if (log.activity_type === 'connection_request') entry.connectionsSent++
      else if (log.activity_type === 'message_sent') entry.messagesSent++
      else if (log.activity_type === 'reply_received') entry.replies++
    }

    dailyActivity.forEach(d => {
      d.total = d.connectionsSent + d.messagesSent + d.replies
    })
  }

  // ── 6. Campaign performance table ─────────────────────────────────────────
  const campaignRows: CampaignRow[] = all.map((c: any) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    totalLeads: c.total_leads || 0,
    connectionsSent: c.connection_sent || 0,
    acceptanceRate: (c.connection_sent || 0) > 0
      ? (c.connection_accepted || 0) / c.connection_sent
      : 0,
    messagesSent: c.messages_sent || 0,
    replyRate: (c.messages_sent || 0) > 0
      ? (c.replies_received || 0) / c.messages_sent
      : 0,
  })).sort((a: any, b: any) => b.acceptanceRate - a.acceptanceRate)

  // ── 7. Recent activity feed ───────────────────────────────────────────────
  let recentActivity: ActivityEvent[] = []

  if (campaignIds.length > 0) {
    const { data: logs } = await supabase
      .from('campaign_activity_log')
      .select('id, activity_type, activity_status, executed_at, campaign_id, campaign_lead_id')
      .in('campaign_id', campaignIds)
      .order('executed_at', { ascending: false })
      .limit(25)

    if (logs && logs.length > 0) {
      // Batch-resolve lead names
      const clIds = Array.from(new Set(logs.map((l: any) => l.campaign_lead_id).filter(Boolean)))
      const nameMap: Record<string, string> = {}

      if (clIds.length > 0) {
        const { data: cls } = await supabase
          .from('campaign_leads')
          .select('id, lead_id')
          .in('id', clIds)

        if (cls && cls.length > 0) {
          const leadIds = cls.map((c: any) => c.lead_id)
          const { data: leads } = await supabase
            .from('leads')
            .select('id, full_name')
            .in('id', leadIds)

          const lm = new Map<string, string>((leads || []).map((l: any) => [l.id, l.full_name]))
          for (const cl of (cls as any[])) nameMap[cl.id] = lm.get(cl.lead_id) || 'Someone'
        }
      }

      const cMap = new Map(all.map((c: any) => [c.id, c.name]))

      recentActivity = logs.map((l: any) => ({
        id: l.id,
        type: l.activity_type,
        status: l.activity_status,
        leadName: nameMap[l.campaign_lead_id] || null,
        campaignName: cMap.get(l.campaign_id) || 'Campaign',
        time: l.executed_at,
      }))
    }
  }

  return {
    overview: {
      connectionsSent,
      connectionsAccepted,
      acceptanceRate,
      messagesSent,
      repliesReceived,
      replyRate,
      totalLeads,
      activeCampaigns,
      outreachScore,
      weekOverWeek,
    },
    funnel,
    dailyActivity,
    campaigns: campaignRows,
    recentActivity,
  }
}
