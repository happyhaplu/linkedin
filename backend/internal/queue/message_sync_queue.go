package queue

import (
	"log"
	"time"
)

// ──────────────────────────────────────────────────────────────────────────────
// Message Sync Queue Helpers
//
// Mirrors lib/queue/message-sync-queue.ts:
//   • scheduleMessageSync(intervalMinutes) — repeating "sync-all" job
//   • queueReply(data) — one-shot "send-reply" job
// ──────────────────────────────────────────────────────────────────────────────

const messageSyncRepeaterKey = "message-sync-repeater"

// MessageSyncQueueHelper provides convenience methods for message-sync jobs.
type MessageSyncQueueHelper struct {
	qm *QueueManager
}

// NewMessageSyncQueueHelper creates a helper bound to the given QueueManager.
func NewMessageSyncQueueHelper(qm *QueueManager) *MessageSyncQueueHelper {
	return &MessageSyncQueueHelper{qm: qm}
}

// ScheduleMessageSync sets up a repeating "sync-all" job at the given interval.
// Calling again replaces the previous schedule (idempotent).
func (h *MessageSyncQueueHelper) ScheduleMessageSync(intervalMinutes int) {
	if intervalMinutes <= 0 {
		intervalMinutes = 3
	}

	interval := time.Duration(intervalMinutes) * time.Minute

	data := MessageSyncJobData{
		Type: "sync-all",
	}

	h.qm.AddRepeatingJob(messageSyncRepeaterKey, QueueMessageSync, "sync-all-accounts", data, interval)
	log.Printf("[MessageSync] Scheduled repeating sync every %d minutes", intervalMinutes)
}

// StopMessageSync removes the repeating sync job.
func (h *MessageSyncQueueHelper) StopMessageSync() {
	h.qm.RemoveRepeatingJob(messageSyncRepeaterKey)
}

// QueueSyncAccount enqueues a one-shot sync for a specific LinkedIn account.
func (h *MessageSyncQueueHelper) QueueSyncAccount(linkedinAccountID, userID string) (*Job, error) {
	data := MessageSyncJobData{
		Type:              "sync-account",
		LinkedInAccountID: linkedinAccountID,
		UserID:            userID,
	}
	return h.qm.Enqueue(QueueMessageSync, "sync-account", data, 0)
}

// QueueReply enqueues a single reply to be sent via the Playwright worker.
func (h *MessageSyncQueueHelper) QueueReply(linkedinAccountID, threadID, messageText, conversationID string) (*Job, error) {
	data := MessageSyncJobData{
		Type:              "send-reply",
		LinkedInAccountID: linkedinAccountID,
		ThreadID:          threadID,
		MessageText:       messageText,
		ConversationID:    conversationID,
	}
	return h.qm.Enqueue(QueueMessageSync, "send-reply", data, 0)
}
