package queue

import (
	"fmt"
	"time"
)

// ──────────────────────────────────────────────────────────────────────────────
// Campaign Queue Helpers
//
// High-level functions mirroring the TS addCampaignLeadJob, addStatusCheckJob,
// etc. from lib/queue/campaign-queue.ts.
// They delegate to the underlying QueueManager.Enqueue().
// ──────────────────────────────────────────────────────────────────────────────

// CampaignQueueHelper wraps QueueManager with convenience methods for
// campaign-related job submission.
type CampaignQueueHelper struct {
	qm *QueueManager
}

// NewCampaignQueueHelper creates a helper bound to the given QueueManager.
func NewCampaignQueueHelper(qm *QueueManager) *CampaignQueueHelper {
	return &CampaignQueueHelper{qm: qm}
}

// AddCampaignLeadJob enqueues a lead step-processing job.
// An optional delay defers execution (e.g. for working-hours rescheduling).
// The jobID includes a timestamp so the same lead+step can be re-queued.
func (h *CampaignQueueHelper) AddCampaignLeadJob(data CampaignLeadJobData, delay time.Duration) (*Job, error) {
	jobID := fmt.Sprintf("campaign-%s-lead-%s-step-%s-%d",
		data.CampaignID, data.CampaignLeadID, data.StepID, time.Now().UnixMilli())
	return h.qm.EnqueueWithID(QueueCampaignProcessor, jobID, "process-campaign-lead", data, delay)
}

// AddConnectionRequestJob enqueues a connection-request job.
func (h *CampaignQueueHelper) AddConnectionRequestJob(data CampaignLeadJobData) (*Job, error) {
	data.StepType = "connection_request"
	jobID := fmt.Sprintf("connection-%s-lead-%s", data.CampaignID, data.CampaignLeadID)
	return h.qm.EnqueueWithID(QueueConnectionSender, jobID, "send-connection-request", data, 0)
}

// AddMessageJob enqueues a message-sending job.
func (h *CampaignQueueHelper) AddMessageJob(data CampaignLeadJobData) (*Job, error) {
	data.StepType = "message"
	jobID := fmt.Sprintf("message-%s-lead-%s-%d", data.CampaignID, data.CampaignLeadID, time.Now().UnixMilli())
	return h.qm.EnqueueWithID(QueueMessageSender, jobID, "send-message", data, 0)
}

// AddInMailJob enqueues an InMail-sending job.
func (h *CampaignQueueHelper) AddInMailJob(data CampaignLeadJobData) (*Job, error) {
	data.StepType = "inmail"
	jobID := fmt.Sprintf("inmail-%s-lead-%s-%d", data.CampaignID, data.CampaignLeadID, time.Now().UnixMilli())
	return h.qm.EnqueueWithID(QueueInMailSender, jobID, "send-inmail", data, 0)
}

// AddStatusCheckJob enqueues a connection status / reply detection check.
// In TS this was a repeating job (every hour). Here we schedule a repeating
// job via the QueueManager's repeating mechanism.
func (h *CampaignQueueHelper) AddStatusCheckJob(data StatusCheckJobData) {
	key := fmt.Sprintf("status-check-%s-%s", data.CampaignLeadID, data.CheckType)
	h.qm.AddRepeatingJob(key, QueueStatusChecker, "check-status", data, 1*time.Hour)
}

// RemoveStatusCheckJob removes a repeating status check job.
func (h *CampaignQueueHelper) RemoveStatusCheckJob(campaignLeadID, checkType string) {
	key := fmt.Sprintf("status-check-%s-%s", campaignLeadID, checkType)
	h.qm.RemoveRepeatingJob(key)
}

// AddInboxScanJob enqueues a single inbox scan job.
func (h *CampaignQueueHelper) AddInboxScanJob(data StatusCheckJobData) (*Job, error) {
	jobID := fmt.Sprintf("inbox-scan-%s-%d", data.CampaignLeadID, time.Now().UnixMilli())
	return h.qm.EnqueueWithID(QueueInboxScanner, jobID, "scan-inbox", data, 0)
}

// ── Queue Management ────────────────────────────────────────────────────────

// GetQueueStats returns stats for a campaign queue by its constant name.
func (h *CampaignQueueHelper) GetQueueStats(queueName string) QueueStats {
	return h.qm.GetStats(queueName)
}

// GetAllQueueStats returns stats for every campaign queue.
func (h *CampaignQueueHelper) GetAllQueueStats() map[string]QueueStats {
	return h.qm.GetAllStats()
}

// PauseAllQueues pauses every registered queue.
func (h *CampaignQueueHelper) PauseAllQueues() {
	h.qm.PauseAll()
}

// ResumeAllQueues resumes every registered queue.
func (h *CampaignQueueHelper) ResumeAllQueues() {
	h.qm.ResumeAll()
}
