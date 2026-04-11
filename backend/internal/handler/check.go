package handler

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/reach/backend/internal/auth"
	"github.com/reach/backend/internal/config"
	"github.com/reach/backend/internal/middleware"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// CheckHandler handles GET /api/auth/check
//
// It reads the accounts token from the DB session and calls
// Accounts GET /api/v1/products/reach/check to re-validate
// that the user still has an active subscription.
func CheckHandler(cfg *config.Config, db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Session ID was set by RequireAuth middleware
		sessionID, _ := c.Locals(middleware.LocalsSessionID).(string)
		if sessionID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"valid": false,
				"error": "No session",
			})
		}

		// Get the raw accounts token from the DB session
		var session models.Session
		if err := db.Where("id = ?", sessionID).First(&session).Error; err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"valid": false,
				"error": "Session not found",
			})
		}

		if session.AccountsToken == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"valid": false,
				"error": "No accounts token in session",
			})
		}

		result, err := auth.CheckSubscription(cfg, session.AccountsToken)
		if err != nil {
			log.Printf("[Check] Accounts /check failed: %v", err)
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"valid": false,
				"error": "Token validation failed",
			})
		}

		if !result.Active {
			// Update session — subscription lapsed
			db.Model(&session).Update("subscribed", false)
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
