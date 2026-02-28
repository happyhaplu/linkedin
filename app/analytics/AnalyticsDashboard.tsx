'use client'

import type {
  AnalyticsData,
  FunnelStep,
  DailyActivity,
  CampaignRow,
  ActivityEvent,
} from './actions'
import Link from 'next/link'
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  RocketLaunchIcon,
} from '@heroicons/react/24/outline'

// ─── Activity icons + labels ─────────────────────────────────────────────────

const ACTIVITY_META: Record<string, { emoji: string; label: string }> = {
  connection_request: { emoji: '🔗', label: 'Connection request sent to' },
  message_sent:       { emoji: '💬', label: 'Message sent to' },
  reply_received:     { emoji: '✅', label: 'Reply received from' },
  profile_view:       { emoji: '👁️', label: 'Viewed profile of' },
  follow:             { emoji: '➕', label: 'Followed' },
  like_post:          { emoji: '👍', label: 'Liked a post by' },
  inmail_sent:        { emoji: '📩', label: 'InMail sent to' },
  email_sent:         { emoji: '📧', label: 'Email sent to' },
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active:    { label: 'Active',    cls: 'bg-green-100 text-green-700' },
  running:   { label: 'Running',   cls: 'bg-green-100 text-green-700' },
  paused:    { label: 'Paused',    cls: 'bg-yellow-100 text-yellow-700' },
  draft:     { label: 'Draft',     cls: 'bg-gray-100 text-gray-600' },
  completed: { label: 'Done',      cls: 'bg-blue-100 text-blue-700' },
  canceled:  { label: 'Canceled',  cls: 'bg-red-100 text-red-700' },
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
  const { overview, funnel, dailyActivity, campaigns, recentActivity } = data
  const hasData = overview.totalLeads > 0 || campaigns.length > 0

  if (!hasData) {
    return <EmptyState />
  }

  return (
    <div className="space-y-6">
      {/* ── Row 1: Score + Metric Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">
        {/* Outreach Score */}
        <div className="col-span-12 md:col-span-3 bg-white rounded-xl border border-gray-200 p-5 flex flex-col items-center justify-center">
          <ScoreRing score={overview.outreachScore} />
          <p className="text-xs text-gray-500 mt-2 text-center">Outreach Score</p>
        </div>

        {/* Metric Cards */}
        <div className="col-span-12 md:col-span-9 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Connections Sent"
            value={overview.connectionsSent.toLocaleString()}
            change={overview.weekOverWeek.connectionsSent}
            icon="🔗"
            color="blue"
          />
          <MetricCard
            label="Acceptance Rate"
            value={`${(overview.acceptanceRate * 100).toFixed(1)}%`}
            subtext={`${overview.connectionsAccepted.toLocaleString()} accepted`}
            icon="🤝"
            color="emerald"
          />
          <MetricCard
            label="Messages Sent"
            value={overview.messagesSent.toLocaleString()}
            change={overview.weekOverWeek.messagesSent}
            icon="💬"
            color="purple"
          />
          <MetricCard
            label="Reply Rate"
            value={`${(overview.replyRate * 100).toFixed(1)}%`}
            subtext={`${overview.repliesReceived.toLocaleString()} replies`}
            icon="📬"
            color="amber"
          />
        </div>
      </div>

      {/* ── Row 2: Funnel + Daily Activity ──────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">
        {/* Funnel */}
        <div className="col-span-12 lg:col-span-5 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Outreach Funnel</h3>
          <div className="space-y-3">
            {funnel.map((step, i) => (
              <FunnelBar key={step.label} step={step} index={i} />
            ))}
          </div>
        </div>

        {/* Daily Activity Chart */}
        <div className="col-span-12 lg:col-span-7 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Daily Activity</h3>
            <div className="flex items-center space-x-3 text-[10px] text-gray-400">
              <span className="flex items-center"><span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" />Connections</span>
              <span className="flex items-center"><span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-1" />Messages</span>
              <span className="flex items-center"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Replies</span>
            </div>
          </div>
          <DailyChart days={dailyActivity} />
        </div>
      </div>

      {/* ── Row 3: Campaign Leaderboard + Activity Feed ─────────────────────── */}
      <div className="grid grid-cols-12 gap-4">
        {/* Campaign table */}
        <div className="col-span-12 lg:col-span-7 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Campaign Performance</h3>
            <span className="text-xs text-gray-400">{campaigns.length} campaigns</span>
          </div>
          {campaigns.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No campaigns yet</p>
          ) : (
            <CampaignTable rows={campaigns} />
          )}
        </div>

        {/* Activity Feed */}
        <div className="col-span-12 lg:col-span-5 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Activity</h3>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No activity yet</p>
          ) : (
            <ActivityFeed events={recentActivity} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <RocketLaunchIcon className="h-14 w-14 text-gray-300 mb-4" />
      <h2 className="text-lg font-semibold text-gray-700 mb-1">No analytics yet</h2>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">
        Create a campaign and start sending connection requests — your analytics will appear here automatically.
      </p>
      <Link
        href="/campaigns/new"
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Create Campaign
      </Link>
    </div>
  )
}

