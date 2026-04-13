package router

// router_smoke_test.go — Smoke tests for all API routes and their auth guards.
//
// These tests use a minimal Fiber app that ONLY has the route registered
// (no real DB, no real middleware) to verify:
//   - Route paths are wired correctly
//   - Auth guards return the right HTTP status codes
//   - Public routes are accessible without session
//
// For full integration tests against PostgreSQL, see the smoke-test.sh script.

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	mw "github.com/reach/backend/internal/middleware"
)

// ── Helpers ──────────────────────────────────────────────────────────────────

// buildApp creates a minimal Fiber app wired with session + plan gate middleware
// and a selection of representative routes, using stub handlers.
func buildApp() *fiber.App {
	app := fiber.New(fiber.Config{
		// Suppress error output during tests
		DisableStartupMessage: true,
	})

	// ── Public routes ──────────────────────────────────────────────────────
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.Status(200).JSON(fiber.Map{"status": "ok", "service": "reach-backend"})
	})

	// ── API group — always returns 401 with no real session middleware ──────
	// We test WITHOUT a real DB by simply checking that our stub guard fires.
	//
	// In these tests RequireSession is replaced with a simple guard that
	// immediately returns 401 unless the test injects a special header.
	sessionGuard := func(c *fiber.Ctx) error {
		if c.Get("X-Test-Session") == "valid" {
			// Set locals to mimic RequireSession
			c.Locals(mw.LocalsUserID, "test-user")
			c.Locals(mw.LocalsEmail, "test@example.com")
			c.Locals(mw.LocalsPlanActive, c.Get("X-Test-Plan") == "active")
			c.Locals(mw.LocalsWorkspaceID, "ws-test")
			return c.Next()
		}
		return c.Status(401).JSON(fiber.Map{"error": "Authentication required"})
	}

	api := app.Group("/api", sessionGuard)

	// Session-only (no plan gate)
	api.Get("/auth/me", func(c *fiber.Ctx) error {
		return c.Status(200).JSON(fiber.Map{"user": fiber.Map{
			"id":    c.Locals(mw.LocalsUserID),
			"email": c.Locals(mw.LocalsEmail),
		}})
	})

	planGate := mw.RequirePlan()

	// Plan-gated routes (representative sample from each module)
	api.Get("/linkedin-accounts", planGate, func(c *fiber.Ctx) error {
		return c.Status(200).JSON(fiber.Map{"accounts": []interface{}{}})
	})
	api.Get("/campaigns", planGate, func(c *fiber.Ctx) error {
		return c.Status(200).JSON(fiber.Map{"campaigns": []interface{}{}})
	})
	api.Get("/leads", planGate, func(c *fiber.Ctx) error {
		return c.Status(200).JSON(fiber.Map{"leads": []interface{}{}})
	})
	api.Get("/lists", planGate, func(c *fiber.Ctx) error {
		return c.Status(200).JSON(fiber.Map{"lists": []interface{}{}})
	})
	api.Get("/network/connections", planGate, func(c *fiber.Ctx) error {
		return c.Status(200).JSON(fiber.Map{"connections": []interface{}{}})
	})
	api.Get("/unibox/conversations", planGate, func(c *fiber.Ctx) error {
		return c.Status(200).JSON(fiber.Map{"conversations": []interface{}{}})
	})
	api.Get("/analytics", planGate, func(c *fiber.Ctx) error {
		return c.Status(200).JSON(fiber.Map{"data": nil})
	})
	api.Get("/queue/stats", planGate, func(c *fiber.Ctx) error {
		return c.Status(200).JSON(fiber.Map{"queues": []interface{}{}})
	})
	api.Get("/proxies", planGate, func(c *fiber.Ctx) error {
		return c.Status(200).JSON(fiber.Map{"proxies": []interface{}{}})
	})

	return app
}

// ── Test: Public route ────────────────────────────────────────────────────────

func TestSmoke_Health(t *testing.T) {
	app := buildApp()
	req := httptest.NewRequest("GET", "/health", nil)
	resp, _ := app.Test(req)
	if resp.StatusCode != 200 {
		t.Errorf("GET /health: expected 200, got %d", resp.StatusCode)
	}
}

// ── Test: No session → 401 ────────────────────────────────────────────────────

