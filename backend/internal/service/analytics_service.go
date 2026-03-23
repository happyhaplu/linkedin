package service

import (
	"math"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"github.com/reach/backend/internal/repository"
)

// AnalyticsService aggregates data from campaigns, activity logs, campaign
// leads, and leads to produce the full analytics dashboard payload.
type AnalyticsService struct {
	repo *repository.AnalyticsRepository
}

func NewAnalyticsService(repo *repository.AnalyticsRepository) *AnalyticsService {
	return &AnalyticsService{repo: repo}
}

// ── Public API ──────────────────────────────────────────────────────────────

func (s *AnalyticsService) GetAnalyticsData(userID uuid.UUID) (*models.AnalyticsData, error) {
	// ── 1. Fetch all campaigns ──────────────────────────────────────────────
	campaigns, err := s.repo.FindCampaignsByUser(userID)
	if err != nil {
		return nil, err
	}

	campaignIDs := make([]uuid.UUID, len(campaigns))
	for i, c := range campaigns {
		campaignIDs[i] = c.ID
	}

	activeCampaigns := 0
	connectionsSent := 0
	connectionsAccepted := 0
	messagesSent := 0
	repliesReceived := 0
	totalLeads := 0

	for _, c := range campaigns {
		if c.Status == models.CampaignStatusActive || c.Status == "running" {
			activeCampaigns++
		}
		connectionsSent += c.ConnectionSent
		connectionsAccepted += c.ConnectionAccepted
		messagesSent += c.MessagesSent
		repliesReceived += c.RepliesReceived
		totalLeads += c.TotalLeads
	}

	var acceptanceRate float64
	if connectionsSent > 0 {
		acceptanceRate = float64(connectionsAccepted) / float64(connectionsSent)
	}
	var replyRate float64
	if messagesSent > 0 {
		replyRate = float64(repliesReceived) / float64(messagesSent)
	}

	// ── 2. Week-over-week comparison ────────────────────────────────────────
	wow := models.WeekOverWeek{}
	if len(campaignIDs) > 0 {
		thisMonday, lastMonday := weekBounds()

		thisWeekCounts, err := s.repo.CountActivitiesByType(campaignIDs, thisMonday, time.Time{})
		if err != nil {
			return nil, err
		}
		lastWeekCounts, err := s.repo.CountActivitiesByType(campaignIDs, lastMonday, thisMonday)
		if err != nil {
			return nil, err
		}

		twConn := countByType(thisWeekCounts, "connection_request")
		lwConn := countByType(lastWeekCounts, "connection_request")
		twMsg := countByType(thisWeekCounts, "message_sent")
		lwMsg := countByType(lastWeekCounts, "message_sent")

		wow.ConnectionsSent = pctChange(twConn, lwConn)
		wow.MessagesSent = pctChange(twMsg, lwMsg)
	}

	// ── 3. Outreach Score (0-100) ───────────────────────────────────────────
	accScore := math.Min(100, (acceptanceRate/0.5)*100)
	repScore := math.Min(100, (replyRate/0.25)*100)
	activeScore := 0.0
	if activeCampaigns > 0 {
		activeScore = 100
	}
	outreachScore := int(math.Round(accScore*0.5 + repScore*0.3 + activeScore*0.2))

	// ── 4. Funnel ───────────────────────────────────────────────────────────
	pct := func(num, denom int) int {
		if denom <= 0 {
			return 0
		}
		return int(math.Round(float64(num) / float64(denom) * 100))
	}
	funnel := []models.FunnelStep{
		{Label: "Total Leads", Value: totalLeads, Pct: 100, Color: "bg-gray-400"},
		{Label: "Connections Sent", Value: connectionsSent, Pct: pct(connectionsSent, totalLeads), Color: "bg-blue-500"},
		{Label: "Accepted", Value: connectionsAccepted, Pct: pct(connectionsAccepted, totalLeads), Color: "bg-emerald-500"},
		{Label: "Messages Sent", Value: messagesSent, Pct: pct(messagesSent, totalLeads), Color: "bg-purple-500"},
		{Label: "Replies", Value: repliesReceived, Pct: pct(repliesReceived, totalLeads), Color: "bg-amber-500"},
	}

	// ── 5. Daily activity (14 days) ─────────────────────────────────────────
	dailyActivity := buildEmptyDays(14)

	if len(campaignIDs) > 0 {
		cutoff := time.Now().AddDate(0, 0, -14)
		logs, err := s.repo.FindDailyLogs(campaignIDs, cutoff)
		if err != nil {
			return nil, err
		}

		dateMap := make(map[string]*models.DailyActivity, len(dailyActivity))
		for i := range dailyActivity {
			dateMap[dailyActivity[i].Date] = &dailyActivity[i]
		}

		for _, log := range logs {
			key := log.ExecutedAt.Format("2006-01-02")
			entry, ok := dateMap[key]
			if !ok {
				continue
			}
			switch log.ActivityType {
			case "connection_request":
				entry.ConnectionsSent++
			case "message_sent":
				entry.MessagesSent++
			case "reply_received":
				entry.Replies++
			}
		}

		for i := range dailyActivity {
			dailyActivity[i].Total = dailyActivity[i].ConnectionsSent + dailyActivity[i].MessagesSent + dailyActivity[i].Replies
		}
	}

	// ── 6. Campaign performance table ───────────────────────────────────────
	campaignRows := make([]models.CampaignRow, 0, len(campaigns))
	for _, c := range campaigns {
		var ar float64
		if c.ConnectionSent > 0 {
			ar = float64(c.ConnectionAccepted) / float64(c.ConnectionSent)
		}
		var rr float64
		if c.MessagesSent > 0 {
			rr = float64(c.RepliesReceived) / float64(c.MessagesSent)
		}
		campaignRows = append(campaignRows, models.CampaignRow{
			ID:              c.ID.String(),
			Name:            c.Name,
			Status:          string(c.Status),
			TotalLeads:      c.TotalLeads,
			ConnectionsSent: c.ConnectionSent,
			AcceptanceRate:  ar,
			MessagesSent:    c.MessagesSent,
			ReplyRate:       rr,
		})
	}
	sort.Slice(campaignRows, func(i, j int) bool {
		return campaignRows[i].AcceptanceRate > campaignRows[j].AcceptanceRate
	})

	// ── 7. Recent activity feed (25 items) ──────────────────────────────────
	recentActivity := make([]models.ActivityEvent, 0)

	if len(campaignIDs) > 0 {
		recentLogs, err := s.repo.FindRecentLogs(campaignIDs)
		if err != nil {
			return nil, err
		}

		if len(recentLogs) > 0 {
			// Batch-resolve lead names via campaign_leads → leads
			nameMap := s.resolveLeadNames(recentLogs)

			// Build campaign id → name map
			cMap := make(map[uuid.UUID]string, len(campaigns))
			for _, c := range campaigns {
				cMap[c.ID] = c.Name
			}

			for _, l := range recentLogs {
				campaignName := cMap[l.CampaignID]
				if campaignName == "" {
					campaignName = "Campaign"
				}

				var leadName *string
				if l.CampaignLeadID != nil {
					if n, ok := nameMap[*l.CampaignLeadID]; ok {
						leadName = &n
					}
				}

				recentActivity = append(recentActivity, models.ActivityEvent{
					ID:           l.ID.String(),
					Type:         l.ActivityType,
					Status:       l.ActivityStatus,
					LeadName:     leadName,
					CampaignName: campaignName,
					Time:         l.ExecutedAt.Format(time.RFC3339),
				})
			}
		}
	}

	return &models.AnalyticsData{
		Overview: models.OverviewMetrics{
			ConnectionsSent:     connectionsSent,
			ConnectionsAccepted: connectionsAccepted,
			AcceptanceRate:      acceptanceRate,
			MessagesSent:        messagesSent,
			RepliesReceived:     repliesReceived,
			ReplyRate:           replyRate,
			TotalLeads:          totalLeads,
			ActiveCampaigns:     activeCampaigns,
			OutreachScore:       outreachScore,
			WeekOverWeek:        wow,
		},
		Funnel:         funnel,
		DailyActivity:  dailyActivity,
		Campaigns:      campaignRows,
		RecentActivity: recentActivity,
	}, nil
}

