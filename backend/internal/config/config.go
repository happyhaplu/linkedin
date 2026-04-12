package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds all application settings, populated from environment variables.
type Config struct {
	// Server
	Port string

	// PostgreSQL
	DatabaseURL string

	// External Accounts service (accounts.gour.io)
	AccountsURL    string // Public URL for browser redirects
	AccountsAPIURL string // Server-to-server URL (may differ in Docker/k8s)

	// Product API key for authenticating with Accounts service
	AccountsAPIKey string

	// Stripe billing
	StripeSecretKey      string
	StripePublishableKey string
	StripeWebhookSecret  string
	StripeProductID      string

	// Admin credentials (set via env — not stored in DB)
	AdminEmail    string
	AdminPassword string

	// This app's own public URL
	AppURL string

	// Frontend (Vue) URL — callback redirects go here
	FrontendURL string

	// Session
	SessionCookie  string
	SessionMaxAge  time.Duration
	CookieSecure   bool
	CookieSameSite string

	// Redis (for BullMQ workers — not used in auth, kept for completeness)
	RedisURL string
}

// Load reads config from the environment.
// Call godotenv.Load() before this if you want .env support.
func Load() *Config {
	secure, _ := strconv.ParseBool(getEnv("COOKIE_SECURE", "false"))
	maxAgeSec, _ := strconv.Atoi(getEnv("SESSION_MAX_AGE", "2592000")) // 30 days

	accountsURL := getEnv("ACCOUNTS_URL", "https://accounts.gour.io")
	return &Config{
		Port: getEnv("PORT", "4000"),

		DatabaseURL: getEnv("DATABASE_URL", "postgresql://reach:reach@localhost:5432/reach"),

		AccountsURL:    accountsURL,
		AccountsAPIURL: getEnv("ACCOUNTS_API_URL", accountsURL),
		AccountsAPIKey: getEnv("ACCOUNTS_API_KEY", ""),

		StripeSecretKey:      getEnv("STRIPE_SECRET_KEY", ""),
		StripePublishableKey: getEnv("STRIPE_PUBLISHABLE_KEY", ""),
		StripeWebhookSecret:  getEnv("STRIPE_WEBHOOK_SECRET", ""),
		StripeProductID:      getEnv("STRIPE_PRODUCT_ID", "prod_UJmmEKdiI6m3c8"),

		AdminEmail:    getEnv("ADMIN_EMAIL", ""),
		AdminPassword: getEnv("ADMIN_PASSWORD", ""),

		AppURL: getEnv("APP_URL", "http://localhost:4000"),

		FrontendURL: getEnv("FRONTEND_URL", "http://localhost:3000"),

		SessionCookie:  getEnv("SESSION_COOKIE", "reach-session"),
		SessionMaxAge:  time.Duration(maxAgeSec) * time.Second,
		CookieSecure:   secure,
		CookieSameSite: getEnv("COOKIE_SAMESITE", "Lax"),

		RedisURL: getEnv("REDIS_URL", "redis://localhost:6379"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
