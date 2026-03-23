package queue

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ──────────────────────────────────────────────────────────────────────────────
// QueueManager — Postgres-backed job queue.
//
// Jobs are stored in the "queue_jobs" table, surviving process restarts.
// Workers poll the database using FOR UPDATE SKIP LOCKED for safe concurrent
// processing. Replaces the prior in-memory channel approach.
//
// Design decisions:
//   - Each named queue has a configurable worker pool that polls the DB.
//   - Delayed jobs use a future run_at; the poll query naturally skips them.
//   - Repeating jobs use ticker goroutines that INSERT new rows on schedule.
//   - Stale-lock recovery runs every 5 min (handles crash recovery).
//   - Old completed/failed jobs are cleaned up hourly.
//   - Graceful shutdown releases in-flight jobs back to 'waiting'.
// ──────────────────────────────────────────────────────────────────────────────

// ProcessorFunc is called by a worker to process a job.
// Return nil on success; non-nil to mark the job as failed (and potentially retry).
type ProcessorFunc func(job *Job) error

// QueueConfig configures a single named queue.
type QueueConfig struct {
	Name        string
	Concurrency int           // Number of parallel workers.
	RateLimit   int           // Max jobs per RateWindow (0 = unlimited).
	RateWindow  time.Duration // Window for rate limiting.
	Processor   ProcessorFunc
}

// QueueManager orchestrates multiple named queues, backed by Postgres.
type QueueManager struct {
	mu      sync.RWMutex
	db      *gorm.DB
	queues  map[string]*internalQueue
	done    chan struct{}
	stopped bool

	// Repeating job registry
	repeaters   map[string]*repeatingJob
	repeatersMu sync.Mutex
}

type internalQueue struct {
	name      string
	processor ProcessorFunc
	config    QueueConfig
	paused    bool
	pausedMu  sync.RWMutex
}

type repeatingJob struct {
	ticker *time.Ticker
	stopCh chan struct{}
	queue  string
	name   string
	data   interface{}
}

// NewQueueManager creates a new QueueManager backed by Postgres.
// It auto-migrates the queue_jobs table and recovers any stale jobs from a
// previous crash.
func NewQueueManager(db *gorm.DB) *QueueManager {
	// Auto-migrate the queue_jobs table
	if err := db.AutoMigrate(&QueueJob{}); err != nil {
		log.Printf("[QueueManager] ⚠️  Failed to migrate queue_jobs table: %v", err)
	} else {
		log.Println("[QueueManager] ✅ queue_jobs table ready")
	}

	// Recover any stale jobs from a previous crash (locked > 10 min ago)
	if recovered := recoverStaleJobs(db, 10*time.Minute); recovered > 0 {
		log.Printf("[QueueManager] ♻️  Recovered %d stale jobs from previous run", recovered)
	}

	return &QueueManager{
		db:        db,
		queues:    make(map[string]*internalQueue),
		done:      make(chan struct{}),
		repeaters: make(map[string]*repeatingJob),
	}
}

// RegisterQueue registers a named queue with its configuration and processor.
func (qm *QueueManager) RegisterQueue(cfg QueueConfig) {
	qm.mu.Lock()
	defer qm.mu.Unlock()

	if cfg.Concurrency < 1 {
		cfg.Concurrency = 1
	}

	qm.queues[cfg.Name] = &internalQueue{
		name:      cfg.Name,
		processor: cfg.Processor,
		config:    cfg,
	}
}

// Start launches worker goroutines for every registered queue and starts
// background maintenance (stale-lock recovery + old-job cleanup).
func (qm *QueueManager) Start() {
	qm.mu.RLock()
	defer qm.mu.RUnlock()

	for _, iq := range qm.queues {
		for i := 0; i < iq.config.Concurrency; i++ {
			go qm.worker(iq, i)
		}
	}

	// Background maintenance goroutine
	go qm.maintenance()

	log.Println("[QueueManager] All queues started (Postgres-backed)")
}

// ── Enqueue ─────────────────────────────────────────────────────────────────

// Enqueue adds a job to the named queue. If delay > 0, the job's run_at is
// set in the future; workers will naturally skip it until it becomes eligible.
func (qm *QueueManager) Enqueue(queueName, jobName string, data interface{}, delay time.Duration) (*Job, error) {
	return qm.enqueueInternal(queueName, generateJobID(queueName, jobName), jobName, data, delay)
}

// EnqueueWithID is like Enqueue but lets the caller specify the job ID
// (useful for deduplication — duplicate IDs are silently skipped).
func (qm *QueueManager) EnqueueWithID(queueName, jobID, jobName string, data interface{}, delay time.Duration) (*Job, error) {
	return qm.enqueueInternal(queueName, jobID, jobName, data, delay)
}

