package workers

import (
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/reach/backend/internal/automation"
	"github.com/reach/backend/internal/models"
	"github.com/reach/backend/internal/queue"
	"github.com/reach/backend/internal/repository"
	"gorm.io/gorm"
)

// ──────────────────────────────────────────────────────────────────────────────
// Message Sync Worker
//
// Go equivalent of lib/workers/message-sync-worker.ts.
// Processes three job types on the "message-sync" queue:
//   1. sync-all     — scrape conversations from all active LinkedIn accounts
//   2. sync-account — scrape conversations for a single account
//   3. send-reply   — send a real reply via Playwright
//
// TS reference: concurrency 1, lockDuration 5 min, stalledInterval 60 s
// ──────────────────────────────────────────────────────────────────────────────

// MessageSyncAutomation defines the interface for LinkedIn message operations.
// Provide a real implementation wired to Playwright; nil means no-op.
type MessageSyncAutomation interface {
	SyncAllAccounts(userID string) error
	SyncAccountMessages(linkedinAccountID string) (map[string]interface{}, error)
	SendLinkedInReply(account *models.LinkedInAccount, threadID, messageText string) error
}

// MessageSyncWorker processes message-sync queue jobs.
type MessageSyncWorker struct {
	accountRepo *repository.LinkedInAccountRepository
	convRepo    *repository.ConversationRepository
	msgRepo     *repository.MessageRepository
	automation  MessageSyncAutomation
	qm          *queue.QueueManager
	db          *gorm.DB
}

// NewMessageSyncWorker creates a MessageSyncWorker.
func NewMessageSyncWorker(
	accountRepo *repository.LinkedInAccountRepository,
	convRepo *repository.ConversationRepository,
	msgRepo *repository.MessageRepository,
	automation MessageSyncAutomation,
	qm *queue.QueueManager,
	db *gorm.DB,
) *MessageSyncWorker {
	return &MessageSyncWorker{
		accountRepo: accountRepo,
		convRepo:    convRepo,
		msgRepo:     msgRepo,
		automation:  automation,
		qm:          qm,
		db:          db,
	}
}

// RegisterQueue registers the message-sync queue with its processor.
func (w *MessageSyncWorker) RegisterQueue() {
	w.qm.RegisterQueue(queue.QueueConfig{
		Name:        queue.QueueMessageSync,
		Concurrency: 1,           // One sync at a time (sequential, safe)
		RateLimit:   0,           // No rate limit
		Processor:   w.process,
	})
}

// ── Processor ───────────────────────────────────────────────────────────────

func (w *MessageSyncWorker) process(job *queue.Job) error {
	var data queue.MessageSyncJobData
	if err := queue.DecodeJobData(job, &data); err != nil {
		return fmt.Errorf("decode message sync data: %w", err)
	}

	log.Printf("\n📬 [MsgSyncWorker] Processing: %s", data.Type)

	switch data.Type {
	case "sync-all":
		return w.processSyncAll(data)
	case "sync-account":
		return w.processSyncAccount(data)
	case "send-reply":
		return w.processSendReply(data)
	default:
		return fmt.Errorf("unknown job type: %s", data.Type)
	}
}

// ── sync-all ────────────────────────────────────────────────────────────────

func (w *MessageSyncWorker) processSyncAll(data queue.MessageSyncJobData) error {
	if w.automation == nil {
		log.Println("[MsgSyncWorker] sync-all: no automation wired (no-op)")
		return nil
	}
	userID := data.UserID
	if userID == "" {
		log.Println("[MsgSyncWorker] sync-all: no userId provided, skipping")
		return nil
	}
	if err := w.automation.SyncAllAccounts(userID); err != nil {
		return fmt.Errorf("sync-all failed: %w", err)
	}
	log.Println("[MsgSyncWorker] sync-all completed")
	return nil
}

// ── sync-account ────────────────────────────────────────────────────────────

func (w *MessageSyncWorker) processSyncAccount(data queue.MessageSyncJobData) error {
	if data.LinkedInAccountID == "" {
		return fmt.Errorf("missing linkedinAccountId for sync-account")
	}
	if w.automation == nil {
		log.Printf("[MsgSyncWorker] sync-account %s: no automation wired (no-op)", data.LinkedInAccountID)
		return nil
	}
	result, err := w.automation.SyncAccountMessages(data.LinkedInAccountID)
	if err != nil {
		return fmt.Errorf("sync-account failed: %w", err)
	}
	log.Printf("[MsgSyncWorker] sync-account %s completed: %v", data.LinkedInAccountID, result)
	return nil
}

// ── send-reply ──────────────────────────────────────────────────────────────

func (w *MessageSyncWorker) processSendReply(data queue.MessageSyncJobData) error {
	if data.LinkedInAccountID == "" || data.ThreadID == "" || data.MessageText == "" {
		return fmt.Errorf("missing required fields for send-reply")
	}

	// Fetch account
	accountID, err := uuid.Parse(data.LinkedInAccountID)
	if err != nil {
		return fmt.Errorf("invalid linkedin account id: %w", err)
	}
	account, err := w.accountRepo.FindByID(accountID)
	if err != nil {
		return fmt.Errorf("account %s not found: %w", data.LinkedInAccountID, err)
	}

	// Send via automation
	if w.automation == nil {
		log.Printf("[MsgSyncWorker] send-reply: no automation wired (no-op)")
	} else {
		if sendErr := w.automation.SendLinkedInReply(account, data.ThreadID, data.MessageText); sendErr != nil {
			return fmt.Errorf("failed to send reply: %w", sendErr)
		}
	}

	// Save the sent message to DB
	if data.ConversationID != "" {
		convID, parseErr := uuid.Parse(data.ConversationID)
		if parseErr == nil {
			msg := &models.Message{
				ConversationID:    convID,
				LinkedInAccountID: accountID,
				MessageID:         fmt.Sprintf("sent_%d_%s", time.Now().UnixMilli(), randomString(5)),
				SenderName:        account.Email,
				IsFromMe:          true,
				Content:           data.MessageText,
				SentAt:            time.Now(),
				IsRead:            true,
			}
			if err := w.db.Create(msg).Error; err != nil {
				log.Printf("[MsgSyncWorker] Failed to save sent message: %v", err)
			}
		}
	}

	log.Printf("[MsgSyncWorker] send-reply completed for thread %s", data.ThreadID)
	return nil
}

// randomString generates a random alphanumeric string of length n.
func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

// BuildMessageSyncWorker creates a fully-configured MessageSyncWorker.
func BuildMessageSyncWorker(db *gorm.DB, qm *queue.QueueManager, browserMgr *automation.BrowserManager) *MessageSyncWorker {
	accountRepo := repository.NewLinkedInAccountRepository(db)
	convRepo := repository.NewConversationRepository(db)
	msgRepo := repository.NewMessageRepository(db)

	// Wire real automation if BrowserManager is available
	var msgAutomation MessageSyncAutomation
	if browserMgr != nil {
		msgAutomation = automation.NewMessageScraperService(browserMgr, accountRepo, convRepo, msgRepo, db)
	}

	return NewMessageSyncWorker(
		accountRepo,
		convRepo,
		msgRepo,
		msgAutomation,
		qm,
		db,
	)
}
