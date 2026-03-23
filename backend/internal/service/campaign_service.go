package service

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"github.com/reach/backend/internal/repository"
)

// CampaignService handles campaign business logic.
type CampaignService struct {
	campaignRepo  *repository.CampaignRepository
	senderRepo    *repository.CampaignSenderRepository
	sequenceRepo  *repository.CampaignSequenceRepository
	leadRepo      *repository.CampaignLeadRepository
	activityRepo  *repository.CampaignActivityRepository
	counterRepo   *repository.DailyCounterRepository
	webhookRepo   *repository.CampaignWebhookRepository
	whLogRepo     *repository.CampaignWebhookLogRepository
	accountRepo   *repository.LinkedInAccountRepository
	leadDataRepo  *repository.LeadRepository
}

func NewCampaignService(
	campaignRepo *repository.CampaignRepository,
	senderRepo *repository.CampaignSenderRepository,
	sequenceRepo *repository.CampaignSequenceRepository,
	leadRepo *repository.CampaignLeadRepository,
	activityRepo *repository.CampaignActivityRepository,
	counterRepo *repository.DailyCounterRepository,
	webhookRepo *repository.CampaignWebhookRepository,
	whLogRepo *repository.CampaignWebhookLogRepository,
	accountRepo *repository.LinkedInAccountRepository,
	leadDataRepo *repository.LeadRepository,
) *CampaignService {
	return &CampaignService{
		campaignRepo:  campaignRepo,
		senderRepo:    senderRepo,
		sequenceRepo:  sequenceRepo,
		leadRepo:      leadRepo,
		activityRepo:  activityRepo,
		counterRepo:   counterRepo,
		webhookRepo:   webhookRepo,
		whLogRepo:     whLogRepo,
		accountRepo:   accountRepo,
		leadDataRepo:  leadDataRepo,
	}
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// normalizeTime normalises a working-hours value to HH:MM.
func normalizeTime(val *string, fallback string) string {
	if val == nil || *val == "" {
		return fallback
	}
	s := strings.TrimSpace(*val)

	// Already HH:MM or HH:MM:SS
	if len(s) >= 4 && s[1] == ':' || (len(s) >= 5 && s[2] == ':') {
		parts := strings.Split(s, ":")
		if len(parts) >= 2 {
			h := parts[0]
			m := parts[1]
			if len(h) == 1 {
				h = "0" + h
			}
			if len(m) == 1 {
				m = "0" + m
			}
			return h + ":" + m
		}
	}

	// Bare number like '9' or '18'
	var n int
	if _, err := fmt.Sscanf(s, "%d", &n); err == nil && n >= 0 && n <= 23 {
		return fmt.Sprintf("%02d:00", n)
	}
	return fallback
}

func intOrDefault(v *int, def int) int {
	if v != nil {
		return *v
	}
	return def
}

func boolOrDefault(v *bool, def bool) bool {
	if v != nil {
		return *v
	}
	return def
}

func floatOrDefault(v *float64, def float64) float64 {
	if v != nil {
		return *v
	}
	return def
}

func stringOrDefault(v *string, def string) string {
	if v != nil && *v != "" {
		return *v
	}
	return def
}

func strPtr(s string) *string { return &s }
func intPtr(n int) *int       { return &n }

// =============================================
// CAMPAIGN CRUD
// =============================================

// GetCampaigns returns all campaigns for a user with optional filters.
func (s *CampaignService) GetCampaigns(userID uuid.UUID, status, search *string) ([]models.Campaign, error) {
	campaigns, err := s.campaignRepo.FindAllByUser(userID, status, search)
	if err != nil {
		return nil, err
	}

	// Attach senders if we have campaigns
	if len(campaigns) > 0 {
		ids := make([]uuid.UUID, len(campaigns))
		for i, c := range campaigns {
			ids[i] = c.ID
		}
		senders, err := s.senderRepo.FindByCampaignIDs(ids)
		if err != nil {
			log.Printf("[CampaignService] Error fetching senders: %v", err)
		} else {
			senderMap := make(map[uuid.UUID][]models.CampaignSender)
			for _, sender := range senders {
				senderMap[sender.CampaignID] = append(senderMap[sender.CampaignID], sender)
			}
			for i := range campaigns {
				campaigns[i].Senders = senderMap[campaigns[i].ID]
			}
		}
	}

	return campaigns, nil
}

// GetCampaignByID returns a single campaign with senders and sequences.
func (s *CampaignService) GetCampaignByID(campaignID, userID uuid.UUID) (*models.Campaign, error) {
	c, err := s.campaignRepo.FindByID(campaignID, userID)
	if err != nil {
		return nil, err
	}

	// Fetch senders with LinkedIn account data
	senders, _ := s.senderRepo.FindByCampaignIDWithAccount(campaignID)
	c.Senders = senders

	// Fetch sequences
	seqs, _ := s.sequenceRepo.FindByCampaignID(campaignID)
	c.Sequences = seqs

	return c, nil
}

// CreateCampaign creates a new campaign with senders, sequences, and auto-populated leads.
func (s *CampaignService) CreateCampaign(userID uuid.UUID, input models.CreateCampaignInput) (*models.Campaign, error) {
	dailyLimit := intOrDefault(input.DailyLimit, 50)
	timezone := stringOrDefault(input.Timezone, "UTC")
	whStart := normalizeTime(input.WorkingHoursStart, "08:00")
	whEnd := normalizeTime(input.WorkingHoursEnd, "18:00")
	workingDays := input.WorkingDays
	if len(workingDays) == 0 {
		workingDays = []string{"Mon", "Tue", "Wed", "Thu", "Fri"}
	}
	delayMin := intOrDefault(input.DelayMinSeconds, 45)
	delayMax := intOrDefault(input.DelayMaxSeconds, 120)
	warmUp := boolOrDefault(input.WarmUpEnabled, false)
	warmUpDays := intOrDefault(input.WarmUpDays, 14)
	skipContacted := boolOrDefault(input.SkipAlreadyContacted, true)
	stopOnReply := boolOrDefault(input.StopOnReply, true)

	// Auto-pause threshold: UI sends 10 (=10%), DB stores 0.10
	autoPause := 0.15
	if input.AutoPauseBelowAcceptance != nil {
		autoPause = *input.AutoPauseBelowAcceptance / 100
	}

	var leadListID *uuid.UUID
	if input.LeadListID != nil && *input.LeadListID != "" {
		parsed, err := uuid.Parse(*input.LeadListID)
		if err == nil {
			leadListID = &parsed
		}
	}

	campaign := models.Campaign{
		UserID:               userID,
		Name:                 input.Name,
		Description:          input.Description,
		Status:               models.CampaignStatusDraft,
		LeadListID:           leadListID,
		DailyLimit:           dailyLimit,
		Timezone:             timezone,
		WorkingHoursStart:    &whStart,
		WorkingHoursEnd:      &whEnd,
		WorkingDays:          models.StringArray(workingDays),
		DelayMinSeconds:      &delayMin,
		DelayMaxSeconds:      &delayMax,
		WarmUpEnabled:        &warmUp,
		WarmUpDays:           &warmUpDays,
		AutoPauseBelowAccept: &autoPause,
		SkipAlreadyContacted: &skipContacted,
		StopOnReply:          &stopOnReply,
	}

	if err := s.campaignRepo.Create(&campaign); err != nil {
		return nil, fmt.Errorf("error creating campaign: %w", err)
	}

	// Add senders
	if len(input.SenderIDs) > 0 {
		var senders []models.CampaignSender
		for _, sid := range input.SenderIDs {
			accountID, err := uuid.Parse(sid)
			if err != nil {
				continue
			}
			senders = append(senders, models.CampaignSender{
				CampaignID:        campaign.ID,
				LinkedInAccountID: accountID,
				IsActive:          true,
				DailyLimit:        dailyLimit,
			})
		}
		if err := s.senderRepo.Create(senders); err != nil {
			// Rollback campaign
			_ = s.campaignRepo.Delete(campaign.ID, userID)
			return nil, fmt.Errorf("error adding senders: %w", err)
		}
	}

	// Add sequences
	if len(input.Sequences) > 0 {
		var seqs []models.CampaignSequence
		for _, seq := range input.Sequences {
			abEnabled := boolOrDefault(seq.ABTestEnabled, false)
			cs := models.CampaignSequence{
				CampaignID:       campaign.ID,
				StepNumber:       seq.StepNumber,
				StepType:         models.SequenceStepType(seq.StepType),
				MessageTemplate:  seq.MessageTemplate,
				SubjectTemplate:  seq.SubjectTemplate,
				PostURL:          seq.PostURL,
				MessageTemplateB: seq.MessageTemplateB,
				ABTestEnabled:    &abEnabled,
				ABTestWinner:     seq.ABTestWinner,
				DelayDays:        intOrDefault(seq.DelayDays, 0),
				DelayHours:       intOrDefault(seq.DelayHours, 0),
			}
			if seq.ConditionType != nil && *seq.ConditionType != "" {
				ct := models.ConditionType(*seq.ConditionType)
				cs.ConditionType = &ct
			}
			if seq.ParentStepID != nil && *seq.ParentStepID != "" {
				pid, err := uuid.Parse(*seq.ParentStepID)
				if err == nil {
					cs.ParentStepID = &pid
				}
			}
			seqs = append(seqs, cs)
		}
		if err := s.sequenceRepo.Create(seqs); err != nil {
			// Rollback
			_ = s.senderRepo.DeleteByCampaignID(campaign.ID)
			_ = s.campaignRepo.Delete(campaign.ID, userID)
			return nil, fmt.Errorf("error adding sequences: %w", err)
		}
	}

	// Auto-populate leads from lead list if provided
	if leadListID != nil {
		go func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("[CampaignService] Panic in auto-populate: %v", r)
				}
			}()
			listLeads, err := s.leadDataRepo.FindByListID(*leadListID)
			if err != nil || len(listLeads) == 0 {
				return
			}

			// Get senders for round-robin
			cSenders, _ := s.senderRepo.FindActiveByCampaignID(campaign.ID)

			// Check existing to skip duplicates
			existingIDs, _ := s.leadRepo.FindExistingLeadIDs(campaign.ID)
			existingSet := make(map[uuid.UUID]bool)
			for _, eid := range existingIDs {
				existingSet[eid] = true
			}

			var newLeads []models.CampaignLead
			idx := 0
			for _, lead := range listLeads {
				if existingSet[lead.ID] {
					continue
				}
				cl := models.CampaignLead{
					CampaignID: campaign.ID,
					LeadID:     lead.ID,
					Status:     models.CampaignLeadStatusPending,
				}
				if len(cSenders) > 0 {
					sid := cSenders[idx%len(cSenders)].ID
					cl.SenderID = &sid
				}
				newLeads = append(newLeads, cl)
				idx++
			}

			if len(newLeads) > 0 {
				if err := s.leadRepo.Create(newLeads); err != nil {
					log.Printf("[CampaignService] Failed to auto-populate leads: %v", err)
				}
				// Update campaign lead count
				_ = s.campaignRepo.UpdateFields(campaign.ID, map[string]interface{}{
					"total_leads": len(newLeads),
				})
				log.Printf("[CampaignService] Auto-populated %d leads for campaign %s", len(newLeads), campaign.ID)
			}
		}()
	}

	return &campaign, nil
}