func (qm *QueueManager) enqueueInternal(queueName, jobID, jobName string, data interface{}, delay time.Duration) (*Job, error) {
	qm.mu.RLock()
	_, ok := qm.queues[queueName]
	qm.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("queue %q not registered", queueName)
	}

	dataBytes, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal job data: %w", err)
	}

	now := time.Now()
	status := string(JobStatusWaiting)
	if delay > 0 {
		status = string(JobStatusDelayed)
	}

	qj := &QueueJob{
		ID:          jobID,
		Queue:       queueName,
		Name:        jobName,
		Data:        dataBytes,
		Status:      status,
		Attempts:    0,
		MaxAttempts: DefaultMaxAttempts,
		RunAt:       now.Add(delay),
		CreatedAt:   now,
	}

	// ON CONFLICT DO NOTHING provides safe dedup for jobs with caller-specified IDs.
	result := qm.db.Clauses(clause.OnConflict{DoNothing: true}).Create(qj)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to enqueue job: %w", result.Error)
	}

	return qj.ToJob(), nil
}

// ── Repeating Jobs ──────────────────────────────────────────────────────────

// AddRepeatingJob schedules a job to be enqueued every `interval`.
// The key uniquely identifies the repeating job so it can be removed later.
func (qm *QueueManager) AddRepeatingJob(key, queueName, jobName string, data interface{}, interval time.Duration) {
	qm.RemoveRepeatingJob(key) // remove any existing one first

	rj := &repeatingJob{
		ticker: time.NewTicker(interval),
		stopCh: make(chan struct{}),
		queue:  queueName,
		name:   jobName,
		data:   data,
	}

	qm.repeatersMu.Lock()
	qm.repeaters[key] = rj
	qm.repeatersMu.Unlock()

	go func() {
		for {
			select {
			case <-rj.ticker.C:
				if _, err := qm.Enqueue(queueName, jobName, data, 0); err != nil {
					log.Printf("[QueueManager] Failed to enqueue repeating job %q: %v", key, err)
				}
			case <-rj.stopCh:
				rj.ticker.Stop()
				return
			case <-qm.done:
				rj.ticker.Stop()
				return
			}
		}
	}()

	log.Printf("[QueueManager] Repeating job %q scheduled every %v", key, interval)
}

// RemoveRepeatingJob stops and removes a repeating job by key.
func (qm *QueueManager) RemoveRepeatingJob(key string) {
	qm.repeatersMu.Lock()
	defer qm.repeatersMu.Unlock()

	if rj, ok := qm.repeaters[key]; ok {
		close(rj.stopCh)
		delete(qm.repeaters, key)
	}
}

// ── Queue Control ───────────────────────────────────────────────────────────

// Pause pauses a single queue. Workers will spin-wait until resumed.
func (qm *QueueManager) Pause(queueName string) {
	qm.mu.RLock()
	iq, ok := qm.queues[queueName]
	qm.mu.RUnlock()
	if ok {
		iq.pausedMu.Lock()
		iq.paused = true
		iq.pausedMu.Unlock()
		log.Printf("[QueueManager] Queue %q paused", queueName)
	}
}

// Resume resumes a paused queue.
func (qm *QueueManager) Resume(queueName string) {
	qm.mu.RLock()
	iq, ok := qm.queues[queueName]
	qm.mu.RUnlock()
	if ok {
		iq.pausedMu.Lock()
		iq.paused = false
		iq.pausedMu.Unlock()
		log.Printf("[QueueManager] Queue %q resumed", queueName)
	}
}

// PauseAll pauses every registered queue.
func (qm *QueueManager) PauseAll() {
	qm.mu.RLock()
	defer qm.mu.RUnlock()
	for name := range qm.queues {
		qm.Pause(name)
	}
}

// ResumeAll resumes every registered queue.
func (qm *QueueManager) ResumeAll() {
	qm.mu.RLock()
	defer qm.mu.RUnlock()
	for name := range qm.queues {
		qm.Resume(name)
	}
}

// ── Stats ───────────────────────────────────────────────────────────────────

// GetStats returns counts for a single queue (live from Postgres).
func (qm *QueueManager) GetStats(queueName string) QueueStats {
	return countByStatus(qm.db, queueName)
}

// GetAllStats returns stats for every registered queue.
func (qm *QueueManager) GetAllStats() map[string]QueueStats {
	qm.mu.RLock()
	defer qm.mu.RUnlock()

	result := make(map[string]QueueStats, len(qm.queues))
	for name := range qm.queues {
		result[name] = qm.GetStats(name)
	}
	return result
}

// ── Stop ────────────────────────────────────────────────────────────────────

