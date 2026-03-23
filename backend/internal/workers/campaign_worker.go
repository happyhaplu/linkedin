package workers

import (
	"fmt"
	"log"
	"math/rand"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/reach/backend/internal/automation"
	"github.com/reach/backend/internal/models"
	"github.com/reach/backend/internal/queue"
	"github.com/reach/backend/internal/repository"
	"github.com/reach/backend/internal/service"
	"gorm.io/gorm"
)

// ──────────────────────────────────────────────────────────────────────────────
// Campaign Worker
//
// Go equivalent of lib/workers/worker-manager.ts → campaignProcessor:
//   1. Check working hours (delay if outside window)
//   2. Apply random human-like delay
//   3. Call ProcessCampaignLeadStep()
//   4. On permanent failure after retries: mark lead failed, check auto-pause
//
// TS reference: concurrency 2, lockDuration 3 min, rate 5/60 s
// ──────────────────────────────────────────────────────────────────────────────

// CampaignStatusAutomation abstracts the Playwright automation methods needed
// by the status-checker and inbox-scanner workers. Implemented by
// automation.CampaignAutomation.
type CampaignStatusAutomation interface {
	CheckConnectionStatus(account *models.LinkedInAccount, lead *models.Lead) (automation.ConnectionStatus, error)
	ScanInboxForReplies(account *models.LinkedInAccount, leadURLs []string) ([]automation.InboxReply, error)
}

// CampaignWorker holds the dependencies needed by the campaign processor.
type CampaignWorker struct {
	executorSvc      *service.CampaignExecutorService
	campaignRepo     *repository.CampaignRepository
	leadRepo         *repository.CampaignLeadRepository
	queueHelper      *queue.CampaignQueueHelper
	qm               *queue.QueueManager
	statusAutomation CampaignStatusAutomation
	accountRepo      *repository.LinkedInAccountRepository
	senderRepo       *repository.CampaignSenderRepository
	leadDataRepo     *repository.LeadRepository
}

// NewCampaignWorker creates a CampaignWorker.
func NewCampaignWorker(
	executorSvc *service.CampaignExecutorService,
	campaignRepo *repository.CampaignRepository,
	leadRepo *repository.CampaignLeadRepository,
	queueHelper *queue.CampaignQueueHelper,
	qm *queue.QueueManager,
	statusAutomation CampaignStatusAutomation,
	accountRepo *repository.LinkedInAccountRepository,
	senderRepo *repository.CampaignSenderRepository,
	leadDataRepo *repository.LeadRepository,
) *CampaignWorker {
	return &CampaignWorker{
		executorSvc:      executorSvc,
		campaignRepo:     campaignRepo,
		leadRepo:         leadRepo,
		queueHelper:      queueHelper,
		qm:               qm,
		statusAutomation: statusAutomation,
		accountRepo:      accountRepo,
		senderRepo:       senderRepo,
		leadDataRepo:     leadDataRepo,
	}
}

// RegisterQueues registers campaign-related queues with their processors.
func (w *CampaignWorker) RegisterQueues() {
	// Campaign processor — main queue
	w.qm.RegisterQueue(queue.QueueConfig{
		Name:        queue.QueueCampaignProcessor,
		Concurrency: 2,
		RateLimit:   5,
		RateWindow:  60 * time.Second,
		Processor:   w.processCampaignJob,
	})

	// Connection sender — reuses same logic, step_type is pre-set
	w.qm.RegisterQueue(queue.QueueConfig{
		Name:        queue.QueueConnectionSender,
		Concurrency: 2,
		RateLimit:   5,
		RateWindow:  60 * time.Second,
		Processor:   w.processCampaignJob,
	})

	// Message sender
	w.qm.RegisterQueue(queue.QueueConfig{
		Name:        queue.QueueMessageSender,
		Concurrency: 2,
		RateLimit:   5,
		RateWindow:  60 * time.Second,
		Processor:   w.processCampaignJob,
	})

	// InMail sender
	w.qm.RegisterQueue(queue.QueueConfig{
		Name:        queue.QueueInMailSender,
		Concurrency: 2,
		RateLimit:   5,
		RateWindow:  60 * time.Second,
		Processor:   w.processCampaignJob,
	})

	// Status checker
	w.qm.RegisterQueue(queue.QueueConfig{
		Name:        queue.QueueStatusChecker,
		Concurrency: 3,
		RateLimit:   5,
		RateWindow:  60 * time.Second,
		Processor:   w.processStatusCheckJob,
	})

	// Inbox scanner
	w.qm.RegisterQueue(queue.QueueConfig{
		Name:        queue.QueueInboxScanner,
		Concurrency: 1,
		RateLimit:   2,
		RateWindow:  60 * time.Second,
		Processor:   w.processInboxScanJob,
	})
}

