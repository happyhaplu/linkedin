package queue

import (
	"encoding/json"
	"log"
	"time"

	"gorm.io/gorm"
)

// ──────────────────────────────────────────────────────────────────────────────
// Postgres-backed Job Store
//
// Replaces the in-memory channel approach so that jobs survive process restarts.
// Uses Postgres' FOR UPDATE SKIP LOCKED for safe concurrent worker polling.
// ──────────────────────────────────────────────────────────────────────────────

// QueueJob is the GORM model stored in the "queue_jobs" table.
type QueueJob struct {
	ID          string     `gorm:"primaryKey;size:255"`
	Queue       string     `gorm:"size:100;not null;index:idx_qj_poll,priority:1"`
	Name        string     `gorm:"size:100;not null"`
	Data        []byte     `gorm:"type:jsonb;default:'{}'"`
	Status      string     `gorm:"size:20;not null;default:'waiting';index:idx_qj_poll,priority:2"`
	Attempts    int        `gorm:"not null;default:0"`
	MaxAttempts int        `gorm:"not null;default:3"`
	RunAt       time.Time  `gorm:"not null;index:idx_qj_poll,priority:3"`
	CreatedAt   time.Time  `gorm:"not null"`
	LockedAt    *time.Time `json:"locked_at,omitempty"`
	LockedBy    string     `gorm:"size:100" json:"locked_by,omitempty"`
	Error       string     `gorm:"type:text" json:"error,omitempty"`
}

// TableName overrides the default table name.
func (QueueJob) TableName() string { return "queue_jobs" }

// ToJob converts a QueueJob row into the in-memory Job type used by processors.
func (qj *QueueJob) ToJob() *Job {
	return &Job{
		ID:          qj.ID,
		Queue:       qj.Queue,
		Name:        qj.Name,
		Data:        json.RawMessage(qj.Data),
		Status:      JobStatus(qj.Status),
		Attempts:    qj.Attempts,
		MaxAttempts: qj.MaxAttempts,
		RunAt:       qj.RunAt,
		CreatedAt:   qj.CreatedAt,
		Error:       qj.Error,
	}
}

// ── Fetch & Lock ────────────────────────────────────────────────────────────

// fetchAndLock atomically claims the next eligible job for a queue.
// Uses Postgres' FOR UPDATE SKIP LOCKED to prevent double-processing when
// multiple workers poll concurrently.
func fetchAndLock(db *gorm.DB, queueName, lockedBy string) (*QueueJob, error) {
	var job QueueJob
	now := time.Now()

	err := db.Raw(`
		UPDATE queue_jobs SET status = 'active', locked_at = $1, locked_by = $2
		WHERE id = (
			SELECT id FROM queue_jobs
			WHERE queue = $3
			  AND status IN ('waiting', 'delayed')
			  AND run_at <= $4
			ORDER BY run_at ASC
			LIMIT 1
			FOR UPDATE SKIP LOCKED
		)
		RETURNING *
	`, now, lockedBy, queueName, now).Scan(&job).Error

	if err != nil {
		return nil, err
	}
	if job.ID == "" {
		return nil, nil // no eligible jobs
	}

	return &job, nil
}

// ── Status Transitions ──────────────────────────────────────────────────────

// markCompleted marks a job as completed and releases the lock.
func markCompleted(db *gorm.DB, jobID string) error {
	return db.Model(&QueueJob{}).Where("id = ?", jobID).
		Updates(map[string]interface{}{
			"status":    string(JobStatusCompleted),
			"locked_at": nil,
			"locked_by": "",
		}).Error
}

// markFailed marks a job as permanently failed.
func markFailed(db *gorm.DB, jobID string, attempts int, errMsg string) error {
	return db.Model(&QueueJob{}).Where("id = ?", jobID).
		Updates(map[string]interface{}{
			"status":    string(JobStatusFailed),
			"attempts":  attempts,
			"error":     errMsg,
			"locked_at": nil,
			"locked_by": "",
		}).Error
}

// markDelayed schedules a job for retry at a future time.
func markDelayed(db *gorm.DB, jobID string, attempts int, errMsg string, runAt time.Time) error {
	return db.Model(&QueueJob{}).Where("id = ?", jobID).
		Updates(map[string]interface{}{
			"status":    string(JobStatusDelayed),
			"attempts":  attempts,
			"error":     errMsg,
			"run_at":    runAt,
			"locked_at": nil,
			"locked_by": "",
		}).Error
}

// ── Stats ───────────────────────────────────────────────────────────────────

// countByStatus returns job counts grouped by status for a single queue.
func countByStatus(db *gorm.DB, queueName string) QueueStats {
	type statusCount struct {
		Status string
		Count  int
	}
	var counts []statusCount

	db.Model(&QueueJob{}).
		Select("status, count(*) as count").
		Where("queue = ?", queueName).
		Group("status").
		Scan(&counts)

	var stats QueueStats
	for _, sc := range counts {
		switch JobStatus(sc.Status) {
		case JobStatusWaiting:
			stats.Waiting = sc.Count
		case JobStatusActive:
			stats.Active = sc.Count
		case JobStatusCompleted:
			stats.Completed = sc.Count
		case JobStatusFailed:
			stats.Failed = sc.Count
		case JobStatusDelayed:
			stats.Delayed = sc.Count
		}
	}
	stats.Total = stats.Waiting + stats.Active + stats.Completed + stats.Failed + stats.Delayed
	return stats
}

// ── Recovery & Cleanup ──────────────────────────────────────────────────────

// recoverStaleJobs resets jobs that have been locked for longer than the given
// timeout back to 'waiting' so they can be re-processed. This handles crash
// recovery and graceful shutdown (pass timeout=0 to release all active jobs).
func recoverStaleJobs(db *gorm.DB, timeout time.Duration) int64 {
	cutoff := time.Now().Add(-timeout)
	result := db.Model(&QueueJob{}).
		Where("status = ? AND locked_at < ?", string(JobStatusActive), cutoff).
		Updates(map[string]interface{}{
			"status":    string(JobStatusWaiting),
			"locked_at": nil,
			"locked_by": "",
		})
	return result.RowsAffected
}

// cleanupOldJobs removes completed and failed jobs past their retention period.
func cleanupOldJobs(db *gorm.DB) int64 {
	completedCutoff := time.Now().Add(-DefaultCompletedTTL)
	failedCutoff := time.Now().Add(-DefaultFailedTTL)

	var total int64

	r1 := db.Where("status = ? AND created_at < ?", string(JobStatusCompleted), completedCutoff).
		Delete(&QueueJob{})
	total += r1.RowsAffected

	r2 := db.Where("status = ? AND created_at < ?", string(JobStatusFailed), failedCutoff).
		Delete(&QueueJob{})
	total += r2.RowsAffected

	if total > 0 {
		log.Printf("[JobStore] 🧹 Cleaned up %d old jobs (completed: %d, failed: %d)",
			total, r1.RowsAffected, r2.RowsAffected)
	}

	return total
}