// Stop gracefully shuts down all queues and workers.
func (qm *QueueManager) Stop() {
	qm.mu.Lock()
	if qm.stopped {
		qm.mu.Unlock()
		return
	}
	qm.stopped = true
	qm.mu.Unlock()

	log.Println("[QueueManager] Shutting down…")

	// Stop all repeating jobs
	qm.repeatersMu.Lock()
	for key, rj := range qm.repeaters {
		close(rj.stopCh)
		delete(qm.repeaters, key)
	}
	qm.repeatersMu.Unlock()

	// Signal all workers to stop
	close(qm.done)

	// Give workers a moment to finish in-flight jobs
	time.Sleep(2 * time.Second)

	// Release any still-active jobs back to 'waiting' for next startup
	if released := recoverStaleJobs(qm.db, 0); released > 0 {
		log.Printf("[QueueManager] Released %d in-flight jobs for next startup", released)
	}

	log.Println("[QueueManager] All queues stopped")
}

// ── Internal: Worker ────────────────────────────────────────────────────────

func (qm *QueueManager) worker(iq *internalQueue, workerID int) {
	lockID := fmt.Sprintf("%s-w%d-%d", iq.name, workerID, time.Now().UnixNano())
	pollInterval := 1 * time.Second

	// Per-worker rate limiter (same logic as the prior in-memory version)
	var limiter <-chan time.Time
	if iq.config.RateLimit > 0 && iq.config.RateWindow > 0 {
		interval := iq.config.RateWindow / time.Duration(iq.config.RateLimit)
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		limiter = ticker.C
	}

	for {
		// Check if we should stop
		select {
		case <-qm.done:
			return
		default:
		}

		// Rate limiting
		if limiter != nil {
			select {
			case <-limiter:
			case <-qm.done:
				return
			}
		}

		// Paused check
		iq.pausedMu.RLock()
		p := iq.paused
		iq.pausedMu.RUnlock()
		if p {
			time.Sleep(500 * time.Millisecond)
			continue
		}

		// Poll for a job from Postgres
		dbJob, err := fetchAndLock(qm.db, iq.name, lockID)
		if err != nil {
			log.Printf("[%s] Worker %d: poll error: %v", iq.name, workerID, err)
			time.Sleep(pollInterval)
			continue
		}
		if dbJob == nil {
			// No work available — back off
			time.Sleep(pollInterval)
			continue
		}

		// Convert to Job for the processor
		job := dbJob.ToJob()

		// Execute
		err = iq.processor(job)

		if err != nil {
			job.Attempts++
			job.Error = err.Error()

			if job.Attempts < job.MaxAttempts {
				// Retry with exponential backoff
				backoff := DefaultBackoffBase * time.Duration(1<<uint(job.Attempts-1))
				log.Printf("[%s] Worker %d: job %s failed (attempt %d/%d), retrying in %v: %v",
					iq.name, workerID, job.ID, job.Attempts, job.MaxAttempts, backoff, err)
				markDelayed(qm.db, dbJob.ID, job.Attempts, job.Error, time.Now().Add(backoff))
			} else {
				log.Printf("[%s] Worker %d: job %s permanently failed after %d attempts: %v",
					iq.name, workerID, job.ID, job.Attempts, err)
				markFailed(qm.db, dbJob.ID, job.Attempts, job.Error)
			}
		} else {
			markCompleted(qm.db, dbJob.ID)
		}
	}
}

// ── Internal: Maintenance ───────────────────────────────────────────────────

// maintenance runs background tasks: stale-lock recovery (every 5 min) and
// old-job cleanup (every hour).
func (qm *QueueManager) maintenance() {
	staleRecovery := time.NewTicker(5 * time.Minute)
	cleanup := time.NewTicker(1 * time.Hour)
	defer staleRecovery.Stop()
	defer cleanup.Stop()

	for {
		select {
		case <-qm.done:
			return
		case <-staleRecovery.C:
			if n := recoverStaleJobs(qm.db, 10*time.Minute); n > 0 {
				log.Printf("[QueueManager] ♻️  Recovered %d stale jobs", n)
			}
		case <-cleanup.C:
			cleanupOldJobs(qm.db)
		}
	}
}

// ── Internal: ID generator ──────────────────────────────────────────────────

func generateJobID(queueName, jobName string) string {
	return fmt.Sprintf("%s:%s:%d", queueName, jobName, time.Now().UnixNano())
}

// ── JSON helper (used by callers to inspect job data) ───────────────────────

// DecodeJobData decodes job.Data into a target struct.
// Works with both in-memory struct data and json.RawMessage from Postgres.
func DecodeJobData(job *Job, target interface{}) error {
	raw, err := json.Marshal(job.Data)
	if err != nil {
		return err
	}
	return json.Unmarshal(raw, target)
}
