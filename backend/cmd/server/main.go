package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"
	"github.com/reach/backend/internal/config"
	"github.com/reach/backend/internal/database"
	"github.com/reach/backend/internal/router"
)

func main() {
	// Load .env if present (dev mode). In production use real env vars.
	if err := godotenv.Load(); err != nil {
		log.Println("[ENV] No .env file found, using environment variables")
	}

	cfg := config.Load()

	// ── Validate critical config ────────────────────────────────────────────
	if cfg.JWTSecret == "" {
		log.Fatal("[FATAL] JWT_SECRET is required. Set it in .env or environment.")
	}
	if cfg.AccountsURL == "" {
		log.Fatal("[FATAL] ACCOUNTS_URL is required.")
	}

	// ── Database ────────────────────────────────────────────────────────────
	db := database.Connect(cfg.DatabaseURL)
	_ = db // Will be injected into handlers when we migrate data routes

	// ── Fiber app ───────────────────────────────────────────────────────────
	app := fiber.New(fiber.Config{
		AppName:      "Reach Backend",
		ServerHeader: "Reach",
		// Don't crash the whole server on a panic in a handler
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			log.Printf("[ERROR] %s %s → %d: %v", c.Method(), c.Path(), code, err)
			return c.Status(code).JSON(fiber.Map{"error": err.Error()})
		},
	})

	router.Setup(app, cfg)

	// ── Graceful shutdown ───────────────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-quit
		log.Println("[Server] Shutting down…")
		_ = app.Shutdown()
	}()

	// ── Start ───────────────────────────────────────────────────────────────
	addr := ":" + cfg.Port
	log.Printf("[Server] 🚀 Reach backend listening on %s", addr)
	log.Printf("[Server] Accounts URL: %s", cfg.AccountsURL)
	log.Printf("[Server] Callback URL: %s/auth/callback", cfg.AppURL)

	if err := app.Listen(addr); err != nil {
		log.Fatalf("[Server] Failed to start: %v", err)
	}
}