// ── Private helpers ─────────────────────────────────────────────────────────

// weekBounds returns the start of the current week (Monday 00:00 UTC)
// and the start of the previous week.
func weekBounds() (thisMonday, lastMonday time.Time) {
	now := time.Now().UTC()
	weekday := int(now.Weekday())
	if weekday == 0 {
		weekday = 7 // Sunday = 7
	}
	thisMonday = time.Date(now.Year(), now.Month(), now.Day()-(weekday-1), 0, 0, 0, 0, time.UTC)
	lastMonday = thisMonday.AddDate(0, 0, -7)
	return
}

// pctChange calculates the percentage change between current and previous values.
func pctChange(cur, prev int64) float64 {
	if prev == 0 {
		if cur > 0 {
			return 100
		}
		return 0
	}
	return math.Round(float64(cur-prev) / float64(prev) * 100)
}

// countByType finds the count for a specific activity_type in the aggregation results.
func countByType(counts []repository.ActivityTypeCount, actType string) int64 {
	for _, c := range counts {
		if c.ActivityType == actType {
			return c.Count
		}
	}
	return 0
}

// buildEmptyDays creates an array of N DailyActivity entries going back N days
// from today (inclusive), in ascending chronological order.
func buildEmptyDays(n int) []models.DailyActivity {
	days := make([]models.DailyActivity, n)
	now := time.Now()
	for i := 0; i < n; i++ {
		d := now.AddDate(0, 0, -(n - 1 - i))
		days[i] = models.DailyActivity{
			Date:  d.Format("2006-01-02"),
			Label: d.Format("Jan 2"),
		}
	}
	return days
}

