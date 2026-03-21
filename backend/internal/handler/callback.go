package handler

import (
	"log"
	"net/url"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/reach/backend/internal/auth"
	"github.com/reach/backend/internal/config"
)

// CallbackHandler handles GET /auth/callback?token=<accounts-jwt>&next=/dashboard
//
// Flow:
//  1. Accounts authenticates the user and redirects here with ?token=<jwt>.
//  2. We verify the launch token locally (shared JWT_SECRET, HS256).
//  3. If valid → sign a local Reach session JWT, set cookies, redirect to frontend.
//  4. If invalid → redirect to Accounts login.
//
// Note: Accounts only issues launch tokens for users with active subscriptions,
// so there is no separate subscription gate here.
func CallbackHandler(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := c.Query("token")
		next := c.Query("next", "/dashboard")

		// ── 1. No token → back to Accounts login ───────────────────────────
		if token == "" {
			log.Println("[Callback] Missing token, redirecting to Accounts login")
			return c.Redirect(auth.LoginURL(cfg, next), fiber.StatusTemporaryRedirect)
		}

		// ── 2. Verify launch token locally (HS256 with shared secret) ──────
		result, err := auth.VerifyLaunchToken(cfg, token)
		if err != nil || result == nil {
			log.Printf("[Callback] Token verification failed: %v", err)
			return c.Redirect(auth.LoginURL(cfg, ""), fiber.StatusTemporaryRedirect)
		}

		// ── 3. Sign local session JWT ──────────────────────────────────────
		sessionToken, err := auth.SignSessionJWT(cfg, result.User, result.Subscription, result.WorkspaceID)
		if err != nil {
			log.Printf("[Callback] Failed to sign session JWT: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Internal error creating session",
			})
		}

		// ── 4. Set cookies ─────────────────────────────────────────────────
		maxAge := int(cfg.SessionMaxAge / time.Second)

		c.Cookie(&fiber.Cookie{
			Name:     cfg.SessionCookie,
			Value:    sessionToken,
			Path:     "/",
			MaxAge:   maxAge,
			HTTPOnly: true,
			Secure:   cfg.CookieSecure,
			SameSite: cfg.CookieSameSite,
		})

		// Persist the raw Accounts launch token for future server-to-server calls
		c.Cookie(&fiber.Cookie{
			Name:     "reach-accounts-token",
			Value:    token,
			Path:     "/",
			MaxAge:   maxAge,
			HTTPOnly: true,
			Secure:   cfg.CookieSecure,
			SameSite: cfg.CookieSameSite,
		})

		// ── 5. Redirect to the requested page on the FRONTEND ────────────
		dest := next
		if dest == "" || dest[0] != '/' {
			dest = "/dashboard"
		}
		// Build an absolute URL on the frontend origin (Next.js)
		redirectURL, _ := url.JoinPath(cfg.FrontendURL, dest)
		log.Printf("[Callback] ✅ User %s authenticated, redirecting to %s", result.User.Email, redirectURL)
		return c.Redirect(redirectURL, fiber.StatusTemporaryRedirect)
	}
}
