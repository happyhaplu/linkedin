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
	LocalsPlanType    = "plan_type"
	LocalsPlanStatus  = "plan_status"
	LocalsPlanActive  = "plan_active"
	LocalsSenderLimit = "sender_limit"
	LocalsWorkspaceID = "workspace_id"
	LocalsSessionID   = "session_id"
)

// RequireSession validates the DB-backed session and loads billing context.
func RequireSession(cfg *config.Config, db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		session, ok, err := loadSession(cfg, db, c)
		if err != nil {
			log.Printf("[Auth] Session lookup failed: %v", err)
		}
		if !ok {
			return unauthorised(c, cfg)
		}

		populateBillingLocals(c, db, session)
		return c.Next()
	}
}

// RequireAuth is Fiber middleware that:
//  1. Reads the session cookie (UUID).
//  2. Looks up the session in the database.
//  3. Ensures the session exists, is not expired, and is subscribed.
//
// On failure it returns 401 (API) or redirects to Accounts login.
func RequireAuth(cfg *config.Config, db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		session, ok, err := loadSession(cfg, db, c)
		if err != nil {
			log.Printf("[Auth] Session lookup failed: %v", err)
		}
		if !ok {
			return unauthorised(c, cfg)
		}

		if !session.Subscribed {
			log.Printf("[Auth] User %s not subscribed", session.Email)
			return forbidden(c, cfg)
		}

		populateBillingLocals(c, db, session)
		if active, _ := c.Locals(LocalsPlanActive).(bool); !active {
			return paymentRequired(c)
		}

		return c.Next()
	}
}

// RequireAuthWithCheck is a stricter variant that calls Accounts /check on
// every request to re-validate the subscription in real time.
// Use for sensitive operations; RequireAuth is fine for most routes.
func RequireAuthWithCheck(cfg *config.Config, db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		session, ok, _ := loadSession(cfg, db, c)
		if !ok {
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

		populateBillingLocals(c, db, session)
		c.Locals(LocalsSubscribed, checkResp.Active)
		c.Locals(LocalsPlan, checkResp.PlanName)

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

func paymentRequired(c *fiber.Ctx) error {
	if isAPIRequest(c) {
		return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
			"error": "Active billing plan required",
		})
	}
	return c.Redirect("/pricing", fiber.StatusTemporaryRedirect)
}

func loadSession(cfg *config.Config, db *gorm.DB, c *fiber.Ctx) (models.Session, bool, error) {
	sessionID := c.Cookies(cfg.SessionCookie)
	if sessionID == "" {
		return models.Session{}, false, nil
	}

	var session models.Session
	if err := db.Where("id = ?", sessionID).First(&session).Error; err != nil {
		return models.Session{}, false, err
	}

	if session.IsExpired() {
		log.Printf("[Auth] Session expired for user %s", session.Email)
		db.Delete(&session)
		return models.Session{}, false, nil
	}

	return session, true, nil
}

func populateBillingLocals(c *fiber.Ctx, db *gorm.DB, session models.Session) {
	c.Locals(LocalsUserID, session.UserID)
	c.Locals(LocalsEmail, session.Email)
	c.Locals(LocalsSubscribed, session.Subscribed)
	c.Locals(LocalsPlan, session.Plan)
	c.Locals(LocalsWorkspaceID, session.WorkspaceID)
	c.Locals(LocalsSessionID, session.ID)
	c.Locals(LocalsPlanType, nil)
	c.Locals(LocalsPlanStatus, models.UserPlanInactive)
	c.Locals(LocalsPlanActive, false)
	c.Locals(LocalsSenderLimit, 0)

	var userPlan models.UserPlan
	if err := db.Preload("Plan").Where("workspace_id = ?", session.WorkspaceID).First(&userPlan).Error; err != nil {
		return
	}

	if userPlan.Plan != nil {
		c.Locals(LocalsPlan, userPlan.Plan.Name)
		c.Locals(LocalsPlanType, userPlan.Plan.Type)
		c.Locals(LocalsSenderLimit, userPlan.EffectiveSenderLimit())
	}

	active := userPlan.IsActive && (userPlan.Status == models.UserPlanActive || userPlan.Status == models.UserPlanTrialing)
	c.Locals(LocalsPlanStatus, userPlan.Status)
	c.Locals(LocalsPlanActive, active)
}
