package handler

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/reach/backend/internal/auth"
	"github.com/reach/backend/internal/config"
	"github.com/reach/backend/internal/middleware"
)

// CheckHandler handles GET /api/auth/check
//
// It calls Accounts GET /api/v1/products/reach/check to re-validate that
// the user still has an active subscription. The session JWT (already
// verified by RequireAuth middleware) provides the user context.
func CheckHandler(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Prefer the raw Accounts launch token for the bearer call
		token := c.Cookies("reach-accounts-token")
		if token == "" {
			token = c.Cookies(cfg.SessionCookie)
		}
		if token == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"valid": false,
				"error": "No session token",
			})
		}

		result, err := auth.CheckSubscription(cfg, token)
		if err != nil {
			log.Printf("[Check] Accounts /check failed: %v", err)
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"valid": false,
				"error": "Token validation failed",
			})
		}

		if !result.Active {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"valid":  false,
				"active": false,
				"status": result.Status,
				"error":  "Active subscription required",
			})
		}

		return c.JSON(fiber.Map{
			"valid":        true,
			"active":       result.Active,
			"status":       result.Status,
			"plan":         result.PlanName,
			"user_id":      c.Locals(middleware.LocalsUserID),
			"email":        c.Locals(middleware.LocalsEmail),
			"workspace_id": c.Locals(middleware.LocalsWorkspaceID),
		})
	}
}