// ── Score Ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 44
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ

  const color =
    score >= 80 ? '#10b981' : // emerald
    score >= 60 ? '#3b82f6' : // blue
    score >= 40 ? '#f59e0b' : // amber
                  '#ef4444'   // red

  const bgColor =
    score >= 80 ? 'text-emerald-600' :
    score >= 60 ? 'text-blue-600' :
    score >= 40 ? 'text-amber-600' :
                  'text-red-600'

  const label =
    score >= 80 ? 'Excellent' :
    score >= 60 ? 'Good' :
    score >= 40 ? 'Fair' :
                  'Needs Work'

  return (
    <div className="relative">
      <svg width="100" height="100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f3f4f6" strokeWidth="7" />
        <circle
          cx="50" cy="50" r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold ${bgColor}`}>{score}</span>
        <span className="text-[10px] text-gray-400">{label}</span>
      </div>
    </div>
  )
}

// ── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({
  label, value, change, subtext, icon, color,
}: {
  label: string
  value: string
  change?: number
  subtext?: string
  icon: string
  color: string
}) {
  const borderMap: Record<string, string> = {
    blue: 'border-l-blue-500',
    emerald: 'border-l-emerald-500',
    purple: 'border-l-purple-500',
    amber: 'border-l-amber-500',
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-[3px] ${borderMap[color]} p-4 flex flex-col`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 font-medium">{label}</span>
        <span className="text-base">{icon}</span>
      </div>
      <span className="text-xl font-bold text-gray-900">{value}</span>
      {change !== undefined && change !== 0 && (
        <div className={`flex items-center mt-1 text-xs ${change > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {change > 0
            ? <ArrowTrendingUpIcon className="h-3.5 w-3.5 mr-0.5" />
            : <ArrowTrendingDownIcon className="h-3.5 w-3.5 mr-0.5" />
          }
          <span>{change > 0 ? '+' : ''}{change}% vs last week</span>
        </div>
      )}
      {subtext && !change && (
        <span className="text-[11px] text-gray-400 mt-1">{subtext}</span>
      )}
    </div>
  )
}

// ── Funnel Bar ───────────────────────────────────────────────────────────────

function FunnelBar({ step, index }: { step: FunnelStep; index: number }) {
  // Calculate conversion from previous step
  return (
    <div className="flex items-center space-x-3">
      <div className="w-28 text-right">
        <p className="text-xs font-medium text-gray-700">{step.label}</p>
        <p className="text-[10px] text-gray-400">{step.value.toLocaleString()}</p>
      </div>
      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
        <div
          className={`h-full ${step.color} rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2`}
          style={{ width: `${Math.max(step.pct, step.value > 0 ? 8 : 0)}%` }}
        >
          {step.pct > 15 && (
            <span className="text-[10px] font-medium text-white">{step.pct}%</span>
          )}
        </div>
      </div>
      {step.pct <= 15 && step.value > 0 && (
        <span className="text-[10px] text-gray-400 w-8">{step.pct}%</span>
      )}
    </div>
  )
}

// ── Daily Activity Chart (pure CSS) ──────────────────────────────────────────

function DailyChart({ days }: { days: DailyActivity[] }) {
  const maxTotal = Math.max(...days.map(d => d.total), 1)

  return (
    <div className="flex items-end space-x-1" style={{ height: '140px' }}>
      {days.map(day => {
        const connH = maxTotal > 0 ? (day.connectionsSent / maxTotal) * 100 : 0
        const msgH = maxTotal > 0 ? (day.messagesSent / maxTotal) * 100 : 0
        const repH = maxTotal > 0 ? (day.replies / maxTotal) * 100 : 0
        const totalH = connH + msgH + repH

        return (
          <div
            key={day.date}
            className="flex-1 flex flex-col items-center justify-end h-full group relative"
          >
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
              <div className="bg-gray-800 text-white text-[10px] px-2 py-1.5 rounded-md shadow-lg whitespace-nowrap">
                <p className="font-medium">{day.label}</p>
                {day.connectionsSent > 0 && <p>🔗 {day.connectionsSent} connections</p>}
                {day.messagesSent > 0 && <p>💬 {day.messagesSent} messages</p>}
                {day.replies > 0 && <p>✅ {day.replies} replies</p>}
                {day.total === 0 && <p className="text-gray-400">No activity</p>}
              </div>
            </div>

            {/* Stacked bars */}
            <div className="w-full flex flex-col-reverse" style={{ height: `${totalH}%` }}>
              {day.connectionsSent > 0 && (
                <div
                  className="w-full bg-blue-500 rounded-b-sm"
                  style={{ height: `${(connH / (totalH || 1)) * 100}%`, minHeight: '2px' }}
                />
              )}
              {day.messagesSent > 0 && (
                <div
                  className="w-full bg-purple-500"
                  style={{ height: `${(msgH / (totalH || 1)) * 100}%`, minHeight: '2px' }}
                />
              )}
              {day.replies > 0 && (
                <div
                  className="w-full bg-emerald-500 rounded-t-sm"
                  style={{ height: `${(repH / (totalH || 1)) * 100}%`, minHeight: '2px' }}
                />
              )}
            </div>

            {/* Empty placeholder bar */}
            {day.total === 0 && (
              <div className="w-full bg-gray-100 rounded-sm" style={{ height: '3px' }} />
            )}

            {/* Date label (show every other for space) */}
            <span className="text-[9px] text-gray-400 mt-1.5 truncate w-full text-center">
              {day.label.replace(/\s/g, '\u00A0')}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Campaign Table ───────────────────────────────────────────────────────────

function CampaignTable({ rows }: { rows: CampaignRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
            <th className="pb-2 font-medium">Campaign</th>
            <th className="pb-2 font-medium text-center">Leads</th>
            <th className="pb-2 font-medium text-center">Sent</th>
            <th className="pb-2 font-medium text-center">Accept %</th>
            <th className="pb-2 font-medium text-center">Reply %</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map(c => {
            const badge = STATUS_BADGE[c.status] || STATUS_BADGE.draft
            const accPct = (c.acceptanceRate * 100).toFixed(1)
            const repPct = (c.replyRate * 100).toFixed(1)

            return (
              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="py-2.5">
                  <Link href={`/campaigns/${c.id}`} className="hover:text-blue-600 transition-colors">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-800 truncate max-w-[180px]">{c.name}</span>
                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                  </Link>
                </td>
                <td className="py-2.5 text-center text-gray-600">{c.totalLeads}</td>
                <td className="py-2.5 text-center text-gray-600">{c.connectionsSent}</td>
                <td className="py-2.5 text-center">
                  <RateBadge value={parseFloat(accPct)} thresholds={[40, 25]} />
                </td>
                <td className="py-2.5 text-center">
                  <RateBadge value={parseFloat(repPct)} thresholds={[15, 8]} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length > 8 && (
        <Link
          href="/campaigns"
          className="block text-center text-xs text-blue-600 hover:text-blue-700 mt-3"
        >
          View all {rows.length} campaigns →
        </Link>
      )}
    </div>
  )
}

function RateBadge({ value, thresholds }: { value: number; thresholds: [number, number] }) {
  const cls =
    value >= thresholds[0]
      ? 'text-emerald-700 bg-emerald-50'
      : value >= thresholds[1]
        ? 'text-amber-700 bg-amber-50'
        : 'text-gray-500 bg-gray-50'

  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${cls}`}>
      {value}%
    </span>
  )
}

// ── Activity Feed ────────────────────────────────────────────────────────────

function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="space-y-0 max-h-[360px] overflow-y-auto">
      {events.map((ev, i) => {
        const meta = ACTIVITY_META[ev.type] || { emoji: '📌', label: ev.type }
        const failed = ev.status === 'failed'

        return (
          <div
            key={ev.id}
            className={`flex items-start space-x-2.5 py-2.5 ${
              i < events.length - 1 ? 'border-b border-gray-50' : ''
            }`}
          >
            <span className="text-sm mt-0.5">{meta.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-xs ${failed ? 'text-red-500' : 'text-gray-700'}`}>
                <span>{meta.label}</span>
                {ev.leadName && <span className="font-medium"> {ev.leadName}</span>}
                {failed && <span className="ml-1 text-red-400">(failed)</span>}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {ev.campaignName} · {formatRelativeTime(ev.time)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(dateString: string): string {
  const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
