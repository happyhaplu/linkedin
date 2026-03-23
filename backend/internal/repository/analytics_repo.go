package repository

import (
	"time"

	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// AnalyticsRepository provides read-only queries used by the analytics service.
type AnalyticsRepository struct {
	db *gorm.DB
}

func NewAnalyticsRepository(db *gorm.DB) *AnalyticsRepository {
	return &AnalyticsRepository{db: db}
}

// ── Campaigns ───────────────────────────────────────────────────────────────

// FindCampaignsByUser returns all campaigns for a user ordered by created_at DESC.
func (r *AnalyticsRepository) FindCampaignsByUser(userID uuid.UUID) ([]models.Campaign, error) {
	var campaigns []models.Campaign
	err := r.db.
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&campaigns).Error
	return campaigns, err
}

// ── Activity Logs ───────────────────────────────────────────────────────────

// ActivityTypeCount is a helper struct for aggregated activity counts.
type ActivityTypeCount struct {
	ActivityType string
	Count        int64
}

// CountActivitiesByType counts successful activity logs for given campaigns in
// the time range [from, to).  If 'to' is zero-value, no upper bound is applied.
func (r *AnalyticsRepository) CountActivitiesByType(
	campaignIDs []uuid.UUID, from time.Time, to time.Time,
) ([]ActivityTypeCount, error) {
	q := r.db.Model(&models.CampaignActivityLog{}).
		Select("activity_type, COUNT(*) as count").
		Where("campaign_id IN ? AND activity_status = ? AND executed_at >= ?",
			campaignIDs, "success", from)

	if !to.IsZero() {
		q = q.Where("executed_at < ?", to)
	}

	var results []ActivityTypeCount
	err := q.Group("activity_type").Find(&results).Error
	return results, err
}

// DailyLog is a row returned by the daily-activity aggregation query.
type DailyLog struct {
	ActivityType string
	ExecutedAt   time.Time
}

// FindDailyLogs returns successful activity logs for given campaigns since cutoff,
// with only the fields needed for bucketing by date.
func (r *AnalyticsRepository) FindDailyLogs(
	campaignIDs []uuid.UUID, cutoff time.Time,
) ([]DailyLog, error) {
	var logs []DailyLog
	err := r.db.Model(&models.CampaignActivityLog{}).
		Select("activity_type, executed_at").
		Where("campaign_id IN ? AND activity_status = ? AND executed_at >= ?",
			campaignIDs, "success", cutoff).
		Find(&logs).Error
	return logs, err
}

// RecentLog is a row for the recent activity feed.
type RecentLog struct {
	ID             uuid.UUID
	ActivityType   string
	ActivityStatus string
	ExecutedAt     time.Time
	CampaignID     uuid.UUID
	CampaignLeadID *uuid.UUID
}

// FindRecentLogs returns the latest 25 activity log entries for the given campaigns.
func (r *AnalyticsRepository) FindRecentLogs(campaignIDs []uuid.UUID) ([]RecentLog, error) {
	var logs []RecentLog
	err := r.db.Model(&models.CampaignActivityLog{}).
		Select("id, activity_type, activity_status, executed_at, campaign_id, campaign_lead_id").
		Where("campaign_id IN ?", campaignIDs).
		Order("executed_at DESC").
		Limit(25).
		Find(&logs).Error
	return logs, err
}

// ── Campaign Leads → Lead name resolution ───────────────────────────────────

// CampaignLeadMapping maps a campaign_lead id to its underlying lead_id.
type CampaignLeadMapping struct {
	ID     uuid.UUID
	LeadID uuid.UUID
}

// FindCampaignLeadMappings returns the (id, lead_id) pairs for the given
// campaign_lead IDs.
func (r *AnalyticsRepository) FindCampaignLeadMappings(clIDs []uuid.UUID) ([]CampaignLeadMapping, error) {
	var mappings []CampaignLeadMapping
	err := r.db.Model(&models.CampaignLead{}).
		Select("id, lead_id").
		Where("id IN ?", clIDs).
		Find(&mappings).Error
	return mappings, err
}

// LeadName maps a lead id to its full_name.
type LeadName struct {
	ID       uuid.UUID
	FullName *string
}

// FindLeadNames returns (id, full_name) for the given lead IDs.
func (r *AnalyticsRepository) FindLeadNames(leadIDs []uuid.UUID) ([]LeadName, error) {
	var names []LeadName
	err := r.db.Model(&models.Lead{}).
		Select("id, full_name").
		Where("id IN ?", leadIDs).
		Find(&names).Error
	return names, err
}
