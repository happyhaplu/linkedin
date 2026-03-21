package handler

import "github.com/gofiber/fiber/v2"

// HealthHandler handles GET /health — basic liveness check.
func HealthHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"service": "reach-backend",
		})
	}
}