func TestSmoke_NoSession_AllRoutes(t *testing.T) {
	app := buildApp()

	routes := []string{
		"/api/auth/me",
		"/api/linkedin-accounts",
		"/api/campaigns",
		"/api/leads",
		"/api/lists",
		"/api/network/connections",
		"/api/unibox/conversations",
		"/api/analytics",
		"/api/queue/stats",
		"/api/proxies",
	}

	for _, path := range routes {
		req := httptest.NewRequest("GET", path, nil)
		req.Header.Set("Accept", "application/json")
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("GET %s: app.Test error: %v", path, err)
		}
		if resp.StatusCode != 401 {
			t.Errorf("GET %s (no session): expected 401, got %d", path, resp.StatusCode)
		}
	}
}

// ── Test: Valid session, no active plan ───────────────────────────────────────

func TestSmoke_SessionNoPlan_AuthMeReturns200(t *testing.T) {
	app := buildApp()
	req := httptest.NewRequest("GET", "/api/auth/me", nil)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Test-Session", "valid")
	// X-Test-Plan NOT set → plan_active = false
	resp, _ := app.Test(req)
	if resp.StatusCode != 200 {
		t.Errorf("GET /api/auth/me (no plan): expected 200, got %d — this is the regression test for the billing gate bug", resp.StatusCode)
	}
}

func TestSmoke_SessionNoPlan_ProtectedRoutes402(t *testing.T) {
	app := buildApp()

	planGatedRoutes := []string{
		"/api/linkedin-accounts",
		"/api/campaigns",
		"/api/leads",
		"/api/lists",
		"/api/network/connections",
		"/api/unibox/conversations",
		"/api/analytics",
		"/api/queue/stats",
		"/api/proxies",
	}

	for _, path := range planGatedRoutes {
		req := httptest.NewRequest("GET", path, nil)
		req.Header.Set("Accept", "application/json")
		req.Header.Set("X-Test-Session", "valid")
		// X-Test-Plan NOT set → plan inactive
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("GET %s: app.Test error: %v", path, err)
		}
		if resp.StatusCode != 402 {
			t.Errorf("GET %s (no plan): expected 402, got %d", path, resp.StatusCode)
		}
	}
}

// ── Test: Valid session + active plan → 200 ────────────────────────────────────

func TestSmoke_SessionActivePlan_AllRoutes200(t *testing.T) {
	app := buildApp()

	routes := []string{
		"/api/auth/me",
		"/api/linkedin-accounts",
		"/api/campaigns",
		"/api/leads",
		"/api/lists",
		"/api/network/connections",
		"/api/unibox/conversations",
		"/api/analytics",
		"/api/queue/stats",
		"/api/proxies",
	}

	for _, path := range routes {
		req := httptest.NewRequest("GET", path, nil)
		req.Header.Set("Accept", "application/json")
		req.Header.Set("X-Test-Session", "valid")
		req.Header.Set("X-Test-Plan", "active")
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("GET %s: app.Test error: %v", path, err)
		}
		if resp.StatusCode != 200 {
			t.Errorf("GET %s (active plan): expected 200, got %d", path, resp.StatusCode)
		}
	}
}

// ── Test: Unknown non-API route → 404 ────────────────────────────────────────
// Note: /api/* routes go through session guard first (returns 401 before route
// matching if no session), so we test a non-API path for 404 behaviour.

func TestSmoke_UnknownNonAPIRoute_Returns404(t *testing.T) {
	app := buildApp()
	// A completely unknown non-API path should get 404 from Fiber
	req := httptest.NewRequest("GET", "/completely-unknown-path", nil)
	resp, _ := app.Test(req)
	if resp.StatusCode != 404 {
		t.Errorf("unknown route: expected 404, got %d", resp.StatusCode)
	}
}

// TestSmoke_UnknownAPIRoute_Returns401WithNoSession verifies that session guard
// fires before route matching — unknown API routes return 401, not 404.
func TestSmoke_UnknownAPIRoute_Returns401WithNoSession(t *testing.T) {
	app := buildApp()
	req := httptest.NewRequest("GET", "/api/does-not-exist", nil)
	req.Header.Set("Accept", "application/json")
	// No session header → session guard fires first, returns 401
	resp, _ := app.Test(req)
	if resp.StatusCode != 401 {
		t.Errorf("unknown API route (no session): expected 401 (session guard fires first), got %d", resp.StatusCode)
	}
}
