package middleware

import (
	"log"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/reach/backend/internal/auth"
	"github.com/reach/backend/internal/config"
)

// ContextKey constants for storing auth data in Fiber locals.
const (
	LocalsUserID      = "user_id"
	LocalsEmail       = "email"
	LocalsSubscribed  = "subscribed"
	LocalsPlan        = "plan"
	LocalsWorkspaceID = "workspace_id"
	LocalsClaims      = "claims"
)

// RequireAuth is Fiber middleware that:
//  1. Reads the session cookie.
//  2. Verifies the JWT signature + expiry.
//  3. Ensures the user has an active subscription.
//  4. On first request (or periodically) calls Accounts /check to re-validate.
//
// On failure it returns 401 (API routes) or redirects to the Accounts login page.
func RequireAuth(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		raw := c.Cookies(cfg.SessionCookie)
		if raw == "" {
			return unauthorised(c, cfg)
		}

		// ── 1. Verify local JWT ────────────────────────────────────────────
		claims, err := auth.VerifySessionJWT(cfg, raw)
		if err != nil {
			log.Printf("[Auth] JWT verification failed: %v", err)
			return unauthorised(c, cfg)
		}

		if !claims.Subscribed {
			log.Printf("[Auth] User %s not subscribed", claims.Subject)
			return forbidden(c, cfg)
		}

		// ── 2. Store user context for downstream handlers ──────────────────
		c.Locals(LocalsUserID, claims.Subject)
		c.Locals(LocalsEmail, claims.Email)
		c.Locals(LocalsSubscribed, claims.Subscribed)
		c.Locals(LocalsPlan, claims.Plan)
		c.Locals(LocalsWorkspaceID, claims.WorkspaceID)
		c.Locals(LocalsClaims, claims)

		return c.Next()
	}
}

// RequireAuthWithCheck is a stricter variant that calls Accounts /check on
// every request to re-validate the subscription in real time.
// Use this for sensitive operations; RequireAuth is fine for most routes.
func RequireAuthWithCheck(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		raw := c.Cookies(cfg.SessionCookie)
		if raw == "" {
			return unauthorised(c, cfg)
		}

		claims, err := auth.VerifySessionJWT(cfg, raw)
		if err != nil {
			return unauthorised(c, cfg)
		}

		// Retrieve the raw Accounts launch token (stored alongside the session cookie)
		accountsToken := c.Cookies("reach-accounts-token")
		if accountsToken == "" {
			// Fallback: use the session JWT itself
			accountsToken = raw
		}

		checkResp, err := auth.CheckSubscription(cfg, accountsToken)
		if err != nil {
			log.Printf("[Auth] Accounts /check failed: %v", err)
			return unauthorised(c, cfg)
		}

		if !checkResp.Active {
			return forbidden(c, cfg)
		}

		// Populate context — user data comes from the local session JWT,
		// subscription status is refreshed from Accounts
		c.Locals(LocalsUserID, claims.Subject)
		c.Locals(LocalsEmail, claims.Email)
		c.Locals(LocalsSubscribed, checkResp.Active)
		c.Locals(LocalsPlan, checkResp.PlanName)
		c.Locals(LocalsWorkspaceID, claims.WorkspaceID)
		c.Locals(LocalsClaims, claims)

		return c.Next()
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
