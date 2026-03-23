package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/reach/backend/internal/config"
	"github.com/reach/backend/internal/middleware"
)

// ProfileHandler handles GET /api/profile
//
// Returns the authenticated user's profile info along with external Accounts
// service URLs for "Manage Account" and "Billing & Subscription" links.
func ProfileHandler(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"user": fiber.Map{
				"id":           c.Locals(middleware.LocalsUserID),
				"email":        c.Locals(middleware.LocalsEmail),
				"subscribed":   c.Locals(middleware.LocalsSubscribed),
				"plan":         c.Locals(middleware.LocalsPlan),
				"workspace_id": c.Locals(middleware.LocalsWorkspaceID),
			},
			"accounts_url":         cfg.AccountsURL,
			"manage_account_url":   cfg.AccountsURL + "/profile",
			"billing_url":          cfg.AccountsURL + "/billing",
		})
	}
}
