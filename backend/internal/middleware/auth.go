package middleware

import (
	"log"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/reach/backend/internal/auth"
	"github.com/reach/backend/internal/config"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// ContextKey constants for storing auth data in Fiber locals.
const (
	LocalsUserID      = "user_id"
	LocalsEmail       = "email"
	LocalsSubscribed  = "subscribed"
	LocalsPlan        = "plan"
	LocalsWorkspaceID = "workspace_id"
	LocalsSessionID   = "session_id"
)

// RequireAuth is Fiber middleware that:
//  1. Reads the session cookie (UUID).
//  2. Looks up the session in the database.
//  3. Ensures the session exists, is not expired, and is subscribed.
//
// On failure it returns 401 (API) or redirects to Accounts login.
func RequireAuth(cfg *config.Config, db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		sessionID := c.Cookies(cfg.SessionCookie)
		if sessionID == "" {
			return unauthorised(c, cfg)
		}

		// ── Look up session in DB ──────────────────────────────────────────
		var session models.Session
		if err := db.Where("id = ?", sessionID).First(&session).Error; err != nil {
			log.Printf("[Auth] Session not found: %v", err)
			return unauthorised(c, cfg)
		}

		if session.IsExpired() {
			log.Printf("[Auth] Session expired for user %s", session.Email)
			db.Delete(&session) // clean up
			return unauthorised(c, cfg)
		}

		if !session.Subscribed {
			log.Printf("[Auth] User %s not subscribed", session.Email)
			return forbidden(c, cfg)
		}

		// ── Store user context for downstream handlers ─────────────────────
		c.Locals(LocalsUserID, session.UserID)
		c.Locals(LocalsEmail, session.Email)
		c.Locals(LocalsSubscribed, session.Subscribed)
		c.Locals(LocalsPlan, session.Plan)
		c.Locals(LocalsWorkspaceID, session.WorkspaceID)
		c.Locals(LocalsSessionID, session.ID)

		return c.Next()
	}
}

// RequireAuthWithCheck is a stricter variant that calls Accounts /check on
// every request to re-validate the subscription in real time.
// Use for sensitive operations; RequireAuth is fine for most routes.
func RequireAuthWithCheck(cfg *config.Config, db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		sessionID := c.Cookies(cfg.SessionCookie)
		if sessionID == "" {
			return unauthorised(c, cfg)
		}

		var session models.Session
		if err := db.Where("id = ?", sessionID).First(&session).Error; err != nil {
			return unauthorised(c, cfg)
		}

		if session.IsExpired() {
			db.Delete(&session)
			return unauthorised(c, cfg)
		}

		// ── Re-validate with Accounts API ──────────────────────────────────
		checkResp, err := auth.CheckSubscription(cfg, session.AccountsToken)
		if err != nil {
			log.Printf("[Auth] Accounts /check failed: %v", err)
			return unauthorised(c, cfg)
		}

		if !checkResp.Active {
			// Update session — subscription lapsed
			db.Model(&session).Update("subscribed", false)
			return forbidden(c, cfg)
		}

		// ── Update session if plan changed ─────────────────────────────────
		if checkResp.PlanName != session.Plan {
			db.Model(&session).Updates(map[string]interface{}{
				"subscribed": true,
				"plan":       checkResp.PlanName,
			})
		}

		// ── Populate context ───────────────────────────────────────────────
		c.Locals(LocalsUserID, session.UserID)
		c.Locals(LocalsEmail, session.Email)
		c.Locals(LocalsSubscribed, checkResp.Active)
		c.Locals(LocalsPlan, checkResp.PlanName)
		c.Locals(LocalsWorkspaceID, session.WorkspaceID)
		c.Locals(LocalsSessionID, session.ID)

		return c.Next()
	}
}

// CleanExpiredSessions removes sessions past their expiry from the DB.
// Call this periodically (e.g. once per hour from a background goroutine).
func CleanExpiredSessions(db *gorm.DB) {
	result := db.Where("expires_at < ?", time.Now()).Delete(&models.Session{})
	if result.RowsAffected > 0 {
		log.Printf("[Auth] Cleaned %d expired sessions", result.RowsAffected)
	}
}

// ── helpers ─────────────────────────────────────────────────────────────────

func isAPIRequest(c *fiber.Ctx) bool {
	accept := c.Get("Accept")
	return strings.HasPrefix(c.Path(), "/api/") ||
		strings.Contains(accept, "application/json")
}

func unauthorised(c *fiber.Ctx, cfg *config.Config) error {
	if isAPIRequest(c) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Authentication required",
		})
	}
	return c.Redirect(auth.LoginURL(cfg, c.Path()), fiber.StatusTemporaryRedirect)
}

func forbidden(c *fiber.Ctx, cfg *config.Config) error {
	if isAPIRequest(c) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Active subscription required",
		})
	}
	return c.Redirect(auth.BillingURL(cfg), fiber.StatusTemporaryRedirect)
}