// UpdateCampaign updates campaign fields.
func (s *CampaignService) UpdateCampaign(campaignID, userID uuid.UUID, input models.UpdateCampaignInput) (*models.Campaign, error) {
	c, err := s.campaignRepo.FindByID(campaignID, userID)
	if err != nil {
		return nil, err
	}

	if input.Name != nil {
		c.Name = *input.Name
	}
	if input.Description != nil {
		c.Description = input.Description
	}
	if input.DailyLimit != nil {
		c.DailyLimit = *input.DailyLimit
	}
	if input.Timezone != nil {
		c.Timezone = *input.Timezone
	}
	if input.Status != nil {
		c.Status = models.CampaignStatus(*input.Status)
	}
	if input.WorkingHoursStart != nil {
		normalized := normalizeTime(input.WorkingHoursStart, "08:00")
		c.WorkingHoursStart = &normalized
	}
	if input.WorkingHoursEnd != nil {
		normalized := normalizeTime(input.WorkingHoursEnd, "18:00")
		c.WorkingHoursEnd = &normalized
	}
	if input.WorkingDays != nil {
		c.WorkingDays = models.StringArray(input.WorkingDays)
	}
	if input.DelayMinSeconds != nil {
		c.DelayMinSeconds = input.DelayMinSeconds
	}
	if input.DelayMaxSeconds != nil {
		c.DelayMaxSeconds = input.DelayMaxSeconds
	}
	if input.WarmUpEnabled != nil {
		c.WarmUpEnabled = input.WarmUpEnabled
	}
	if input.WarmUpDays != nil {
		c.WarmUpDays = input.WarmUpDays
	}
	if input.AutoPauseBelowAcceptance != nil {
		c.AutoPauseBelowAccept = input.AutoPauseBelowAcceptance
	}
	if input.SkipAlreadyContacted != nil {
		c.SkipAlreadyContacted = input.SkipAlreadyContacted
	}
	if input.StopOnReply != nil {
		c.StopOnReply = input.StopOnReply
	}

	if err := s.campaignRepo.Update(c); err != nil {
		return nil, err
	}
	return c, nil
}

