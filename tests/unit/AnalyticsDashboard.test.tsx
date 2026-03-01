/**
 * Component Tests — AnalyticsDashboard
 *
 * Covers: rendering overview metrics, funnel, campaign table,
 *         activity feed, empty state, score ring
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import AnalyticsDashboard from '@/app/analytics/AnalyticsDashboard'
import type { AnalyticsData } from '@/app/analytics/actions'

// Mock Next.js Link
jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
  MockLink.displayName = 'MockLink'
  return MockLink
})

// ─── Test Data ──────────────────────────────────────────────────────────────

const mockData: AnalyticsData = {
  overview: {
    connectionsSent: 150,
    connectionsAccepted: 45,
    acceptanceRate: 0.3,
    messagesSent: 80,
    repliesReceived: 12,
    replyRate: 0.15,
    totalLeads: 500,
    activeCampaigns: 2,
    outreachScore: 68,
    weekOverWeek: { connectionsSent: 15, messagesSent: -5 },
  },
  funnel: [
    { label: 'Total Leads', value: 500, pct: 100, color: 'bg-gray-400' },
    { label: 'Connections Sent', value: 150, pct: 30, color: 'bg-blue-500' },
    { label: 'Accepted', value: 45, pct: 9, color: 'bg-emerald-500' },
    { label: 'Messages Sent', value: 80, pct: 16, color: 'bg-purple-500' },
    { label: 'Replies', value: 12, pct: 2, color: 'bg-amber-500' },
  ],
  dailyActivity: [
    { date: '2025-02-14', label: 'Feb 14', connectionsSent: 5, messagesSent: 3, replies: 1, total: 9 },
    { date: '2025-02-15', label: 'Feb 15', connectionsSent: 8, messagesSent: 4, replies: 2, total: 14 },
  ],
  campaigns: [
    {
      id: 'c1',
      name: 'Q1 Outreach',
      status: 'active',
      totalLeads: 200,
      connectionsSent: 80,
      acceptanceRate: 0.35,
      messagesSent: 40,
      replyRate: 0.2,
    },
    {
      id: 'c2',
      name: 'Winter Campaign',
      status: 'paused',
      totalLeads: 100,
      connectionsSent: 30,
      acceptanceRate: 0.25,
      messagesSent: 20,
      replyRate: 0.1,
    },
  ],
  recentActivity: [
    {
      id: 'a1',
      type: 'connection_request',
      status: 'success',
      leadName: 'John Doe',
      campaignName: 'Q1 Outreach',
      time: '2025-02-15T10:00:00Z',
    },
    {
      id: 'a2',
      type: 'message_sent',
      status: 'success',
      leadName: 'Jane Smith',
      campaignName: 'Winter Campaign',
      time: '2025-02-15T09:00:00Z',
    },
  ],
}

const emptyData: AnalyticsData = {
  overview: {
    connectionsSent: 0,
    connectionsAccepted: 0,
    acceptanceRate: 0,
    messagesSent: 0,
    repliesReceived: 0,
    replyRate: 0,
    totalLeads: 0,
    activeCampaigns: 0,
    outreachScore: 0,
    weekOverWeek: { connectionsSent: 0, messagesSent: 0 },
  },
  funnel: [],
  dailyActivity: [],
  campaigns: [],
  recentActivity: [],
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AnalyticsDashboard', () => {
  it('renders overview metric cards', () => {
    render(<AnalyticsDashboard data={mockData} />)
    // Labels may appear in both metric card and funnel section
    expect(screen.getAllByText('Connections Sent').length).toBeGreaterThanOrEqual(1)
    // '150' also appears in metric card + funnel
    expect(screen.getAllByText('150').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Acceptance Rate')).toBeInTheDocument()
    expect(screen.getAllByText('Messages Sent').length).toBeGreaterThanOrEqual(1)
  })

  it('renders outreach score', () => {
    render(<AnalyticsDashboard data={mockData} />)
    expect(screen.getByText('Outreach Score')).toBeInTheDocument()
    expect(screen.getByText('68')).toBeInTheDocument()
  })

  it('renders funnel steps', () => {
    render(<AnalyticsDashboard data={mockData} />)
    expect(screen.getByText('Total Leads')).toBeInTheDocument()
    expect(screen.getByText('Accepted')).toBeInTheDocument()
    // 'Replies' may appear in multiple places (funnel + activity feed)
    expect(screen.getAllByText(/Replies|Reply/).length).toBeGreaterThan(0)
  })

  it('renders campaign table rows', () => {
    render(<AnalyticsDashboard data={mockData} />)
    expect(screen.getByText('Q1 Outreach')).toBeInTheDocument()
    expect(screen.getByText('Winter Campaign')).toBeInTheDocument()
  })

  it('renders recent activity feed', () => {
    render(<AnalyticsDashboard data={mockData} />)
    expect(screen.getByText(/John Doe/)).toBeInTheDocument()
    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument()
  })

  it('renders empty state when no data', () => {
    render(<AnalyticsDashboard data={emptyData} />)
    // The empty state should have some call to action or empty message
    expect(screen.queryByText('Outreach Score')).not.toBeInTheDocument()
  })

  it('shows week-over-week change indicators', () => {
    render(<AnalyticsDashboard data={mockData} />)
    // Positive change should show some indicator
    expect(screen.getByText(/15%/)).toBeInTheDocument()
  })

  it('shows campaign status badges', () => {
    render(<AnalyticsDashboard data={mockData} />)
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Paused')).toBeInTheDocument()
  })
})
