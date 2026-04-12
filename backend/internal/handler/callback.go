package handler

import (
	"log"
	"net/url"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/reach/backend/internal/auth"
	"github.com/reach/backend/internal/config"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// CallbackHandler handles GET /callback?token=<launch-token>&next=/dashboard
//
// Flow:
//  1. Accounts authenticates the user and redirects here with ?token=<jwt>.
//  2. We call Accounts POST /api/v1/products/verify with our API key.
//  3. Accounts validates its own token and returns user data.
//  4. We create a DB session, set a cookie with the session UUID, redirect.
//
// No local JWT parsing. No shared secret. Purely API-based.
func CallbackHandler(cfg *config.Config, db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := c.Query("token")
		next := c.Query("next", "/dashboard")

		// ── 1. No token → back to Accounts login ───────────────────────────
		if token == "" {
			log.Println("[Callback] Missing token, redirecting to Accounts login")
			return c.Redirect(auth.LoginURL(cfg, next), fiber.StatusTemporaryRedirect)
		}

		// ── 2. Verify launch token via Accounts API ────────────────────────
		result, err := auth.VerifyToken(cfg, token)
		if err != nil {
			log.Printf("[Callback] Token verification failed: %v", err)
			return c.Redirect(auth.LoginURL(cfg, ""), fiber.StatusTemporaryRedirect)
		}

		// ── 3. Create DB session ───────────────────────────────────────────
		session := models.Session{
			UserID:        result.UserID,
			Email:         result.Email,
			WorkspaceID:   result.WorkspaceID,
			Subscribed:    result.Subscribed,
			AccountsToken: token, // store raw token for server-to-server calls
			CreatedAt:     time.Now(),
			ExpiresAt:     time.Now().Add(cfg.SessionMaxAge),
		}

		if err := db.Create(&session).Error; err != nil {
			log.Printf("[Callback] Failed to create session: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Internal error creating session",
			})
		}

		var userPlan models.UserPlan
		err = db.Where("workspace_id = ?", result.WorkspaceID).First(&userPlan).Error
		if err == gorm.ErrRecordNotFound {
			userPlan = models.UserPlan{
				WorkspaceID: result.WorkspaceID,
				UserEmail:   result.Email,
				Status:      models.UserPlanInactive,
				IsActive:    true,
			}
			if createErr := db.Create(&userPlan).Error; createErr != nil {
				log.Printf("[Callback] Failed to create user plan: %v", createErr)
			}
		} else if err == nil && userPlan.UserEmail != result.Email {
			db.Model(&userPlan).Update("user_email", result.Email)
		}

		// ── 4. Set session cookie (UUID only — no JWT, no secrets) ─────────
		maxAge := int(cfg.SessionMaxAge / time.Second)

		c.Cookie(&fiber.Cookie{
			Name:     cfg.SessionCookie,
			Value:    session.ID, // UUID from BeforeCreate hook
			Path:     "/",
			MaxAge:   maxAge,
			HTTPOnly: true,
			Secure:   cfg.CookieSecure,
			SameSite: cfg.CookieSameSite,
		})

		// ── 5. Redirect to the requested page on the frontend ──────────────
		dest := next
		if dest == "" || dest[0] != '/' {
			dest = "/dashboard"
		}
		redirectURL, _ := url.JoinPath(cfg.FrontendURL, dest)
		log.Printf("[Callback] ✅ User %s authenticated (session %s), redirecting to %s",
			result.Email, session.ID, redirectURL)
		return c.Redirect(redirectURL, fiber.StatusTemporaryRedirect)
	}
}