// DeleteCampaign removes a campaign and all related data.
func (s *CampaignService) DeleteCampaign(campaignID, userID uuid.UUID) error {
	return s.campaignRepo.Delete(campaignID, userID)
}

// =============================================
// CAMPAIGN SEQUENCES
// =============================================

// GetCampaignSequences returns sequences for a campaign.
func (s *CampaignService) GetCampaignSequences(campaignID uuid.UUID) ([]models.CampaignSequence, error) {
	return s.sequenceRepo.FindByCampaignID(campaignID)
}

// UpdateCampaignSequence updates a sequence step.
func (s *CampaignService) UpdateCampaignSequence(seqID uuid.UUID, fields map[string]interface{}) (*models.CampaignSequence, error) {
	if err := s.sequenceRepo.UpdateFields(seqID, fields); err != nil {
		return nil, err
	}
	return s.sequenceRepo.FindByID(seqID)
}

// =============================================
// CAMPAIGN LEADS
// =============================================

// GetCampaignLeads returns leads for a campaign with optional filters.
func (s *CampaignService) GetCampaignLeads(campaignID uuid.UUID, status, senderID *string) ([]models.CampaignLead, error) {
	return s.leadRepo.FindByCampaignID(campaignID, status, senderID)
}

// AddLeadsToCampaign adds leads to a campaign with round-robin sender assignment.
func (s *CampaignService) AddLeadsToCampaign(campaignID uuid.UUID, leadIDs []string) ([]models.CampaignLead, error) {
	// Get active senders for distribution
	senders, _ := s.senderRepo.FindActiveByCampaignID(campaignID)

	var leads []models.CampaignLead
	for i, lid := range leadIDs {
		leadID, err := uuid.Parse(lid)
		if err != nil {
			continue
		}
		cl := models.CampaignLead{
			CampaignID: campaignID,
			LeadID:     leadID,
			Status:     models.CampaignLeadStatusPending,
		}
		if len(senders) > 0 {
			sid := senders[i%len(senders)].ID
			cl.SenderID = &sid
		}
		leads = append(leads, cl)
	}

	if err := s.leadRepo.Create(leads); err != nil {
		return nil, err
	}
	return leads, nil
}