// ── Campaign Processor ──────────────────────────────────────────────────────

func (w *CampaignWorker) processCampaignJob(job *queue.Job) error {
	var data queue.CampaignLeadJobData
	if err := queue.DecodeJobData(job, &data); err != nil {
		return fmt.Errorf("decode job data: %w", err)
	}

	log.Printf("\n📋 [CampaignWorker] Processing job %s", job.ID)
	log.Printf("   Campaign : %s", data.CampaignID)
	log.Printf("   Lead     : %s", data.LeadID)
	log.Printf("   Step     : %s", data.StepType)

	campaignID, err := uuid.Parse(data.CampaignID)
	if err != nil {
		return fmt.Errorf("invalid campaign_id: %w", err)
	}

	// ── Working-hours pre-check (skip for immediate jobs) ────────────────────
	if !data.Immediate {
		campaign, campErr := w.campaignRepo.FindByIDUnscoped(campaignID)
		if campErr != nil {
			return fmt.Errorf("campaign not found: %w", campErr)
		}

		inHours, delayDur := w.executorSvc.IsWithinWorkingHours(campaign)
		if !inHours && delayDur > 0 {
			log.Printf("⏰ [CampaignWorker] Outside working hours — rescheduling in %v", delayDur.Round(time.Minute))
			// Re-enqueue with delay
			if _, enqErr := w.queueHelper.AddCampaignLeadJob(data, delayDur); enqErr != nil {
				log.Printf("[CampaignWorker] Failed to reschedule: %v", enqErr)
			}
			return nil // do not count as failure
		}
	} else {
		log.Printf("⚡ [CampaignWorker] immediate=true — skipping working-hours check")
	}

	// ── Human-like random delay ─────────────────────────────────────────────
	campaign, _ := w.campaignRepo.FindByIDUnscoped(campaignID)
	minSec := 45
	maxSec := 120
	if campaign != nil {
		if campaign.DelayMinSeconds != nil {
			minSec = *campaign.DelayMinSeconds
		}
		if campaign.DelayMaxSeconds != nil {
			maxSec = *campaign.DelayMaxSeconds
		}
	}
	sleepMs := rand.Intn((maxSec-minSec)*1000) + minSec*1000
	time.Sleep(time.Duration(sleepMs) * time.Millisecond)

	// ── Execute the step ────────────────────────────────────────────────────
	campaignLeadID, _ := uuid.Parse(data.CampaignLeadID)
	stepID, _ := uuid.Parse(data.StepID)
	senderAccountID, _ := uuid.Parse(data.SenderAccountID)

	result := w.executorSvc.ProcessCampaignLeadStep(campaignID, campaignLeadID, stepID, senderAccountID)

	if result.Success {
		log.Printf("✅ [CampaignWorker] Job %s completed", job.ID)
		return nil
	}

	// On permanent error, don't retry
	if result.PermanentError {
		log.Printf("❌ [CampaignWorker] Job %s permanent failure: %s", job.ID, result.ErrorMessage)
		w.handleRetryExhausted(data)
		return nil // return nil so queue doesn't retry
	}

	// Return error so the queue retries with backoff
	return fmt.Errorf("%s", result.ErrorMessage)
}

// handleRetryExhausted runs when all retries are exhausted — marks lead as
// failed and checks whether to auto-pause the campaign.
func (w *CampaignWorker) handleRetryExhausted(data queue.CampaignLeadJobData) {
	campaignLeadID, err := uuid.Parse(data.CampaignLeadID)
	if err != nil {
		return
	}
	campaignID, err := uuid.Parse(data.CampaignID)
	if err != nil {
		return
	}

	log.Printf("🛑 [CampaignWorker] All retries exhausted for lead %s", data.CampaignLeadID)

	// Mark lead as failed
	now := time.Now()
	_ = w.leadRepo.UpdateFields(campaignLeadID, map[string]interface{}{
		"status":       "failed",
		"completed_at": now,
	})
	log.Printf("[CampaignWorker] Lead %s marked as failed", data.CampaignLeadID)

	// Check if all leads for this campaign are done — auto-pause if so
	pendingCount, err := w.leadRepo.CountPendingOrInProgress(campaignID)
	if err == nil && pendingCount == 0 {
		log.Printf("🛑 [CampaignWorker] All leads done — auto-pausing campaign %s", data.CampaignID)
		_ = w.campaignRepo.UpdateFields(campaignID, map[string]interface{}{
			"status":    "paused",
			"paused_at": time.Now(),
		})
	}
}

