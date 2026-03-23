package models

// ── Analytics Response DTOs ─────────────────────────────────────────────────

// WeekOverWeek holds percentage changes compared to the previous week.
type WeekOverWeek struct {
	ConnectionsSent float64 `json:"connectionsSent"`
	MessagesSent    float64 `json:"messagesSent"`
}

// OverviewMetrics aggregates top-level outreach performance numbers.
type OverviewMetrics struct {
	ConnectionsSent     int          `json:"connectionsSent"`
	ConnectionsAccepted int          `json:"connectionsAccepted"`
	AcceptanceRate      float64      `json:"acceptanceRate"`
	MessagesSent        int          `json:"messagesSent"`
	RepliesReceived     int          `json:"repliesReceived"`
	ReplyRate           float64      `json:"replyRate"`
	TotalLeads          int          `json:"totalLeads"`
	ActiveCampaigns     int          `json:"activeCampaigns"`
	OutreachScore       int          `json:"outreachScore"`
	WeekOverWeek        WeekOverWeek `json:"weekOverWeek"`
}

// FunnelStep represents one tier of the outreach funnel.
type FunnelStep struct {
	Label string `json:"label"`
	Value int    `json:"value"`
	Pct   int    `json:"pct"`
	Color string `json:"color"`
}

// DailyActivity holds per-day activity counts for the 14-day chart.
type DailyActivity struct {
	Date            string `json:"date"`
	Label           string `json:"label"`
	ConnectionsSent int    `json:"connectionsSent"`
	MessagesSent    int    `json:"messagesSent"`
	Replies         int    `json:"replies"`
	Total           int    `json:"total"`
}

// CampaignRow is a simplified campaign for the analytics performance table.
type CampaignRow struct {
	ID              string  `json:"id"`
	Name            string  `json:"name"`
	Status          string  `json:"status"`
	TotalLeads      int     `json:"totalLeads"`
	ConnectionsSent int     `json:"connectionsSent"`
	AcceptanceRate  float64 `json:"acceptanceRate"`
	MessagesSent    int     `json:"messagesSent"`
	ReplyRate       float64 `json:"replyRate"`
}

// ActivityEvent represents a single entry in the recent activity feed.
type ActivityEvent struct {
	ID           string  `json:"id"`
	Type         string  `json:"type"`
	Status       string  `json:"status"`
	LeadName     *string `json:"leadName"`
	CampaignName string  `json:"campaignName"`
	Time         string  `json:"time"`
}

// AnalyticsData is the top-level response returned by GET /api/analytics.
type AnalyticsData struct {
	Overview       OverviewMetrics `json:"overview"`
	Funnel         []FunnelStep    `json:"funnel"`
	DailyActivity  []DailyActivity `json:"dailyActivity"`
	Campaigns      []CampaignRow   `json:"campaigns"`
	RecentActivity []ActivityEvent `json:"recentActivity"`
}
