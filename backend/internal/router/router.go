package router

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/reach/backend/internal/config"
	"github.com/reach/backend/internal/handler"
	mw "github.com/reach/backend/internal/middleware"
)

// Setup configures all routes and middleware on the Fiber app.
func Setup(app *fiber.App, cfg *config.Config) {
	// ── Global middleware ────────────────────────────────────────────────────
	app.Use(recover.New())
	app.Use(mw.Logger())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.FrontendURL + ", " + cfg.AppURL,
		AllowCredentials: true,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
	}))

	// ── Health ──────────────────────────────────────────────────────────────
	app.Get("/health", handler.HealthHandler())

	// ── Auth routes (no session required) ───────────────────────────────────
	authGroup := app.Group("/auth")
	authGroup.Get("/callback", handler.CallbackHandler(cfg))
	authGroup.Post("/signout", handler.SignOutHandler(cfg))
	authGroup.Get("/signout", handler.SignOutHandler(cfg)) // support GET for link-based sign out

	// ── API routes (session required) ───────────────────────────────────────
	api := app.Group("/api", mw.RequireAuth(cfg))

	// Auth introspection
	api.Get("/auth/me", handler.MeHandler())

	// Check route — proxies to Accounts for real-time subscription validation
	// Uses the stricter middleware that calls Accounts /check on every request
	api.Get("/auth/check", mw.RequireAuthWithCheck(cfg), handler.CheckHandler(cfg))

	// ── Protected app routes (placeholder groups) ───────────────────────────
	// These will be filled in as we migrate each Next.js API route to Go.
	//
	// api.Get("/dashboard/stats", handler.DashboardStatsHandler(...))
	// api.Group("/campaigns", ...)
	// api.Group("/leads", ...)
	// api.Group("/linkedin-accounts", ...)
	// api.Group("/my-network", ...)
	// api.Group("/unibox", ...)
}