// RemoveLeadsFromCampaign removes campaign leads by IDs.
func (s *CampaignService) RemoveLeadsFromCampaign(campaignLeadIDs []string) error {
	ids := make([]uuid.UUID, 0, len(campaignLeadIDs))
	for _, id := range campaignLeadIDs {
		parsed, err := uuid.Parse(id)
		if err != nil {
			continue
		}
		ids = append(ids, parsed)
	}
	return s.leadRepo.Delete(ids)
}

// AddLeadsFromList adds all leads from a list, skipping duplicates.
func (s *CampaignService) AddLeadsFromList(campaignID uuid.UUID, listID string, userID uuid.UUID) (int, error) {
	parsedListID, err := uuid.Parse(listID)
	if err != nil {
		return 0, fmt.Errorf("invalid list ID")
	}

	// Get leads from the list
	listLeads, err := s.leadDataRepo.FindByListID(parsedListID)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch leads from list: %w", err)
	}
	if len(listLeads) == 0 {
		return 0, nil
	}

	// Check existing campaign leads to skip duplicates
	existingIDs, err := s.leadRepo.FindExistingLeadIDs(campaignID)
	if err != nil {
		return 0, err
	}
	existingSet := make(map[uuid.UUID]bool)
	for _, id := range existingIDs {
		existingSet[id] = true
	}

	// Get active senders for round-robin
	senders, _ := s.senderRepo.FindActiveByCampaignID(campaignID)

	var newLeads []models.CampaignLead
	idx := 0
	for _, lead := range listLeads {
		if existingSet[lead.ID] {
			continue
		}
		cl := models.CampaignLead{
			CampaignID: campaignID,
			LeadID:     lead.ID,
			Status:     models.CampaignLeadStatusPending,
		}
		if len(senders) > 0 {
			sid := senders[idx%len(senders)].ID
			cl.SenderID = &sid
		}
		newLeads = append(newLeads, cl)
		idx++
	}

	if len(newLeads) == 0 {
		return 0, nil
	}

	if err := s.leadRepo.Create(newLeads); err != nil {
		return 0, err
	}

	return len(newLeads), nil
}

// ExportCampaignLeads returns CSV content for campaign leads.
func (s *CampaignService) ExportCampaignLeads(campaignID uuid.UUID) (string, error) {
	leads, err := s.leadRepo.FindByCampaignID(campaignID, nil, nil)
	if err != nil {
		return "", err
	}

	// Collect lead IDs for batch lookup
	leadIDs := make([]uuid.UUID, len(leads))
	for i, cl := range leads {
		leadIDs[i] = cl.LeadID
	}

	// Fetch lead data
	leadDataList, _ := s.leadDataRepo.FindByIDs(leadIDs)
	leadMap := make(map[uuid.UUID]*models.Lead)
	for i := range leadDataList {
		leadMap[leadDataList[i].ID] = &leadDataList[i]
	}

	headers := "Name,Company,Position,Email,LinkedIn URL,Status,Connection Sent,Connection Accepted,Messages Sent,Replies Received,First Reply"
	var rows []string
	for _, cl := range leads {
		name, company, position, email, linkedinURL := "", "", "", "", ""
		if ld, ok := leadMap[cl.LeadID]; ok {
			if ld.FullName != nil {
				name = *ld.FullName
			} else if ld.FirstName != nil {
				name = *ld.FirstName
				if ld.LastName != nil {
					name += " " + *ld.LastName
				}
			}
			if ld.Company != nil {
				company = *ld.Company
			}
			if ld.Position != nil {
				position = *ld.Position
			}
			if ld.Email != nil {
				email = *ld.Email
			}
			if ld.LinkedInURL != nil {
				linkedinURL = *ld.LinkedInURL
			}
		}

		row := fmt.Sprintf("%s,%s,%s,%s,%s,%s,%s,%s,%d,%d,%s",
			csvEscape(name),
			csvEscape(company),
			csvEscape(position),
			csvEscape(email),
			csvEscape(linkedinURL),
			string(cl.Status),
			timeOrEmpty(cl.ConnectionSentAt),
			timeOrEmpty(cl.ConnectionAcceptedAt),
			cl.TotalMessagesSent,
			cl.TotalRepliesReceived,
			timeOrEmpty(cl.RepliedAt),
		)
		rows = append(rows, row)
	}

	csv := headers + "\n" + strings.Join(rows, "\n")
	return csv, nil
}

// csvEscape wraps a value in quotes if it contains commas or quotes.
func csvEscape(val string) string {
	if strings.ContainsAny(val, ",\"\n") {
		return "\"" + strings.ReplaceAll(val, "\"", "\"\"") + "\""
	}
	return val
}

func timeOrEmpty(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format(time.RFC3339)
}

// =============================================
// CAMPAIGN STATISTICS
// =============================================

// GetCampaignStats returns aggregate stats across all campaigns for a user.
func (s *CampaignService) GetCampaignStats(userID uuid.UUID) (*models.CampaignStats, error) {
	total, _ := s.campaignRepo.CountByUser(userID)
	active, _ := s.campaignRepo.CountActiveByUser(userID)
	campaigns, _ := s.campaignRepo.FindAllMetricsByUser(userID)

	var totalLeads, repliedLeads, connectionSent, connectionAccepted int
	for _, c := range campaigns {
		totalLeads += c.TotalLeads
		repliedLeads += c.RepliedLeads
		connectionSent += c.ConnectionSent
		connectionAccepted += c.ConnectionAccepted
	}

	connAcceptRate := 0.0
	if connectionSent > 0 {
		connAcceptRate = float64(connectionAccepted) / float64(connectionSent) * 100
	}
	replyRate := 0.0
	if totalLeads > 0 {
		replyRate = float64(repliedLeads) / float64(totalLeads) * 100
	}

	return &models.CampaignStats{
		TotalCampaigns:       int(total),
		ActiveCampaigns:      int(active),
		TotalLeads:           totalLeads,
		RepliedLeads:         repliedLeads,
		ConnectionAcceptRate: connAcceptRate,
		ReplyRate:            replyRate,
	}, nil
}

