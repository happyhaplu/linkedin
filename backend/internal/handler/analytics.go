package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/reach/backend/internal/service"
)

// AnalyticsHandler handles the analytics dashboard endpoint.
type AnalyticsHandler struct {
	svc *service.AnalyticsService
}

func NewAnalyticsHandler(svc *service.AnalyticsService) *AnalyticsHandler {
	return &AnalyticsHandler{svc: svc}
}

// GET /api/analytics
func (h *AnalyticsHandler) GetAnalyticsData() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		data, err := h.svc.GetAnalyticsData(userID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to load analytics data",
			})
		}

		return c.JSON(data)
	}
}