// resolveLeadNames batch-resolves campaign_lead_id → lead full_name for the
// recent activity feed entries.
func (s *AnalyticsService) resolveLeadNames(logs []repository.RecentLog) map[uuid.UUID]string {
	nameMap := make(map[uuid.UUID]string)

	// Collect unique campaign_lead IDs
	clIDSet := make(map[uuid.UUID]struct{})
	for _, l := range logs {
		if l.CampaignLeadID != nil {
			clIDSet[*l.CampaignLeadID] = struct{}{}
		}
	}
	if len(clIDSet) == 0 {
		return nameMap
	}

	clIDs := make([]uuid.UUID, 0, len(clIDSet))
	for id := range clIDSet {
		clIDs = append(clIDs, id)
	}

	// campaign_leads → lead_id
	mappings, err := s.repo.FindCampaignLeadMappings(clIDs)
	if err != nil || len(mappings) == 0 {
		return nameMap
	}

	leadIDs := make([]uuid.UUID, 0, len(mappings))
	clToLeadID := make(map[uuid.UUID]uuid.UUID, len(mappings))
	for _, m := range mappings {
		clToLeadID[m.ID] = m.LeadID
		leadIDs = append(leadIDs, m.LeadID)
	}

	// leads → full_name
	leadNames, err := s.repo.FindLeadNames(leadIDs)
	if err != nil {
		return nameMap
	}

	leadIDToName := make(map[uuid.UUID]string, len(leadNames))
	for _, ln := range leadNames {
		name := "Someone"
		if ln.FullName != nil && *ln.FullName != "" {
			name = *ln.FullName
		}
		leadIDToName[ln.ID] = name
	}

	// Map campaign_lead_id → full_name
	for clID, leadID := range clToLeadID {
		if name, ok := leadIDToName[leadID]; ok {
			nameMap[clID] = name
		}
	}

	return nameMap
}