// GetCampaignPerformance returns campaign data with daily activity.
func (s *CampaignService) GetCampaignPerformance(campaignID, userID uuid.UUID) (map[string]interface{}, error) {
	campaign, err := s.campaignRepo.FindByID(campaignID, userID)
	if err != nil {
		return nil, err
	}

	activity, _ := s.activityRepo.FindDailyActivity(campaignID)

	return map[string]interface{}{
		"campaign":      campaign,
		"dailyActivity": activity,
	}, nil
}

// GetSequencePerformance returns sequence step metrics.
func (s *CampaignService) GetSequencePerformance(campaignID uuid.UUID) ([]models.CampaignSequence, error) {
	return s.sequenceRepo.FindByCampaignID(campaignID)
}

// GetSenderPerformance returns sender metrics with account info.
func (s *CampaignService) GetSenderPerformance(campaignID uuid.UUID) ([]models.CampaignSender, error) {
	return s.senderRepo.FindByCampaignIDWithAccount(campaignID)
}

// =============================================
// ACTIVITY
// =============================================

// LogActivity inserts a campaign activity log entry.
func (s *CampaignService) LogActivity(
	campaignID uuid.UUID,
	campaignLeadID *uuid.UUID,
	activityType models.ActivityType,
	activityStatus models.ActivityStatus,
	messageContent, errorMessage *string,
) error {
	entry := models.CampaignActivityLog{
		CampaignID:     campaignID,
		CampaignLeadID: campaignLeadID,
		ActivityType:   activityType,
		ActivityStatus: activityStatus,
		MessageContent: messageContent,
		ErrorMessage:   errorMessage,
	}
	return s.activityRepo.Create(&entry)
}

// GetActivityLog returns activity logs for a campaign.
func (s *CampaignService) GetActivityLog(campaignID uuid.UUID, limit int) ([]models.CampaignActivityLog, error) {
	if limit <= 0 {
		limit = 100
	}
	return s.activityRepo.FindByCampaignID(campaignID, limit)
}

// =============================================
// ANALYTICS
// =============================================

