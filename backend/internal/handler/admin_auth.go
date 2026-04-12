package handler

import (
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/reach/backend/internal/config"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

const adminCookie = "reach-admin-session"

// AdminLoginHandler handles POST /admin/login
func AdminLoginHandler(cfg *config.Config, db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}

		if body.Email != cfg.AdminEmail || body.Password != cfg.AdminPassword {
			return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
		}

		session := models.AdminSession{
			Email:     body.Email,
			CreatedAt: time.Now(),
			ExpiresAt: time.Now().Add(24 * time.Hour),
		}
		if err := db.Create(&session).Error; err != nil {
			log.Printf("[Admin] Failed to create session: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Internal error"})
		}

		c.Cookie(&fiber.Cookie{
			Name:     adminCookie,
			Value:    session.ID,
			Path:     "/",
			MaxAge:   86400,
			HTTPOnly: true,
			Secure:   cfg.CookieSecure,
			SameSite: cfg.CookieSameSite,
		})

		return c.JSON(fiber.Map{"ok": true, "email": body.Email})
	}
}

// AdminLogoutHandler handles POST /admin/logout
func AdminLogoutHandler(cfg *config.Config, db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		sessionID := c.Cookies(adminCookie)
		if sessionID != "" {
			db.Where("id = ?", sessionID).Delete(&models.AdminSession{})
		}
		c.Cookie(&fiber.Cookie{
			Name:    adminCookie,
			Value:   "",
			Path:    "/",
			MaxAge:  -1,
			Expires: time.Now().Add(-1 * time.Hour),
		})
		return c.JSON(fiber.Map{"ok": true})
	}
}

// AdminMeHandler handles GET /admin/me
func AdminMeHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		email := c.Locals("admin_email")
		return c.JSON(fiber.Map{"email": email, "role": "admin"})
	}
}
