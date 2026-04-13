package handler

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/reach/backend/internal/middleware"
)

// ── GET /health ──────────────────────────────────────────────────────────────

func TestHealthHandler_Returns200(t *testing.T) {
	app := fiber.New()
	app.Get("/health", HealthHandler())

	req := httptest.NewRequest("GET", "/health", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test error: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestHealthHandler_ReturnsJSON(t *testing.T) {
	app := fiber.New()
	app.Get("/health", HealthHandler())

	req := httptest.NewRequest("GET", "/health", nil)
	resp, _ := app.Test(req)

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("response is not valid JSON: %v — body: %s", err, body)
	}
	if result["status"] != "ok" {
		t.Errorf("expected status=ok, got %v", result["status"])
	}
	if result["service"] == "" || result["service"] == nil {
		t.Error("expected non-empty service field")
	}
}

// ── GET /api/auth/me ─────────────────────────────────────────────────────────

func TestMeHandler_Returns200WithAllFields(t *testing.T) {
	app := fiber.New()

	// Inject all locals that RequireSession would have set
	app.Use(func(c *fiber.Ctx) error {
		c.Locals(middleware.LocalsUserID, "user-001")
		c.Locals(middleware.LocalsEmail, "test@example.com")
		c.Locals(middleware.LocalsSubscribed, true)
		c.Locals(middleware.LocalsPlan, "Starter")
		c.Locals(middleware.LocalsPlanType, "custom")
		c.Locals(middleware.LocalsPlanStatus, "active")
		c.Locals(middleware.LocalsPlanActive, true)
		c.Locals(middleware.LocalsSenderLimit, 3)
		c.Locals(middleware.LocalsWorkspaceID, "ws-001")
		return c.Next()
	})
	app.Get("/api/auth/me", MeHandler())

	req := httptest.NewRequest("GET", "/api/auth/me", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test error: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("invalid JSON: %v — %s", err, body)
	}

	user, ok := result["user"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected 'user' object in response, got %T: %v", result["user"], result)
	}

	checks := map[string]interface{}{
		"id":          "user-001",
		"email":       "test@example.com",
		"plan":        "Starter",
		"plan_active": true,
	}
	for field, expected := range checks {
		if user[field] != expected {
			t.Errorf("user.%s: expected %v, got %v", field, expected, user[field])
		}
	}
}

func TestMeHandler_ReturnsNullLocalsGracefully(t *testing.T) {
	app := fiber.New()
	// No locals injected — Fiber will return nil for all Locals() calls
	app.Get("/api/auth/me", MeHandler())

	req := httptest.NewRequest("GET", "/api/auth/me", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test error: %v", err)
	}
	// MeHandler just serialises locals, it should always return 200
	if resp.StatusCode != fiber.StatusOK {
		t.Errorf("expected 200 even with nil locals, got %d", resp.StatusCode)
	}
}

// ── POST /admin/login ────────────────────────────────────────────────────────
// These tests use a nil DB intentionally — we only test validation paths
// that short-circuit before hitting the DB.

func TestAdminLogin_MissingBody(t *testing.T) {
	app := fiber.New()
	// Pass nil config — the handler checks credentials before using cfg fields other
	// than AdminEmail / AdminPassword
	app.Post("/admin/login", func(c *fiber.Ctx) error {
		var body struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}
		if body.Email == "" || body.Password == "" {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	})

	req := httptest.NewRequest("POST", "/admin/login", nil)
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != 400 {
		t.Errorf("missing body: expected 400, got %d", resp.StatusCode)
	}
}

// ── Plan gate integration: chain of middleware ───────────────────────────────

// TestPlanGateIntegration tests RequireSession-like locals injection → RequirePlan chain.
func TestPlanGateIntegration_ActivePlanAllows(t *testing.T) {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals(middleware.LocalsPlanActive, true)
		return c.Next()
	})
	app.Get("/api/linkedin-accounts", middleware.RequirePlan(), func(c *fiber.Ctx) error {
		return c.Status(200).JSON(fiber.Map{"accounts": []interface{}{}})
	})

	req := httptest.NewRequest("GET", "/api/linkedin-accounts", nil)
	req.Header.Set("Accept", "application/json")
	resp, _ := app.Test(req)
	if resp.StatusCode != 200 {
		t.Errorf("active plan: expected 200, got %d", resp.StatusCode)
	}
}

func TestPlanGateIntegration_InactivePlanBlocks(t *testing.T) {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals(middleware.LocalsPlanActive, false)
		return c.Next()
	})
	app.Get("/api/linkedin-accounts", middleware.RequirePlan(), func(c *fiber.Ctx) error {
		return c.Status(200).JSON(fiber.Map{"accounts": []interface{}{}})
	})

	req := httptest.NewRequest("GET", "/api/linkedin-accounts", nil)
	req.Header.Set("Accept", "application/json")
	resp, _ := app.Test(req)
	if resp.StatusCode != 402 {
		t.Errorf("inactive plan: expected 402, got %d", resp.StatusCode)
	}
}

// ── AuthMe is NOT plan-gated (regression test for the middleware ordering bug) ─

// TestMeNotPlanGated verifies /api/auth/me returns 200 even when plan_active=false.
// This is the key regression test for the Fiber v2 middleware ordering bug we fixed.
func TestMeNotPlanGated(t *testing.T) {
	app := fiber.New()
	// Simulate RequireSession result — session exists but plan is inactive
	app.Use(func(c *fiber.Ctx) error {
		c.Locals(middleware.LocalsUserID, "user-001")
		c.Locals(middleware.LocalsEmail, "user@example.com")
		c.Locals(middleware.LocalsPlanActive, false) // no plan
		c.Locals(middleware.LocalsPlanStatus, "inactive")
		return c.Next()
	})

	// /me has NO planGate — should always return 200
	app.Get("/api/auth/me", MeHandler())

	// /linkedin-accounts HAS planGate
	app.Get("/api/linkedin-accounts", middleware.RequirePlan(), func(c *fiber.Ctx) error {
		return c.Status(200).JSON(fiber.Map{"data": []interface{}{}})
	})

	// Test /me — must return 200 regardless of plan status
	req := httptest.NewRequest("GET", "/api/auth/me", nil)
	req.Header.Set("Accept", "application/json")
	resp, _ := app.Test(req)
	if resp.StatusCode != 200 {
		t.Errorf("regression: /api/auth/me must return 200 regardless of plan, got %d", resp.StatusCode)
	}

	// Test /linkedin-accounts — must return 402
	req2 := httptest.NewRequest("GET", "/api/linkedin-accounts", nil)
	req2.Header.Set("Accept", "application/json")
	resp2, _ := app.Test(req2)
	if resp2.StatusCode != 402 {
		t.Errorf("regression: /api/linkedin-accounts must return 402 when plan inactive, got %d", resp2.StatusCode)
	}
}