// GetCampaignAnalytics returns comprehensive analytics for a campaign.
func (s *CampaignService) GetCampaignAnalytics(campaignID uuid.UUID) (*models.CampaignAnalytics, error) {
	leads, err := s.leadRepo.FindAnalyticsLeads(campaignID)
	if err != nil {
		return nil, err
	}

	total := len(leads)
	sent := 0
	accepted := 0
	messaged := 0
	replied := 0

	for _, l := range leads {
		if l.ConnectionSentAt != nil {
			sent++
		}
		if l.ConnectionAcceptedAt != nil {
			accepted++
		}
		if l.FirstMessageSentAt != nil {
			messaged++
		}
		if l.FirstReplyAt != nil {
			replied++
		}
	}

	funnel := models.CampaignAnalyticsFunnel{
		TotalLeads: total,
		Sent:       sent,
		Accepted:   accepted,
		Messaged:   messaged,
		Replied:    replied,
	}
	if total > 0 {
		funnel.SentPct = sent * 100 / total
	}
	if sent > 0 {
		funnel.AcceptedPct = accepted * 100 / sent
	}
	if accepted > 0 {
		funnel.MessagedPct = messaged * 100 / accepted
	}
	if messaged > 0 {
		funnel.RepliedPct = replied * 100 / messaged
	}

	// Today's stats
	today := time.Now().Format("2006-01-02")

	// Resolve sender_ids → linkedin_account_ids
	campaignSenderIDs := make(map[uuid.UUID]bool)
	for _, l := range leads {
		if l.SenderID != nil {
			campaignSenderIDs[*l.SenderID] = true
		}
	}

	var connectionsToday, messagesToday, acceptedToday, repliesToday int

	// Count today's accepted and replies from lead dates
	for _, l := range leads {
		if l.ConnectionAcceptedAt != nil && l.ConnectionAcceptedAt.Format("2006-01-02") == today {
			acceptedToday++
		}
		if l.FirstReplyAt != nil && l.FirstReplyAt.Format("2006-01-02") == today {
			repliesToday++
		}
	}

	// Get today's counters from daily counters (resolve through senders)
	senderIDs := make([]uuid.UUID, 0)
	for sid := range campaignSenderIDs {
		senderIDs = append(senderIDs, sid)
	}

	if len(senderIDs) > 0 {
		senderRows, _ := s.senderRepo.FindByCampaignID(campaignID)
		accountIDs := make([]uuid.UUID, 0)
		for _, sr := range senderRows {
			accountIDs = append(accountIDs, sr.LinkedInAccountID)
		}

		if len(accountIDs) > 0 {
			counters, _ := s.counterRepo.FindByAccountIDsAndDate(accountIDs, today)
			for _, c := range counters {
				connectionsToday += c.ConnectionsSent
				messagesToday += c.MessagesSent
			}
		}
	}

	campaign, _ := s.campaignRepo.FindByIDUnscoped(campaignID)
	dailyLimit := 50
	if campaign != nil {
		dailyLimit = campaign.DailyLimit
	}

	todayStats := models.CampaignAnalyticsToday{
		ConnectionsSent:     connectionsToday,
		ConnectionsAccepted: acceptedToday,
		MessagesSent:        messagesToday,
		RepliesReceived:     repliesToday,
		DailyLimit:          dailyLimit,
	}

	// 7-day trend
	trend := make([]models.CampaignAnalyticsTrend, 7)
	for i := 6; i >= 0; i-- {
		d := time.Now().AddDate(0, 0, -i)
		dateStr := d.Format("2006-01-02")
		connections := 0
		replies := 0
		for _, l := range leads {
			if l.ConnectionSentAt != nil && l.ConnectionSentAt.Format("2006-01-02") == dateStr {
				connections++
			}
			if l.FirstReplyAt != nil && l.FirstReplyAt.Format("2006-01-02") == dateStr {
				replies++
			}
		}
		trend[6-i] = models.CampaignAnalyticsTrend{
			Date:        dateStr,
			Connections: connections,
			Replies:     replies,
		}
	}

	// Per-step breakdown
	sequences, _ := s.sequenceRepo.FindByCampaignID(campaignID)
	perStep := make([]models.CampaignAnalyticsPerStep, 0, len(sequences))
	for _, seq := range sequences {
		stepSent := 0
		converted := 0
		for _, l := range leads {
			switch seq.StepType {
			case models.StepTypeConnectionRequest:
				if l.ConnectionSentAt != nil {
					stepSent++
				}
				if l.ConnectionAcceptedAt != nil {
					converted++
				}
			case models.StepTypeMessage:
				if l.FirstMessageSentAt != nil {
					stepSent++
				}
				if l.FirstReplyAt != nil {
					converted++
				}
			}
		}
		rate := 0
		if stepSent > 0 {
			rate = converted * 100 / stepSent
		}
		perStep = append(perStep, models.CampaignAnalyticsPerStep{
			StepNumber: seq.StepNumber,
			StepType:   string(seq.StepType),
			Sent:       stepSent,
			Converted:  converted,
			Rate:       rate,
		})
	}

	// A/B results
	abResults := make([]models.CampaignAnalyticsABResult, 0)
	for _, seq := range sequences {
		if seq.ABTestEnabled != nil && *seq.ABTestEnabled {
			var aLeads, bLeads []models.CampaignLead
			for _, l := range leads {
				if l.Variant != nil && *l.Variant == "A" {
					aLeads = append(aLeads, l)
				} else if l.Variant != nil && *l.Variant == "B" {
					bLeads = append(bLeads, l)
				}
			}
			aReplied := 0
			for _, l := range aLeads {
				if l.FirstReplyAt != nil {
					aReplied++
				}
			}
			bReplied := 0
			for _, l := range bLeads {
				if l.FirstReplyAt != nil {
					bReplied++
				}
			}
			aRate := 0
			if len(aLeads) > 0 {
				aRate = aReplied * 100 / len(aLeads)
			}
			bRate := 0
			if len(bLeads) > 0 {
				bRate = bReplied * 100 / len(bLeads)
			}
			abResults = append(abResults, models.CampaignAnalyticsABResult{
				StepID:          seq.ID.String(),
				VariantASent:    len(aLeads),
				VariantAReplied: aReplied,
				VariantARate:    aRate,
				VariantBSent:    len(bLeads),
				VariantBReplied: bReplied,
				VariantBRate:    bRate,
				Winner:          seq.ABTestWinner,
			})
		}
	}

	// Per-sender leaderboard
	senderRows, _ := s.senderRepo.FindByCampaignIDWithAccount(campaignID)
	perSender := make([]models.CampaignAnalyticsPerSender, 0, len(senderRows))
	for _, sr := range senderRows {
		profileName := "Unknown"
		if sr.LinkedInAccount != nil && sr.LinkedInAccount.ProfileName != nil {
			profileName = *sr.LinkedInAccount.ProfileName
		}
		perSender = append(perSender, models.CampaignAnalyticsPerSender{
			AccountID:       sr.LinkedInAccountID.String(),
			ProfileName:     profileName,
			ConnectionsSent: sr.ConnectionSent,
			Accepted:        sr.ConnectionAccepted,
			MessagesSent:    sr.MessagesSent,
			Replied:         sr.RepliesReceived,
		})
	}

	return &models.CampaignAnalytics{
		Funnel:    funnel,
		Today:     todayStats,
		Trend:     trend,
		PerStep:   perStep,
		ABResults: abResults,
		PerSender: perSender,
	}, nil
}

// =============================================
// A/B TESTING
// =============================================

