package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/reach/backend/internal/queue"
)

// QueueStatsHandler returns aggregated queue statistics.
// GET /api/queue/stats
func QueueStatsHandler(qm *queue.QueueManager) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if qm == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "Queue system not initialised",
			})
		}
		return c.JSON(fiber.Map{
			"queues": qm.GetAllStats(),
		})
	}
}

// QueuePauseAllHandler pauses all queues.
// POST /api/queue/pause
func QueuePauseAllHandler(qm *queue.QueueManager) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if qm == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "Queue system not initialised",
			})
		}
		qm.PauseAll()
		return c.JSON(fiber.Map{"message": "All queues paused"})
	}
}

// QueueResumeAllHandler resumes all queues.
// POST /api/queue/resume
func QueueResumeAllHandler(qm *queue.QueueManager) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if qm == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "Queue system not initialised",
			})
		}
		qm.ResumeAll()
		return c.JSON(fiber.Map{"message": "All queues resumed"})
	}
}