// ── Status Check Processor ──────────────────────────────────────────────────

func (w *CampaignWorker) processStatusCheckJob(job *queue.Job) error {
	var data queue.StatusCheckJobData
	if err := queue.DecodeJobData(job, &data); err != nil {
		return fmt.Errorf("decode status check data: %w", err)
	}

	log.Printf("🔍 [StatusChecker] Checking %s for lead %s", data.CheckType, data.CampaignLeadID)

	campaignLeadID, _ := uuid.Parse(data.CampaignLeadID)
	campaignID, _ := uuid.Parse(data.CampaignID)
	senderAccountID, _ := uuid.Parse(data.SenderAccountID)

	// Fetch lead details
	campaignLead, err := w.leadRepo.FindByID(campaignLeadID)
	if err != nil {
		return fmt.Errorf("lead not found: %w", err)
	}

	switch data.CheckType {
	case "connection_status":
		return w.processConnectionStatusCheck(data, campaignLead, campaignID, campaignLeadID, senderAccountID)
	case "reply_detection":
		// Reply detection is handled by inbox scanner
		log.Printf("[StatusChecker] Reply detection delegated to inbox scanner for lead %s", data.CampaignLeadID)
		return nil
	default:
		return fmt.Errorf("unknown check_type: %s", data.CheckType)
	}
}

func (w *CampaignWorker) processConnectionStatusCheck(
	data queue.StatusCheckJobData,
	campaignLead interface{},
	campaignID, campaignLeadID, senderAccountID uuid.UUID,
) error {
	if w.statusAutomation == nil {
		log.Printf("[StatusChecker] No automation wired — skipping connection check for lead %s", data.CampaignLeadID)
		return nil
	}

	// Fetch the sender LinkedIn account
	account, err := w.accountRepo.FindByID(senderAccountID)
	if err != nil {
		return fmt.Errorf("sender account %s not found: %w", senderAccountID, err)
	}

	// Fetch the campaign lead record (for ConnectionSentAt timeout check)
	cl, err := w.leadRepo.FindByID(campaignLeadID)
	if err != nil {
		return fmt.Errorf("campaign lead %s not found: %w", campaignLeadID, err)
	}

	// Fetch the underlying lead data (for LinkedIn URL)
	lead, err := w.leadDataRepo.FindByID(cl.LeadID)
	if err != nil {
		return fmt.Errorf("lead data %s not found: %w", cl.LeadID, err)
	}

	log.Printf("🔍 [StatusChecker] Checking connection status for lead %s via Playwright", data.CampaignLeadID)

	status, err := w.statusAutomation.CheckConnectionStatus(account, lead)
	if err != nil {
		log.Printf("⚠️ [StatusChecker] Automation error for lead %s: %v", data.CampaignLeadID, err)
		return err
	}

	switch status {
	case automation.ConnectionStatusAccepted:
		w.handleConnectionAccepted(campaignID, campaignLeadID, senderAccountID)
	case automation.ConnectionStatusPending:
		w.handleConnectionPending(cl, campaignLeadID)
	case automation.ConnectionStatusNotConnected:
		w.handleConnectionNotConnected(campaignLeadID)
	default:
		log.Printf("⚠️ [StatusChecker] Unknown connection status %q for lead %s", status, data.CampaignLeadID)
	}

	return nil
}

// handleConnectionAccepted processes the "accepted" status: updates lead,
// finds the next conditional step, and queues it.
func (w *CampaignWorker) handleConnectionAccepted(campaignID, campaignLeadID, senderAccountID uuid.UUID) {
	now := time.Now()
	_ = w.leadRepo.UpdateFields(campaignLeadID, map[string]interface{}{
		"status":                 "in_progress",
		"connection_accepted_at": now,
	})

	// Remove the repeating status check
	w.queueHelper.RemoveStatusCheckJob(campaignLeadID.String(), "connection_status")

	log.Printf("✅ [StatusChecker] Connection accepted for lead %s", campaignLeadID)

	// Queue next step via executor
	// The executor's QueueNextStep method handles condition evaluation
	w.executorSvc.QueueNextStep(campaignID, campaignLeadID, "", senderAccountID)
}

