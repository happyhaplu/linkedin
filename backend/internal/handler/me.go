package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/reach/backend/internal/middleware"
)

// MeHandler handles GET /api/auth/me
//
// Returns the current authenticated user from the JWT claims.
// Requires RequireAuth middleware to have run first.
func MeHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"user": fiber.Map{
				"id":           c.Locals(middleware.LocalsUserID),
				"email":        c.Locals(middleware.LocalsEmail),
				"subscribed":   c.Locals(middleware.LocalsSubscribed),
				"plan":         c.Locals(middleware.LocalsPlan),
				"workspace_id": c.Locals(middleware.LocalsWorkspaceID),
			},
		})
	}
}