// DeclareABTestWinner sets the winner and switches losing-variant pending leads.
func (s *CampaignService) DeclareABTestWinner(seqID uuid.UUID, winner string) error {
	if err := s.sequenceRepo.UpdateFields(seqID, map[string]interface{}{
		"ab_test_winner": winner,
	}); err != nil {
		return err
	}

	// Get the campaign ID for this sequence
	seq, err := s.sequenceRepo.FindByID(seqID)
	if err != nil {
		return err
	}

	// Switch losing-variant pending leads to the winner
	losingVariant := "B"
	if winner == "B" {
		losingVariant = "A"
	}

	leads, _ := s.leadRepo.FindByCampaignID(seq.CampaignID, strPtr("pending"), nil)
	for _, l := range leads {
		if l.Variant != nil && *l.Variant == losingVariant {
			_ = s.leadRepo.UpdateFields(l.ID, map[string]interface{}{
				"variant": winner,
			})
		}
	}

	return nil
}

// =============================================
// DUPLICATE CAMPAIGN
// =============================================

// DuplicateCampaign creates a copy of a campaign with its senders and sequences.
func (s *CampaignService) DuplicateCampaign(campaignID, userID uuid.UUID) (*models.Campaign, error) {
	original, err := s.campaignRepo.FindByID(campaignID, userID)
	if err != nil {
		return nil, err
	}

	// Create copy
	copy := *original
	copy.ID = uuid.Nil // will be generated
	copy.Name = original.Name + " (Copy)"
	copy.Status = models.CampaignStatusDraft
	copy.StartedAt = nil
	copy.PausedAt = nil
	copy.CompletedAt = nil
	copy.TotalLeads = 0
	copy.PendingLeads = 0
	copy.CompletedLeads = 0
	copy.RepliedLeads = 0
	copy.ConnectionSent = 0
	copy.ConnectionAccepted = 0
	copy.MessagesSent = 0
	copy.RepliesReceived = 0

	if err := s.campaignRepo.Create(&copy); err != nil {
		return nil, err
	}

	// Copy senders
	senders, _ := s.senderRepo.FindByCampaignID(campaignID)
	if len(senders) > 0 {
		var newSenders []models.CampaignSender
		for _, sender := range senders {
			newSenders = append(newSenders, models.CampaignSender{
				CampaignID:        copy.ID,
				LinkedInAccountID: sender.LinkedInAccountID,
				IsActive:          sender.IsActive,
				DailyLimit:        sender.DailyLimit,
			})
		}
		_ = s.senderRepo.Create(newSenders)
	}

	// Copy sequences
	sequences, _ := s.sequenceRepo.FindByCampaignID(campaignID)
	if len(sequences) > 0 {
		var newSeqs []models.CampaignSequence
		for _, seq := range sequences {
			newSeqs = append(newSeqs, models.CampaignSequence{
				CampaignID:       copy.ID,
				StepNumber:       seq.StepNumber,
				StepType:         seq.StepType,
				MessageTemplate:  seq.MessageTemplate,
				SubjectTemplate:  seq.SubjectTemplate,
				PostURL:          seq.PostURL,
				MessageTemplateB: seq.MessageTemplateB,
				ABTestEnabled:    seq.ABTestEnabled,
				DelayDays:        seq.DelayDays,
				DelayHours:       seq.DelayHours,
				ConditionType:    seq.ConditionType,
			})
		}
		_ = s.sequenceRepo.Create(newSeqs)
	}

	return &copy, nil
}

// =============================================
// CAMPAIGN TEMPLATES (static, no DB)
// =============================================

// GetCampaignTemplates returns pre-built campaign quick-start templates.
func (s *CampaignService) GetCampaignTemplates() []models.CampaignTemplate {
	return []models.CampaignTemplate{
		{
			ID:                      "cold-outreach",
			Name:                    "Cold Outreach",
			Description:             "Connect, follow up with a warm message, then a final nudge.",
			StepCount:               3,
			EstimatedAcceptanceRate: "25–40%",
			Steps: []models.CampaignTemplateStep{
				{StepNumber: 1, StepType: "connection_request", DelayDays: intPtr(0), DelayHours: intPtr(0), MessageTemplate: strPtr("Hi {{firstName}}, {{aiIcebreaker}} I'd love to connect.")},
				{StepNumber: 2, StepType: "message", DelayDays: intPtr(2), DelayHours: intPtr(0), ConditionType: strPtr("accepted"), MessageTemplate: strPtr("Hi {{firstName}}, thanks for connecting! {I work with|I help|I partner with} {{position}}s at companies like {{company}} to achieve great results. Would love to share how.")},
				{StepNumber: 3, StepType: "message", DelayDays: intPtr(5), DelayHours: intPtr(0), ConditionType: strPtr("not_replied"), MessageTemplate: strPtr("Hi {{firstName}}, just wanted to follow up on my previous message. Happy to chat at your convenience!")},
			},
		},
		{
			ID:                      "warm-followup",
			Name:                    "Warm Follow-up",
			Description:             "View profile first for a soft touch, then connect and nurture.",
			StepCount:               3,
			EstimatedAcceptanceRate: "30–45%",
			Steps: []models.CampaignTemplateStep{
				{StepNumber: 1, StepType: "view_profile", DelayDays: intPtr(0), DelayHours: intPtr(0)},
				{StepNumber: 2, StepType: "connection_request", DelayDays: intPtr(1), DelayHours: intPtr(0), MessageTemplate: strPtr("Hi {{firstName}}, I noticed your profile — impressive background at {{company}}. Would love to connect!")},
				{StepNumber: 3, StepType: "message", DelayDays: intPtr(3), DelayHours: intPtr(0), ConditionType: strPtr("accepted"), MessageTemplate: strPtr("Hi {{firstName}}, appreciate the connection! I'd love to explore if there's any synergy between what we do.")},
			},
		},
		{
			ID:                      "recruiter-sequence",
			Name:                    "Recruiter Sequence",
			Description:             "Multi-touch recruiting flow with InMail fallback.",
			StepCount:               4,
			EstimatedAcceptanceRate: "20–35%",
			Steps: []models.CampaignTemplateStep{
				{StepNumber: 1, StepType: "connection_request", DelayDays: intPtr(0), DelayHours: intPtr(0), MessageTemplate: strPtr("Hi {{firstName}}, I came across your profile and was really impressed by your experience at {{company}}. I have an exciting opportunity that might interest you!")},
				{StepNumber: 2, StepType: "inmail", DelayDays: intPtr(1), DelayHours: intPtr(0), ConditionType: strPtr("not_accepted"), SubjectTemplate: strPtr("Exciting opportunity at [Company]"), MessageTemplate: strPtr("Hi {{firstName}}, I reached out via connection request but wanted to make sure this reached you. We have a role that aligns perfectly with your {{position}} expertise.")},
				{StepNumber: 3, StepType: "message", DelayDays: intPtr(4), DelayHours: intPtr(0), ConditionType: strPtr("accepted"), MessageTemplate: strPtr("Hi {{firstName}}, happy to be connected! I'd love to share details about the opportunity — do you have 15 mins this week?")},
				{StepNumber: 4, StepType: "message", DelayDays: intPtr(7), DelayHours: intPtr(0), ConditionType: strPtr("not_replied"), MessageTemplate: strPtr("Hi {{firstName}}, just a gentle follow-up. The role is still open and I think you'd be a great fit. Let me know if you'd like to learn more!")},
			},
		},
	}
}