// handleConnectionPending checks if the connection request has been pending
// for more than 7 days and marks as failed if so.
func (w *CampaignWorker) handleConnectionPending(cl *models.CampaignLead, campaignLeadID uuid.UUID) {
	const connectionTimeout = 7 * 24 * time.Hour

	if cl.ConnectionSentAt != nil {
		elapsed := time.Since(*cl.ConnectionSentAt)
		if elapsed > connectionTimeout {
			log.Printf("⏰ [StatusChecker] Connection pending >7 days for lead %s — marking as failed", campaignLeadID)
			errMsg := "Connection request timed out after 7 days"
			_ = w.leadRepo.UpdateFields(campaignLeadID, map[string]interface{}{
				"status":        "failed",
				"error_message": errMsg,
				"completed_at":  time.Now(),
			})
			w.queueHelper.RemoveStatusCheckJob(campaignLeadID.String(), "connection_status")
			return
		}
	}

	log.Printf("⏳ [StatusChecker] Connection still pending for lead %s — will re-check next cycle", campaignLeadID)
}

// handleConnectionNotConnected marks the lead as failed.
func (w *CampaignWorker) handleConnectionNotConnected(campaignLeadID uuid.UUID) {
	_ = w.leadRepo.UpdateFields(campaignLeadID, map[string]interface{}{
		"status": "failed",
	})
	w.queueHelper.RemoveStatusCheckJob(campaignLeadID.String(), "connection_status")
	log.Printf("❌ [StatusChecker] Lead %s not connected — marked as failed", campaignLeadID)
}

// ── Inbox Scanner Processor ─────────────────────────────────────────────────

func (w *CampaignWorker) processInboxScanJob(job *queue.Job) error {
	var data queue.StatusCheckJobData
	if err := queue.DecodeJobData(job, &data); err != nil {
		return fmt.Errorf("decode inbox scan data: %w", err)
	}

	log.Printf("📬 [InboxScanner] Scanning inbox for campaign %s", data.CampaignID)

	if w.statusAutomation == nil {
		log.Printf("[InboxScanner] No automation wired — skipping inbox scan")
		return nil
	}

	campaignID, _ := uuid.Parse(data.CampaignID)

	// Fetch campaign
	campaign, err := w.campaignRepo.FindByIDUnscoped(campaignID)
	if err != nil {
		return fmt.Errorf("campaign not found: %w", err)
	}

	// Get sender accounts for this campaign (with LinkedInAccount preloaded)
	senders, err := w.senderRepo.FindByCampaignIDWithAccount(campaignID)
	if err != nil {
		return fmt.Errorf("failed to fetch senders: %w", err)
	}
	if len(senders) == 0 {
		log.Printf("[InboxScanner] No senders assigned to campaign %s", data.CampaignID)
		return nil
	}

	// Get in-progress leads that haven't replied yet
	inProgressStatus := "in_progress"
	campaignLeads, err := w.leadRepo.FindByCampaignID(campaignID, &inProgressStatus, nil)
	if err != nil {
		return fmt.Errorf("failed to fetch campaign leads: %w", err)
	}

	// Build a list of unreplied leads and their LinkedIn URLs
	type unrepliedEntry struct {
		CampaignLead models.CampaignLead
		LinkedInURL  string // normalised
	}
	var unreplied []unrepliedEntry
	var leadURLs []string

	for _, cl := range campaignLeads {
		if cl.RepliedAt != nil {
			continue // already replied
		}
		lead, leadErr := w.leadDataRepo.FindByID(cl.LeadID)
		if leadErr != nil || lead == nil || lead.LinkedInURL == nil {
			continue
		}
		normURL := automation.NormalizeLinkedInURL(*lead.LinkedInURL)
		if normURL == "" {
			continue
		}
		unreplied = append(unreplied, unrepliedEntry{CampaignLead: cl, LinkedInURL: normURL})
		leadURLs = append(leadURLs, normURL)
	}

	if len(unreplied) == 0 {
		log.Printf("[InboxScanner] No unreplied leads to check for campaign %s", data.CampaignID)
		return nil
	}

	log.Printf("📬 [InboxScanner] Checking %d unreplied leads across %d sender(s)", len(unreplied), len(senders))

	stopOnReply := campaign.StopOnReply != nil && *campaign.StopOnReply
	repliesFound := 0

	// Scan inbox via each sender account
	for _, sender := range senders {
		if sender.LinkedInAccount == nil {
			continue
		}

		replies, scanErr := w.statusAutomation.ScanInboxForReplies(sender.LinkedInAccount, leadURLs)
		if scanErr != nil {
			log.Printf("⚠️ [InboxScanner] Error scanning inbox for account %s: %v", sender.LinkedInAccountID, scanErr)
			continue
		}

		for _, reply := range replies {
			if !reply.HasNewMessage {
				continue
			}

			// Match the reply to one of our unreplied campaign leads
			normReplyURL := automation.NormalizeLinkedInURL(reply.ProfileURL)
			for _, entry := range unreplied {
				if !urlsMatch(normReplyURL, entry.LinkedInURL) {
					continue
				}

				// Found a reply — update the campaign lead
				now := time.Now()
				updates := map[string]interface{}{
					"replied_at":              now,
					"last_activity_at":        now,
					"total_replies_received":  gorm.Expr("total_replies_received + 1"),
				}
				// Set first_reply_at only if this is the first reply
				if entry.CampaignLead.FirstReplyAt == nil {
					updates["first_reply_at"] = now
				}
				if stopOnReply {
					updates["status"] = "completed"
					updates["completed_at"] = now
				}
				_ = w.leadRepo.UpdateFields(entry.CampaignLead.ID, updates)

				// Bump sender stats
				_ = w.senderRepo.IncrementStat(campaignID, sender.LinkedInAccountID, "replies_received")

				repliesFound++
				log.Printf("📬 [InboxScanner] Reply detected for lead %s from %s",
					entry.CampaignLead.ID, reply.ProfileURL)
				break // one match per reply
			}
		}
	}

	log.Printf("📬 [InboxScanner] ✅ Scan complete — %d replies found for campaign %s", repliesFound, data.CampaignID)
	return nil
}

