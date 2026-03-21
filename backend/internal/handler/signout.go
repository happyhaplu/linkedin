package handler

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/reach/backend/internal/auth"
	"github.com/reach/backend/internal/config"
)

// SignOutHandler handles POST /auth/signout
//
// Clears both the Reach session cookie and the Accounts token cookie,
// then returns the Accounts sign-out URL for the frontend to navigate to.
func SignOutHandler(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Clear session cookie
		c.Cookie(&fiber.Cookie{
			Name:     cfg.SessionCookie,
			Value:    "",
			Path:     "/",
			MaxAge:   -1,
			Expires:  time.Now().Add(-1 * time.Hour),
			HTTPOnly: true,
			Secure:   cfg.CookieSecure,
			SameSite: cfg.CookieSameSite,
		})

		// Clear Accounts token cookie
		c.Cookie(&fiber.Cookie{
			Name:     "reach-accounts-token",
			Value:    "",
			Path:     "/",
			MaxAge:   -1,
			Expires:  time.Now().Add(-1 * time.Hour),
			HTTPOnly: true,
			Secure:   cfg.CookieSecure,
			SameSite: cfg.CookieSameSite,
		})

		// For GET requests (link-based sign out), redirect directly
		if c.Method() == fiber.MethodGet {
			return c.Redirect(auth.SignOutURL(cfg), fiber.StatusTemporaryRedirect)
		}

		// For POST (fetch from frontend), return JSON with the URL to navigate to
		return c.JSON(fiber.Map{
			"logout_url": auth.SignOutURL(cfg),
		})
	}
}
