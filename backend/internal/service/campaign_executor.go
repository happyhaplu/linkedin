package service

import (
	"fmt"
	"log"
	"math"
	"math/rand"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"github.com/reach/backend/internal/repository"
)

// CampaignExecutorService handles campaign lifecycle (start/pause/resume/stop),
// daily limit enforcement, and the core step execution pipeline.
//
// The LinkedInAutomation interface abstracts the actual LinkedIn browser
// automation (Playwright in the TS version). Provide an implementation when
// wiring up the worker; a no-op default is used if nil.
type CampaignExecutorService struct {
	campaignRepo *repository.CampaignRepository
	senderRepo   *repository.CampaignSenderRepository
	sequenceRepo *repository.CampaignSequenceRepository
	leadRepo     *repository.CampaignLeadRepository
	counterRepo  *repository.DailyCounterRepository
	activityRepo *repository.CampaignActivityRepository
	accountRepo  *repository.LinkedInAccountRepository
	leadDataRepo *repository.LeadRepository
	automation   LinkedInAutomation
	webhookSvc   *WebhookService
}

// LinkedInAutomation defines the interface for executing LinkedIn actions.
// Implement this with a Playwright/browser driver, HTTP client, or mock.
type LinkedInAutomation interface {
	SendConnectionRequest(account *models.LinkedInAccount, lead *models.Lead, message string) error
	SendMessage(account *models.LinkedInAccount, lead *models.Lead, message string) error
	SendInMail(account *models.LinkedInAccount, lead *models.Lead, subject, message string) error
	ViewProfile(account *models.LinkedInAccount, lead *models.Lead) error
	FollowProfile(account *models.LinkedInAccount, lead *models.Lead) error
	LikePost(account *models.LinkedInAccount, postURL string) error
}

// StepResult describes the outcome of a single step execution.
type StepResult struct {
	Success        bool
	PermanentError bool   // true = don't retry (profile not found, etc.)
	AlreadyDone    bool   // true = already connected/pending, advance to next
	ErrorMessage   string
}

func NewCampaignExecutorService(
	campaignRepo *repository.CampaignRepository,
	senderRepo *repository.CampaignSenderRepository,
	sequenceRepo *repository.CampaignSequenceRepository,
	leadRepo *repository.CampaignLeadRepository,
	counterRepo *repository.DailyCounterRepository,
	activityRepo *repository.CampaignActivityRepository,
	accountRepo *repository.LinkedInAccountRepository,
	leadDataRepo *repository.LeadRepository,
	automation LinkedInAutomation,
	webhookSvc *WebhookService,
) *CampaignExecutorService {
	return &CampaignExecutorService{
		campaignRepo: campaignRepo,
		senderRepo:   senderRepo,
		sequenceRepo: sequenceRepo,
		leadRepo:     leadRepo,
		counterRepo:  counterRepo,
		activityRepo: activityRepo,
		accountRepo:  accountRepo,
		leadDataRepo: leadDataRepo,
		automation:   automation,
		webhookSvc:   webhookSvc,
	}
}

// ── Result types ────────────────────────────────────────────────────────────