// urlsMatch compares two normalised LinkedIn profile URLs, tolerating trailing
// slashes and /in/ slug differences.
func urlsMatch(a, b string) bool {
	a = strings.TrimRight(strings.ToLower(a), "/")
	b = strings.TrimRight(strings.ToLower(b), "/")
	if a == b {
		return true
	}
	// Fallback: one URL is contained in the other (handles partial slugs)
	return strings.Contains(a, b) || strings.Contains(b, a)
}

// BuildCampaignWorker creates and returns a fully-configured CampaignWorker.
// This is the main entry point used by the worker manager.
func BuildCampaignWorker(db *gorm.DB, qm *queue.QueueManager, browserMgr *automation.BrowserManager) *CampaignWorker {
	campaignRepo := repository.NewCampaignRepository(db)
	senderRepo := repository.NewCampaignSenderRepository(db)
	sequenceRepo := repository.NewCampaignSequenceRepository(db)
	leadRepo := repository.NewCampaignLeadRepository(db)
	counterRepo := repository.NewDailyCounterRepository(db)
	activityRepo := repository.NewCampaignActivityRepository(db)
	accountRepo := repository.NewLinkedInAccountRepository(db)
	leadDataRepo := repository.NewLeadRepository(db)
	webhookRepo := repository.NewCampaignWebhookRepository(db)
	whLogRepo := repository.NewCampaignWebhookLogRepository(db)

	webhookSvc := service.NewWebhookService(webhookRepo, whLogRepo)

	// Wire real automation if BrowserManager is available
	var linkedinAutomation service.LinkedInAutomation
	var statusAutomation CampaignStatusAutomation
	if browserMgr != nil {
		campaignAuto := automation.NewCampaignAutomation(browserMgr)
		linkedinAutomation = campaignAuto
		statusAutomation = campaignAuto
	}

	executorSvc := service.NewCampaignExecutorService(
		campaignRepo, senderRepo, sequenceRepo, leadRepo,
		counterRepo, activityRepo, accountRepo,
		leadDataRepo, linkedinAutomation,
		webhookSvc,
	)

	queueHelper := queue.NewCampaignQueueHelper(qm)

	return NewCampaignWorker(
		executorSvc, campaignRepo, leadRepo, queueHelper, qm,
		statusAutomation, accountRepo, senderRepo, leadDataRepo,
	)
}