// =============================================
// CAMPAIGN SENDERS
// =============================================

// AddCampaignSender adds (or re-activates) a LinkedIn account as a campaign sender.
func (s *CampaignService) AddCampaignSender(campaignID, linkedinAccountID, userID uuid.UUID) (*models.CampaignSender, error) {
	// Verify campaign belongs to user
	campaign, err := s.campaignRepo.FindByID(campaignID, userID)
	if err != nil {
		return nil, fmt.Errorf("campaign not found")
	}

	// Verify LinkedIn account belongs to user
	account, err := s.accountRepo.FindByIDAndUser(linkedinAccountID, userID)
	if err != nil || account == nil {
		return nil, fmt.Errorf("LinkedIn account not found")
	}

	sender := models.CampaignSender{
		CampaignID:        campaignID,
		LinkedInAccountID: linkedinAccountID,
		IsActive:          true,
		DailyLimit:        campaign.DailyLimit,
	}

	if err := s.senderRepo.Upsert(&sender); err != nil {
		return nil, fmt.Errorf("failed to add sender: %w", err)
	}

	return &sender, nil
}

// RemoveCampaignSender removes a sender from a campaign.
func (s *CampaignService) RemoveCampaignSender(campaignID, senderID, userID uuid.UUID) error {
	// Verify campaign belongs to user
	_, err := s.campaignRepo.FindByID(campaignID, userID)
	if err != nil {
		return fmt.Errorf("campaign not found")
	}

	return s.senderRepo.Delete(senderID, campaignID)
}

// =============================================
// WEBHOOKS
// =============================================

// GetCampaignWebhooks returns webhooks for a campaign.
func (s *CampaignService) GetCampaignWebhooks(campaignID, userID uuid.UUID) ([]models.CampaignWebhook, error) {
	return s.webhookRepo.FindByCampaignID(campaignID, userID)
}

// CreateCampaignWebhook creates a new webhook.
func (s *CampaignService) CreateCampaignWebhook(campaignID, userID uuid.UUID, url string, secret, description *string, events []string) (*models.CampaignWebhook, error) {
	w := models.CampaignWebhook{
		CampaignID:  campaignID,
		UserID:      userID,
		URL:         url,
		Secret:      secret,
		Description: description,
		Events:      models.StringArray(events),
		IsActive:    true,
	}

	if err := s.webhookRepo.Create(&w); err != nil {
		return nil, err
	}
	return &w, nil
}

// UpdateCampaignWebhook updates a webhook.
func (s *CampaignService) UpdateCampaignWebhook(webhookID, userID uuid.UUID, fields map[string]interface{}) error {
	return s.webhookRepo.UpdateFields(webhookID, userID, fields)
}

// DeleteCampaignWebhook deletes a webhook.
func (s *CampaignService) DeleteCampaignWebhook(webhookID, userID uuid.UUID) error {
	return s.webhookRepo.Delete(webhookID, userID)
}

// GetCampaignWebhookLogs returns webhook delivery logs.
func (s *CampaignService) GetCampaignWebhookLogs(campaignID uuid.UUID, limit int) ([]models.CampaignWebhookLog, error) {
	if limit <= 0 {
		limit = 50
	}
	return s.whLogRepo.FindByCampaignID(campaignID, limit)
}

// =============================================
// LEAD STATS (for stats endpoint)
// =============================================

// GetCampaignLeadStats returns lead counts grouped by status.
func (s *CampaignService) GetCampaignLeadStats(campaignID uuid.UUID) (models.CampaignLeadStats, error) {
	return s.leadRepo.CountByStatus(campaignID)
}