type ExecutorResult struct {
	Success      bool   `json:"success"`
	Message      string `json:"message"`
	QueuedCount  int    `json:"queuedCount,omitempty"`
	StoppedCount int    `json:"stoppedCount,omitempty"`
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// actionCounterColumn maps action types to daily counter columns.
func actionCounterColumn(actionType string) string {
	switch actionType {
	case "connection_request":
		return "connections_sent"
	case "message":
		return "messages_sent"
	case "inmail":
		return "inmails_sent"
	case "view_profile":
		return "profile_views"
	default:
		return "total_actions"
	}
}

// fullDailyLimit returns the default daily limit for an action type.
func fullDailyLimit(actionType string) int {
	switch actionType {
	case "connection_request":
		return 50
	case "message":
		return 100
	case "inmail":
		return 25
	default:
		return 150
	}
}

// =============================================
// START CAMPAIGN
// =============================================

// StartCampaign activates a campaign and prepares leads for processing.
// It sets the campaign status to 'active', assigns senders and variants,
// and returns the number of leads queued for processing.
func (e *CampaignExecutorService) StartCampaign(campaignID uuid.UUID, launchImmediately bool) ExecutorResult {
	campaign, err := e.campaignRepo.FindByIDUnscoped(campaignID)
	if err != nil {
		return ExecutorResult{Success: false, Message: "Campaign not found"}
	}

	// Status pre-validation: reject if already active
	if campaign.Status == models.CampaignStatusActive {
		return ExecutorResult{Success: false, Message: "Campaign is already active"}
	}

	// Get active senders — auto-assign from user's LinkedIn accounts if none
	senders, err := e.senderRepo.FindActiveByCampaignID(campaignID)
	if err != nil || len(senders) == 0 {
		// Auto-assign: find user's active LinkedIn accounts
		accounts, accErr := e.accountRepo.FindAllByUser(campaign.UserID)
		if accErr != nil || len(accounts) == 0 {
			return ExecutorResult{Success: false, Message: "No active senders or LinkedIn accounts available"}
		}

		var autoSenders []models.CampaignSender
		for _, acct := range accounts {
			if acct.Status == models.AccountStatusActive {
				autoSenders = append(autoSenders, models.CampaignSender{
					CampaignID:        campaignID,
					LinkedInAccountID: acct.ID,
					IsActive:          true,
					DailyLimit:        campaign.DailyLimit,
				})
			}
		}
		if len(autoSenders) == 0 {
			return ExecutorResult{Success: false, Message: "No active LinkedIn accounts to auto-assign"}
		}
		if err := e.senderRepo.Create(autoSenders); err != nil {
			return ExecutorResult{Success: false, Message: "Failed to auto-assign senders"}
		}
		senders = autoSenders
		log.Printf("[Campaign Executor] Auto-assigned %d senders for campaign %s", len(senders), campaignID)
	}

	// Get sequences (steps)
	sequences, err := e.sequenceRepo.FindByCampaignID(campaignID)
	if err != nil || len(sequences) == 0 {
		return ExecutorResult{Success: false, Message: "No sequence steps defined"}
	}
	firstStep := sequences[0]

	// Get pending leads
	pendingLeads, _ := e.leadRepo.FindPendingByCampaignID(campaignID)

	// Also get in_progress leads to resume them
	inProgressLeads, _ := e.leadRepo.FindInProgressByCampaignID(campaignID)

	totalLeads := len(pendingLeads) + len(inProgressLeads)
	if totalLeads == 0 {
		return ExecutorResult{Success: false, Message: "No pending leads to process"}
	}

	// Set campaign to active BEFORE enqueuing (workers check campaign status)
	now := time.Now()
	updateFields := map[string]interface{}{
		"status":     "active",
		"started_at": now,
		"updated_at": now,
	}
	if campaign.WarmUpEnabled != nil && *campaign.WarmUpEnabled && campaign.WarmUpStartDate == nil {
		updateFields["warm_up_start_date"] = now
	}
	if err := e.campaignRepo.UpdateFields(campaignID, updateFields); err != nil {
		return ExecutorResult{Success: false, Message: "Failed to activate campaign"}
	}

	queuedCount := 0

	// Process pending leads: assign sender (round-robin) + variant + first step
	for i, lead := range pendingLeads {
		// Round-robin sender assignment
		sender := senders[i%len(senders)]
		senderID := sender.ID

		// Assign A/B variant
		variant := "A"
		if i%2 != 0 {
			variant = "B"
		}

		updates := map[string]interface{}{
			"sender_id":          senderID,
			"variant":            variant,
			"current_step_number": firstStep.StepNumber,
		}
		if err := e.leadRepo.UpdateFields(lead.ID, updates); err != nil {
			log.Printf("[Campaign Executor] Failed to update lead %s: %v", lead.ID, err)
			continue
		}

		// In a full implementation, we'd enqueue a job to the queue here.
		// For now, we mark the lead as ready for processing.
		queuedCount++
	}

	// Resume in_progress leads from their current step
	for _, lead := range inProgressLeads {
		currentStep := 1
		if lead.CurrentStepNumber != nil {
			currentStep = *lead.CurrentStepNumber
		}

		// Find the next step after the current one
		nextSteps, _ := e.sequenceRepo.FindNextSteps(campaignID, currentStep)
		if len(nextSteps) > 0 {
			// Lead has more steps to process
			queuedCount++
		} else {
			// No more steps — mark as completed
			completedAt := time.Now()
			_ = e.leadRepo.UpdateFields(lead.ID, map[string]interface{}{
				"status":       "completed",
				"completed_at": completedAt,
			})
		}
	}

	log.Printf("[Campaign Executor] Started campaign %s: %d leads queued", campaignID, queuedCount)

	return ExecutorResult{
		Success:     true,
		Message:     fmt.Sprintf("Campaign started with %d leads", queuedCount),
		QueuedCount: queuedCount,
	}
}

// =============================================
// PAUSE CAMPAIGN
// =============================================

// PauseCampaign sets campaign status to 'paused' and marks in_progress leads as paused.
func (e *CampaignExecutorService) PauseCampaign(campaignID uuid.UUID) ExecutorResult {
	campaign, err := e.campaignRepo.FindByIDUnscoped(campaignID)
	if err != nil {
		return ExecutorResult{Success: false, Message: "Campaign not found"}
	}
	if campaign.Status != models.CampaignStatusActive {
		return ExecutorResult{Success: false, Message: "Campaign is not active"}
	}

	now := time.Now()
	if updateErr := e.campaignRepo.UpdateFields(campaignID, map[string]interface{}{
		"status":    "paused",
		"paused_at": now,
	}); updateErr != nil {
		return ExecutorResult{Success: false, Message: "Failed to pause campaign"}
	}

	log.Printf("[Campaign Executor] Paused campaign: %s", campaignID)
	return ExecutorResult{Success: true, Message: "Campaign paused"}
}

// =============================================
// RESUME CAMPAIGN
// =============================================

// ResumeCampaign reactivates a paused campaign and re-queues pending/paused leads.
func (e *CampaignExecutorService) ResumeCampaign(campaignID uuid.UUID) ExecutorResult {
	campaign, err := e.campaignRepo.FindByIDUnscoped(campaignID)
	if err != nil {
		return ExecutorResult{Success: false, Message: "Campaign not found"}
	}
	if campaign.Status != models.CampaignStatusPaused {
		return ExecutorResult{Success: false, Message: "Campaign is not paused"}
	}

	// Reactivate paused leads back to pending
	_, _ = e.leadRepo.UpdateStatusByIDs(campaignID, []string{"paused"}, "pending")

	return e.StartCampaign(campaignID, false)
}

// =============================================
// STOP CAMPAIGN
// =============================================

// StopCampaign permanently stops a campaign and marks all pending/in_progress/paused leads as removed.
func (e *CampaignExecutorService) StopCampaign(campaignID uuid.UUID) ExecutorResult {
	campaign, err := e.campaignRepo.FindByIDUnscoped(campaignID)
	if err != nil {
		return ExecutorResult{Success: false, Message: "Campaign not found"}
	}
	if campaign.Status == models.CampaignStatusCompleted || campaign.Status == models.CampaignStatusCanceled {
		return ExecutorResult{Success: false, Message: "Campaign is already stopped"}
	}

	now := time.Now()
	if updateErr := e.campaignRepo.UpdateFields(campaignID, map[string]interface{}{
		"status":       "completed",
		"completed_at": now,
	}); updateErr != nil {
		return ExecutorResult{Success: false, Message: "Failed to stop campaign"}
	}

	// Mark all pending/in_progress/paused leads as removed
	affected, err := e.leadRepo.UpdateStatusByIDs(
		campaignID,
		[]string{"pending", "in_progress", "paused"},
		"removed",
	)
	if err != nil {
		log.Printf("[Campaign Executor] Error marking leads as removed: %v", err)
	}

	log.Printf("[Campaign Executor] Stopped campaign %s: %d leads removed", campaignID, affected)

	return ExecutorResult{
		Success:      true,
		Message:      "Campaign stopped",
		StoppedCount: int(affected),
	}
}

// =============================================
// DAILY LIMITS
// =============================================

// CheckDailyLimit verifies whether a sender can perform an action.
func (e *CampaignExecutorService) CheckDailyLimit(
	senderAccountID uuid.UUID,
	actionType string,
	campaign *models.Campaign,
) bool {
	today := time.Now().Format("2006-01-02")
	col := actionCounterColumn(actionType)
	limit := fullDailyLimit(actionType)

	// Warm-up ramp
	effectiveLimit := limit
	if campaign != nil && campaign.WarmUpEnabled != nil && *campaign.WarmUpEnabled && campaign.WarmUpStartDate != nil {
		diffDays := int(time.Since(*campaign.WarmUpStartDate).Hours() / 24)
		warmUpDays := 14
		if campaign.WarmUpDays != nil {
			warmUpDays = *campaign.WarmUpDays
		}
		effectiveLimit = int(math.Min(
			float64(5+diffDays*(limit-5)/warmUpDays),
			float64(limit),
		))
	}

	// Check today's count
	counter, err := e.counterRepo.FindByAccountAndDate(senderAccountID, today)
	if err != nil {
		// No counter yet — can proceed
		return true
	}

	var usedToday int
	switch col {
	case "connections_sent":
		usedToday = counter.ConnectionsSent
	case "messages_sent":
		usedToday = counter.MessagesSent
	case "inmails_sent":
		usedToday = counter.InMailsSent
	case "profile_views":
		usedToday = counter.ProfileViews
	default:
		usedToday = counter.TotalActions
	}

	if usedToday >= effectiveLimit {
		return false
	}

	// Weekly rolling limit for connection requests (LinkedIn: ~100/week)
	if actionType == "connection_request" {
		sevenDaysAgo := time.Now().AddDate(0, 0, -7).Format("2006-01-02")
		weeklyTotal, err := e.counterRepo.SumWeeklyConnections(senderAccountID, sevenDaysAgo)
		if err == nil && weeklyTotal >= 100 {
			log.Printf("[Daily Limit] Weekly connection limit reached for %s: %d/100", senderAccountID, weeklyTotal)
			return false
		}
	}

	return true
}

// IncrementDailyCounter upserts and increments the daily counter for an action.
func (e *CampaignExecutorService) IncrementDailyCounter(senderAccountID uuid.UUID, actionType string) {
	today := time.Now().Format("2006-01-02")
	col := actionCounterColumn(actionType)
	if err := e.counterRepo.IncrementColumn(senderAccountID, today, col); err != nil {
		log.Printf("[Daily Counter] Error incrementing: %v", err)
	}
}

// =============================================
// A/B VARIANT ASSIGNMENT
// =============================================

// AssignVariant assigns an A/B variant to a campaign lead.
func (e *CampaignExecutorService) AssignVariant(campaignLeadID, campaignID uuid.UUID) string {
	count, _ := e.leadRepo.CountByCampaignID(campaignID)
	variant := "A"
	if count%2 != 0 {
		variant = "B"
	}

	_ = e.leadRepo.UpdateFields(campaignLeadID, map[string]interface{}{
		"variant": variant,
	})

	return variant
}

// =============================================
// ACCEPTANCE RATE CIRCUIT BREAKER
// =============================================

// CheckAcceptanceRateCircuitBreaker auto-pauses campaign if acceptance rate drops below threshold.
func (e *CampaignExecutorService) CheckAcceptanceRateCircuitBreaker(campaignID uuid.UUID) {
	campaign, err := e.campaignRepo.FindByIDUnscoped(campaignID)
	if err != nil || campaign.Status != models.CampaignStatusActive {
		return
	}

	sent := campaign.ConnectionSent
	accepted := campaign.ConnectionAccepted
	threshold := 0.15
	if campaign.AutoPauseBelowAccept != nil {
		threshold = *campaign.AutoPauseBelowAccept
	}

	if sent > 20 {
		rate := float64(accepted) / float64(sent)
		if rate < threshold {
			now := time.Now()
			_ = e.campaignRepo.UpdateFields(campaignID, map[string]interface{}{
				"status":    "paused",
				"paused_at": now,
			})
			log.Printf("[Circuit Breaker] Campaign %s auto-paused. Acceptance rate %.1f%% < %.0f%% threshold",
				campaignID, rate*100, threshold*100)
		}
	}
}

// =============================================
// UPDATE LEAD STATUS
// =============================================

// UpdateCampaignLeadStatus updates a lead after an action is executed.
func (e *CampaignExecutorService) UpdateCampaignLeadStatus(campaignLeadID uuid.UUID, stepType, stepID string) {
	now := time.Now()
	updates := map[string]interface{}{
		"status":     "in_progress",
		"started_at": now,
		"updated_at": now,
	}

	switch stepType {
	case "connection_request":
		updates["connection_sent_at"] = now
	case "message":
		updates["first_message_sent_at"] = now
	}

	// Track current step number
	if stepID != "" {
		parsedID, err := uuid.Parse(stepID)
		if err == nil {
			step, err := e.sequenceRepo.FindByID(parsedID)
			if err == nil && step != nil {
				updates["current_step_number"] = step.StepNumber
			}
		}
	}

	if err := e.leadRepo.UpdateFields(campaignLeadID, updates); err != nil {
		log.Printf("[Campaign Executor] updateCampaignLeadStatus failed: %v", err)
	}
}

// UpdateSenderStats atomically increments sender and campaign stat counters.
func (e *CampaignExecutorService) UpdateSenderStats(campaignID, senderAccountID uuid.UUID, stepType string) {
	switch stepType {
	case "connection_request":
		_ = e.senderRepo.IncrementStat(campaignID, senderAccountID, "connection_sent")
		_ = e.campaignRepo.IncrementStat(campaignID, "connection_sent")
	case "message", "inmail":
		_ = e.senderRepo.IncrementStat(campaignID, senderAccountID, "messages_sent")
		_ = e.campaignRepo.IncrementStat(campaignID, "messages_sent")
	}
}

// =============================================
// QUEUE NEXT STEP
// =============================================

// QueueNextStep finds the next eligible step and prepares the lead for it.
func (e *CampaignExecutorService) QueueNextStep(
	campaignID, campaignLeadID uuid.UUID,
	currentStepID string,
	senderAccountID uuid.UUID,
) {
	// Find current step number
	var currentStepNumber int
	if currentStepID != "" {
		parsedID, err := uuid.Parse(currentStepID)
		if err == nil {
			step, err := e.sequenceRepo.FindByID(parsedID)
			if err == nil && step != nil {
				currentStepNumber = step.StepNumber
			}
		}
	}

	// Fetch remaining steps
	remainingSteps, err := e.sequenceRepo.FindNextSteps(campaignID, currentStepNumber)
	if err != nil || len(remainingSteps) == 0 {
		// No more steps — mark as completed
		now := time.Now()
		_ = e.leadRepo.UpdateFields(campaignLeadID, map[string]interface{}{
			"status":       "completed",
			"completed_at": now,
		})
		log.Printf("[Campaign Executor] Lead %s completed all steps", campaignLeadID)
		return
	}

	// Get campaign lead data for condition evaluation
	campaignLead, err := e.leadRepo.FindByID(campaignLeadID)
	if err != nil {
		log.Printf("[Campaign Executor] Failed to find lead %s: %v", campaignLeadID, err)
		return
	}

	// Evaluate conditions for each step
	var nextStep *models.CampaignSequence
	for i := range remainingSteps {
		step := &remainingSteps[i]
		if step.ConditionType == nil {
			nextStep = step
			break
		}

		hasAccepted := campaignLead.ConnectionAcceptedAt != nil
		hasReplied := campaignLead.RepliedAt != nil || campaignLead.Status == models.CampaignLeadStatusCompleted

		switch *step.ConditionType {
		case models.ConditionAccepted:
			if hasAccepted {
				nextStep = step
			}
		case models.ConditionNotAccepted:
			if !hasAccepted {
				nextStep = step
			}
		case models.ConditionReplied:
			if hasReplied {
				nextStep = step
			}
		case models.ConditionNotReplied:
			if !hasReplied {
				nextStep = step
			}
		default:
			// Unknown condition — skip
			log.Printf("[queueNextStep] Skipping step %d (condition '%s' not met for lead %s)",
				step.StepNumber, *step.ConditionType, campaignLeadID)
			continue
		}

		if nextStep != nil {
			break
		}
		log.Printf("[queueNextStep] Skipping step %d (condition '%s' not met for lead %s)",
			step.StepNumber, *step.ConditionType, campaignLeadID)
	}

	if nextStep == nil {
		// All remaining steps had unmet conditions
		now := time.Now()
		_ = e.leadRepo.UpdateFields(campaignLeadID, map[string]interface{}{
			"status":       "completed",
			"completed_at": now,
		})
		log.Printf("[Campaign Executor] Lead %s completed (no eligible steps remain)", campaignLeadID)
		return
	}

	// Update lead with next step info for the worker to pick up
	_ = e.leadRepo.UpdateFields(campaignLeadID, map[string]interface{}{
		"current_step_number": nextStep.StepNumber,
		"current_step_id":     nextStep.ID,
	})

	log.Printf("[Campaign Executor] Lead %s queued for step %d (%s)", campaignLeadID, nextStep.StepNumber, nextStep.StepType)
}

// =============================================
// WORKING HOURS
// =============================================

// IsWithinWorkingHours checks if the current time is within campaign working hours.
func (e *CampaignExecutorService) IsWithinWorkingHours(campaign *models.Campaign) (bool, time.Duration) {
	if campaign.WorkingHoursStart == nil || campaign.WorkingHoursEnd == nil {
		return true, 0
	}

	tz := campaign.Timezone
	if tz == "" {
		tz = "UTC"
	}

	loc, err := time.LoadLocation(tz)
	if err != nil {
		loc = time.UTC
	}

	now := time.Now().In(loc)
	dayName := now.Format("Mon")

	// Check working days
	workDays := []string{"Mon", "Tue", "Wed", "Thu", "Fri"}
	if len(campaign.WorkingDays) > 0 {
		workDays = []string(campaign.WorkingDays)
	}

	isWorkDay := false
	for _, d := range workDays {
		if d == dayName {
			isWorkDay = true
			break
		}
	}

	// Parse start/end times
	startParts := strings.Split(*campaign.WorkingHoursStart, ":")
	endParts := strings.Split(*campaign.WorkingHoursEnd, ":")
	if len(startParts) < 2 || len(endParts) < 2 {
		return true, 0
	}

	var startH, startM, endH, endM int
	fmt.Sscanf(startParts[0], "%d", &startH)
	fmt.Sscanf(startParts[1], "%d", &startM)
	fmt.Sscanf(endParts[0], "%d", &endH)
	fmt.Sscanf(endParts[1], "%d", &endM)

	nowMinutes := now.Hour()*60 + now.Minute()
	startMinutes := startH*60 + startM
	endMinutes := endH*60 + endM

	if isWorkDay && nowMinutes >= startMinutes && nowMinutes < endMinutes {
		return true, 0
	}

	// Calculate delay until next working window
	var minutesUntilNext int

	if !isWorkDay || nowMinutes >= endMinutes {
		// After today's window or not a work day — advance to next work day
		minutesUntilNext = (24*60 - nowMinutes) // minutes until midnight

		// Walk forward up to 7 days to find next work day
		candidate := now.Add(time.Duration(minutesUntilNext) * time.Minute)
		for i := 0; i < 7; i++ {
			candidateDay := candidate.Format("Mon")
			found := false
			for _, d := range workDays {
				if d == candidateDay {
					found = true
					break
				}
			}
			if found {
				break
			}
			minutesUntilNext += 24 * 60
			candidate = candidate.Add(24 * time.Hour)
		}
		minutesUntilNext += startMinutes
	} else {
		// Before today's window on a work day
		minutesUntilNext = startMinutes - nowMinutes
	}

	return false, time.Duration(minutesUntilNext) * time.Minute
}

// =============================================
// CALCULATE DELAY
// =============================================

// CalculateDelay computes the delay for a step including jitter and working hours.
func (e *CampaignExecutorService) CalculateDelay(step *models.CampaignSequence, campaign *models.Campaign) time.Duration {
	baseMs := float64(step.DelayDays*86400+step.DelayHours*3600) * 1000

	// Random jitter
	minSec := 45.0
	maxSec := 120.0
	if campaign != nil && campaign.DelayMinSeconds != nil {
		minSec = float64(*campaign.DelayMinSeconds)
	}
	if campaign != nil && campaign.DelayMaxSeconds != nil {
		maxSec = float64(*campaign.DelayMaxSeconds)
	}
	jitterMs := (rand.Float64()*(maxSec-minSec) + minSec) * 1000

	totalMs := baseMs + jitterMs

	// Working-hours adjustment
	if campaign != nil {
		inHours, delay := e.IsWithinWorkingHours(campaign)
		if !inHours && delay > 0 {
			totalMs = math.Max(totalMs, float64(delay.Milliseconds()))
		}
	}

	return time.Duration(math.Max(totalMs, jitterMs)) * time.Millisecond
}

// =============================================
// CROSS-CAMPAIGN DEDUPLICATION
// =============================================

// IsAlreadyBeingContacted checks if a lead is enrolled in another active campaign.
func (e *CampaignExecutorService) IsAlreadyBeingContacted(leadID, campaignID uuid.UUID) bool {
	if e.leadDataRepo == nil {
		return false
	}
	contacted, err := e.leadDataRepo.IsBeingContactedInOtherCampaign(leadID, campaignID)
	if err != nil {
		return false
	}
	return contacted
}

// =============================================
// PROCESS CAMPAIGN LEAD STEP (core execution)
// =============================================

// ProcessCampaignLeadStep is the core execution function that processes a single
// step for a campaign lead. This is the Go equivalent of the TS processCampaignLeadStep.
//
// It orchestrates: status checks → stop-on-reply → template processing →
// daily limit check → automation dispatch → stats update → webhook fire →
// circuit breaker → queue next step.
//
// A worker (goroutine scheduler, asynq, etc.) should call this for each lead/step job.
func (e *CampaignExecutorService) ProcessCampaignLeadStep(
	campaignID, campaignLeadID, stepID uuid.UUID,
	senderAccountID uuid.UUID,
) StepResult {
	// 1. Verify campaign is still active
	campaign, err := e.campaignRepo.FindByIDUnscoped(campaignID)
	if err != nil || campaign.Status != models.CampaignStatusActive {
		return StepResult{Success: false, PermanentError: true, ErrorMessage: "Campaign is no longer active"}
	}

	// 2. Get campaign lead, verify still in_progress
	campaignLead, err := e.leadRepo.FindByID(campaignLeadID)
	if err != nil {
		return StepResult{Success: false, PermanentError: true, ErrorMessage: "Campaign lead not found"}
	}
	if campaignLead.Status != models.CampaignLeadStatusInProgress &&
		campaignLead.Status != models.CampaignLeadStatusPending {
		return StepResult{Success: false, PermanentError: true,
			ErrorMessage: fmt.Sprintf("Lead status is %s, skipping", campaignLead.Status)}
	}

	// Mark as in_progress
	_ = e.leadRepo.UpdateFields(campaignLeadID, map[string]interface{}{
		"status":          "in_progress",
		"last_activity_at": time.Now(),
	})

	// 3. Stop-on-reply check
	if campaign.StopOnReply != nil && *campaign.StopOnReply && campaignLead.RepliedAt != nil {
		now := time.Now()
		_ = e.leadRepo.UpdateFields(campaignLeadID, map[string]interface{}{
			"status":       "completed",
			"completed_at": now,
		})
		log.Printf("[Executor] Lead %s replied, stopping sequence", campaignLeadID)
		return StepResult{Success: true, AlreadyDone: true}
	}

	// 4. Skip-already-contacted check
	if campaign.SkipAlreadyContacted != nil && *campaign.SkipAlreadyContacted {
		if e.IsAlreadyBeingContacted(campaignLead.LeadID, campaignID) {
			_ = e.leadRepo.UpdateFields(campaignLeadID, map[string]interface{}{
				"status": "skipped",
			})
			log.Printf("[Executor] Lead %s is being contacted in another campaign, skipping", campaignLeadID)
			return StepResult{Success: true, AlreadyDone: true}
		}
	}

	// 5. Get the sequence step
	step, err := e.sequenceRepo.FindByID(stepID)
	if err != nil || step == nil {
		return StepResult{Success: false, PermanentError: true, ErrorMessage: "Sequence step not found"}
	}

	// 6. Resolve lead data
	var leadData *models.Lead
	if e.leadDataRepo != nil {
		leadData, _ = e.leadDataRepo.FindByID(campaignLead.LeadID)
	}
	if leadData == nil {
		return StepResult{Success: false, PermanentError: true, ErrorMessage: "Lead data not found"}
	}

	// 7. Resolve sender account
	account, err := e.accountRepo.FindByID(senderAccountID)
	if err != nil || account == nil {
		return StepResult{Success: false, PermanentError: true, ErrorMessage: "Sender account not found"}
	}

	// Check account is still connected
	if account.Status != models.AccountStatusActive {
		// Auto-pause campaign on disconnected account
		errMsg := "Sender account disconnected"
		_ = e.campaignRepo.UpdateFields(campaignID, map[string]interface{}{
			"status":    "paused",
			"paused_at": time.Now(),
		})
		log.Printf("[Executor] Auto-pausing campaign %s: %s", campaignID, errMsg)
		return StepResult{Success: false, PermanentError: false, ErrorMessage: errMsg}
	}

	// 8. Check daily limit
	canProceed := e.CheckDailyLimit(senderAccountID, string(step.StepType), campaign)
	if !canProceed {
		// Re-schedule for next working window
		log.Printf("[Executor] Daily limit reached for account %s, deferring", senderAccountID)
		return StepResult{Success: false, PermanentError: false, ErrorMessage: "Daily limit reached"}
	}

	// 9. A/B variant template selection
	template := step.MessageTemplate
	if campaignLead.Variant != nil && *campaignLead.Variant == "B" &&
		step.ABTestEnabled != nil && *step.ABTestEnabled &&
		step.MessageTemplateB != nil {
		template = step.MessageTemplateB
	}

	// 10. Process template with lead data
	processedMessage := ""
	processedSubject := ""
	if template != nil && *template != "" {
		vars := &TemplateVariables{}
		if leadData.FirstName != nil {
			vars.FirstName = *leadData.FirstName
		}
		if leadData.LastName != nil {
			vars.LastName = *leadData.LastName
		}
		if leadData.FullName != nil {
			vars.FullName = *leadData.FullName
		} else {
			vars.FullName = vars.FirstName + " " + vars.LastName
		}
		if leadData.Company != nil {
			vars.Company = *leadData.Company
		}
		if leadData.Position != nil {
			vars.Position = *leadData.Position
		}
		if leadData.Location != nil {
			vars.Location = *leadData.Location
		}
		if leadData.Headline != nil {
			vars.Headline = *leadData.Headline
		}
		if leadData.Email != nil {
			vars.Email = *leadData.Email
		}
		if leadData.LinkedInURL != nil {
			vars.LinkedInURL = *leadData.LinkedInURL
		}
		if leadData.AIIcebreaker != nil {
			vars.AIIcebreaker = *leadData.AIIcebreaker
		}

		processedMessage = ProcessTemplate(*template, vars)

		if step.SubjectTemplate != nil && *step.SubjectTemplate != "" {
			processedSubject = ProcessTemplate(*step.SubjectTemplate, vars)
		}
	}

	// 11. Dispatch by step type
	result := e.executeStep(step.StepType, account, leadData, processedMessage, processedSubject, step.PostURL)

	// 12. Log activity
	activityStatus := models.ActivityStatusSuccess
	var errMsgPtr *string
	if !result.Success {
		activityStatus = models.ActivityStatusFailed
		errMsgPtr = &result.ErrorMessage
	}
	var msgPtr *string
	if processedMessage != "" {
		msgPtr = &processedMessage
	}
	_ = e.activityRepo.Create(&models.CampaignActivityLog{
		CampaignID:     campaignID,
		CampaignLeadID: &campaignLeadID,
		ActivityType:   models.ActivityType(step.StepType),
		ActivityStatus: activityStatus,
		MessageContent: msgPtr,
		ErrorMessage:   errMsgPtr,
	})

	if result.Success || result.AlreadyDone {
		// 13. Update lead status
		e.UpdateCampaignLeadStatus(campaignLeadID, string(step.StepType), stepID.String())

		// 14. Update sender stats
		e.UpdateSenderStats(campaignID, senderAccountID, string(step.StepType))

		// 15. Increment daily counter
		e.IncrementDailyCounter(senderAccountID, string(step.StepType))

		// 16. Check circuit breaker
		e.CheckAcceptanceRateCircuitBreaker(campaignID)

		// 16b. Fire webhook
		if e.webhookSvc != nil {
			var whEvent WebhookEvent
			switch step.StepType {
			case models.StepTypeConnectionRequest:
				whEvent = WebhookEventConnectionSent
			case models.StepTypeMessage, models.StepTypeInMail:
				whEvent = WebhookEventMessageSent
			}
			if whEvent != "" {
				var whLead *WebhookLeadData
				if leadData != nil {
					whLead = &WebhookLeadData{
						ID: leadData.ID.String(),
					}
					if leadData.FullName != nil {
						whLead.FullName = *leadData.FullName
					}
					if leadData.Company != nil {
						whLead.Company = *leadData.Company
					}
					if leadData.Position != nil {
						whLead.Position = *leadData.Position
					}
					if leadData.LinkedInURL != nil {
						whLead.LinkedInURL = *leadData.LinkedInURL
					}
				}
				e.webhookSvc.TriggerWebhook(whEvent, campaignID, campaign.Name, whLead, nil)
			}
		}

		// 17. Queue next step
		e.QueueNextStep(campaignID, campaignLeadID, stepID.String(), senderAccountID)

		return StepResult{Success: true}
	}

	// Handle failure
	if result.PermanentError {
		errStr := result.ErrorMessage
		_ = e.leadRepo.UpdateFields(campaignLeadID, map[string]interface{}{
			"status":        "failed",
			"error_message": errStr,
		})
		// Increment campaign failure count
		_ = e.campaignRepo.IncrementStat(campaignID, "failed_leads")
		log.Printf("[Executor] Permanent error for lead %s: %s", campaignLeadID, errStr)
	} else {
		// Retryable error — increment retry count
		newRetry := campaignLead.RetryCount + 1
		maxRetries := 3
		if newRetry >= maxRetries {
			errStr := fmt.Sprintf("Max retries exceeded: %s", result.ErrorMessage)
			_ = e.leadRepo.UpdateFields(campaignLeadID, map[string]interface{}{
				"status":        "failed",
				"error_message": errStr,
				"retry_count":   newRetry,
			})
		} else {
			_ = e.leadRepo.UpdateFields(campaignLeadID, map[string]interface{}{
				"retry_count":   newRetry,
				"error_message": result.ErrorMessage,
			})
		}
	}

	return result
}

// executeStep dispatches to the appropriate LinkedIn automation method.
func (e *CampaignExecutorService) executeStep(
	stepType models.SequenceStepType,
	account *models.LinkedInAccount,
	lead *models.Lead,
	message, subject string,
	postURL *string,
) StepResult {
	if e.automation == nil {
		log.Printf("[Executor] No automation implementation configured, step %s will be a no-op", stepType)
		return StepResult{Success: true}
	}

	var err error
	switch stepType {
	case models.StepTypeConnectionRequest:
		err = e.automation.SendConnectionRequest(account, lead, message)
	case models.StepTypeMessage:
		err = e.automation.SendMessage(account, lead, message)
	case models.StepTypeInMail:
		err = e.automation.SendInMail(account, lead, subject, message)
	case models.StepTypeViewProfile:
		err = e.automation.ViewProfile(account, lead)
	case models.StepTypeFollow:
		err = e.automation.FollowProfile(account, lead)
	case models.StepTypeLikePost:
		url := ""
		if postURL != nil {
			url = *postURL
		}
		err = e.automation.LikePost(account, url)
	case models.StepTypeDelay:
		// Delay steps are handled by the scheduler, not automation
		return StepResult{Success: true}
	case models.StepTypeEmail:
		// Email sending would be handled by a separate email service
		log.Printf("[Executor] Email step not yet implemented")
		return StepResult{Success: true}
	default:
		return StepResult{Success: false, PermanentError: true,
			ErrorMessage: fmt.Sprintf("Unknown step type: %s", stepType)}
	}

	if err != nil {
		errMsg := err.Error()
		// "Already connected" / "invitation already pending" → treat as success, advance to next step
		if isAlreadyDoneError(errMsg) {
			log.Printf("[Executor] Step %s: %s — treating as already done", stepType, errMsg)
			return StepResult{Success: true, AlreadyDone: true}
		}
		// Classify remaining errors as permanent or retryable
		permanent := isPermanentError(errMsg)
		return StepResult{Success: false, PermanentError: permanent, ErrorMessage: errMsg}
	}

	return StepResult{Success: true}
}

// isAlreadyDoneError returns true when the action was effectively already
// performed (e.g. "already connected" or "invitation already pending").
// These should advance the lead to the next step, NOT mark it as failed.
func isAlreadyDoneError(errMsg string) bool {
	alreadyDonePatterns := []string{
		"already connected",
		"invitation already pending",
		"already pending",
	}
	lower := strings.ToLower(errMsg)
	for _, p := range alreadyDonePatterns {
		if strings.Contains(lower, p) {
			return true
		}
	}
	return false
}

// isPermanentError classifies an error message as permanent (no retry) or transient.
func isPermanentError(errMsg string) bool {
	permanentPatterns := []string{
		"profile not found",
		"connect button not found",
		"message box not found",
		"inmail not available",
		"account restricted",
		"profile unavailable",
	}
	lower := strings.ToLower(errMsg)
	for _, pattern := range permanentPatterns {
		if strings.Contains(lower, pattern) {
			return true
		}
	}
	return false
}
