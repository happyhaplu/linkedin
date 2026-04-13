package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

// TestRequirePlan_Active verifies that a request with plan_active=true is allowed through.
func TestRequirePlan_Active(t *testing.T) {
	app := fiber.New()
	// Inject active plan into locals before the planGate
	app.Use(func(c *fiber.Ctx) error {
		c.Locals(LocalsPlanActive, true)
		return c.Next()
	})
	app.Get("/protected", RequirePlan(), func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/protected", nil)
	req.Header.Set("Accept", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test error: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Errorf("active plan: expected 200, got %d", resp.StatusCode)
	}
}

// TestRequirePlan_InactivePlan verifies that a request with plan_active=false returns 402.
func TestRequirePlan_InactivePlan(t *testing.T) {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals(LocalsPlanActive, false)
		return c.Next()
	})
	app.Get("/protected", RequirePlan(), func(c *fiber.Ctx) error {
		return c.SendString("should not reach here")
	})

	req := httptest.NewRequest("GET", "/protected", nil)
	req.Header.Set("Accept", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test error: %v", err)
	}
	if resp.StatusCode != fiber.StatusPaymentRequired {
		t.Errorf("inactive plan: expected 402, got %d", resp.StatusCode)
	}
}

// TestRequirePlan_MissingLocals verifies that missing locals (nil) is treated as inactive.
func TestRequirePlan_MissingLocals(t *testing.T) {
	app := fiber.New()
	// No locals set at all — plan_active will be nil which casts to false
	app.Get("/protected", RequirePlan(), func(c *fiber.Ctx) error {
		return c.SendString("should not reach here")
	})

	req := httptest.NewRequest("GET", "/protected", nil)
	req.Header.Set("Accept", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test error: %v", err)
	}
	if resp.StatusCode != fiber.StatusPaymentRequired {
		t.Errorf("missing locals: expected 402, got %d", resp.StatusCode)
	}
}

// TestIsAPIRequest verifies the helper function that distinguishes API vs HTML requests.
func TestIsAPIRequest_APIPath(t *testing.T) {
	app := fiber.New()
	var apiDetected bool
	app.Get("/api/test", func(c *fiber.Ctx) error {
		apiDetected = isAPIRequest(c)
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/api/test", nil)
	_, _ = app.Test(req)
	if !apiDetected {
		t.Error("expected isAPIRequest=true for /api/ path")
	}
}

func TestIsAPIRequest_HTMLPath(t *testing.T) {
	app := fiber.New()
	var apiDetected bool
	app.Get("/dashboard", func(c *fiber.Ctx) error {
		apiDetected = isAPIRequest(c)
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/dashboard", nil)
	req.Header.Set("Accept", "text/html,application/xhtml+xml")
	_, _ = app.Test(req)
	if apiDetected {
		t.Error("expected isAPIRequest=false for HTML request to /dashboard")
	}
}

func TestIsAPIRequest_JSONAcceptHeader(t *testing.T) {
	app := fiber.New()
	var apiDetected bool
	app.Get("/some-page", func(c *fiber.Ctx) error {
		apiDetected = isAPIRequest(c)
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/some-page", nil)
	req.Header.Set("Accept", "application/json")
	_, _ = app.Test(req)
	if !apiDetected {
		t.Error("expected isAPIRequest=true for application/json Accept header")
	}
}
