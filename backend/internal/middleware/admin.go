package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

const adminCookieName = "reach-admin-session"

// RequireAdmin checks the admin session cookie, looks it up in DB.
func RequireAdmin(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		sessionID := c.Cookies(adminCookieName)
		if sessionID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Admin authentication required"})
		}

		var session models.AdminSession
		if err := db.Where("id = ?", sessionID).First(&session).Error; err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid admin session"})
		}

		if session.IsExpired() {
			db.Delete(&session)
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Admin session expired"})
		}

		c.Locals("admin_email", session.Email)
		return c.Next()
	}
}
