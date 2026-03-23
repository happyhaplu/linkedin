package workers

import (
	"log"
	"sync"

	"github.com/reach/backend/internal/automation"
	"github.com/reach/backend/internal/queue"
	"gorm.io/gorm"
)

// ──────────────────────────────────────────────────────────────────────────────
// Worker Manager
//
// Go equivalent of lib/workers/worker-manager.ts → startWorkers():
//   - Singleton guard (prevents double-start on hot-reload)
//   - Creates QueueManager + registers all workers
//   - Starts processing
//   - Schedules repeating jobs (message sync every 3 min)
//   - Provides graceful Stop()
//
// Usage:
//
//	mgr := workers.NewWorkerManager(db)
//	mgr.Start()
//	defer mgr.Stop()
// ──────────────────────────────────────────────────────────────────────────────

// WorkerManager orchestrates all background workers.
type WorkerManager struct {
	mu         sync.Mutex
	started    bool
	db         *gorm.DB
	qm         *queue.QueueManager
	browserMgr *automation.BrowserManager

	// Exposed helpers so router / handler can enqueue jobs
	CampaignQueue  *queue.CampaignQueueHelper
	MessageSync    *queue.MessageSyncQueueHelper
}

// NewWorkerManager creates a WorkerManager (does NOT start it yet).
func NewWorkerManager(db *gorm.DB, browserMgr *automation.BrowserManager) *WorkerManager {
	return &WorkerManager{
		db:         db,
		qm:         queue.NewQueueManager(db),
		browserMgr: browserMgr,
	}
}

// QueueManager returns the underlying QueueManager (for stats, etc.).
func (wm *WorkerManager) QueueManager() *queue.QueueManager {
	return wm.qm
}

// Start initialises and starts all workers. Safe to call multiple times;
// subsequent calls are no-ops (singleton guard).
func (wm *WorkerManager) Start() {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	if wm.started {
		log.Println("[Workers] Already running — skipping re-init")
		return
	}
	wm.started = true

	log.Println("\n🚀 [Workers] Initialising background workers…")

	// ── Campaign worker ─────────────────────────────────────────────────────
	campaignWorker := BuildCampaignWorker(wm.db, wm.qm, wm.browserMgr)
	campaignWorker.RegisterQueues()
	log.Println("✅ [Workers] Campaign worker registered (concurrency: 2, rate: 5/60s)")

	// ── Message sync worker ─────────────────────────────────────────────────
	msgSyncWorker := BuildMessageSyncWorker(wm.db, wm.qm, wm.browserMgr)
	msgSyncWorker.RegisterQueue()
	log.Println("✅ [Workers] Message-sync worker registered (concurrency: 1)")

	// ── Start all queues ────────────────────────────────────────────────────
	wm.qm.Start()

	// ── Create queue helpers ────────────────────────────────────────────────
	wm.CampaignQueue = queue.NewCampaignQueueHelper(wm.qm)
	wm.MessageSync = queue.NewMessageSyncQueueHelper(wm.qm)

	// ── Schedule repeating jobs ─────────────────────────────────────────────
	wm.MessageSync.ScheduleMessageSync(3) // every 3 minutes
	log.Println("✅ [Workers] Message-sync repeating job scheduled (every 3 min)")

	log.Println("🚀 [Workers] All workers running")
}

// Stop gracefully shuts down all workers.
func (wm *WorkerManager) Stop() {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	if !wm.started {
		return
	}

	log.Println("[Workers] Shutting down…")
	wm.qm.Stop()
	wm.started = false
	log.Println("[Workers] All workers stopped")
}
