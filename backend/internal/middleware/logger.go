package middleware

import (
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
)

// Logger is a simple request-logging middleware.
func Logger() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		err := c.Next()
		log.Printf("[HTTP] %s %s %d %s",
			c.Method(), c.Path(), c.Response().StatusCode(), time.Since(start))
		return err
	}
}
