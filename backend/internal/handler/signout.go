package handler

import (
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/reach/backend/internal/auth"
	"github.com/reach/backend/internal/config"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// SignOutHandler handles POST/GET /auth/signout
//
// Deletes the DB session, clears the session cookie, then either
// redirects (GET) or returns the Accounts logout URL (POST/fetch).
func SignOutHandler(cfg *config.Config, db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Delete DB session if cookie present
		sessionID := c.Cookies(cfg.SessionCookie)
		if sessionID != "" {
			if err := db.Where("id = ?", sessionID).Delete(&models.Session{}).Error; err != nil {
				log.Printf("[SignOut] Failed to delete session %s: %v", sessionID, err)
			}
		}

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
