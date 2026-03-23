package handler

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/reach/backend/internal/service"
)

// ProxyHandler handles all proxy management API endpoints.
type ProxyHandler struct {
	svc *service.ProxyService
}

// NewProxyHandler creates a new handler.
func NewProxyHandler(svc *service.ProxyService) *ProxyHandler {
	return &ProxyHandler{svc: svc}
}

// ── GET /api/proxies ────────────────────────────────────────────────────────

// ListProxies returns all proxies for the authenticated user.
func (h *ProxyHandler) ListProxies() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		proxies, err := h.svc.GetAll(userID)
		if err != nil {
			log.Printf("[Proxies] List error: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to fetch proxies",
			})
		}

		return c.JSON(proxies)
	}
}

// ── GET /api/proxies/:id ────────────────────────────────────────────────────

// GetProxy returns a single proxy by ID.
func (h *ProxyHandler) GetProxy() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		proxyID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid proxy ID",
			})
		}

		proxy, svcErr := h.svc.GetByID(proxyID, userID)
		if svcErr != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "Proxy not found",
			})
		}

		return c.JSON(proxy)
	}
}

// ── POST /api/proxies ───────────────────────────────────────────────────────

// CreateProxy creates a new proxy.
func (h *ProxyHandler) CreateProxy() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		var req service.CreateProxyRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		// Validation
		if req.Name == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Name is required",
			})
		}
		if req.Host == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Host is required",
			})
		}
		if req.Port < 1 || req.Port > 65535 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Port must be between 1 and 65535",
			})
		}
		validTypes := map[string]bool{"http": true, "https": true, "socks4": true, "socks5": true}
		if !validTypes[req.Type] {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Type must be one of: http, https, socks4, socks5",
			})
		}

		proxy, svcErr := h.svc.Create(userID, req)
		if svcErr != nil {
			log.Printf("[Proxies] Create error: %v", svcErr)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.Status(fiber.StatusCreated).JSON(proxy)
	}
}

// ── PUT /api/proxies/:id ────────────────────────────────────────────────────

// UpdateProxy updates an existing proxy.
func (h *ProxyHandler) UpdateProxy() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		proxyID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid proxy ID",
			})
		}

		var req service.UpdateProxyRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		proxy, svcErr := h.svc.Update(proxyID, userID, req)
		if svcErr != nil {
			log.Printf("[Proxies] Update error: %v", svcErr)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.JSON(proxy)
	}
}

// ── DELETE /api/proxies/:id ─────────────────────────────────────────────────

// DeleteProxy deletes a proxy.
func (h *ProxyHandler) DeleteProxy() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		proxyID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid proxy ID",
			})
		}

		if svcErr := h.svc.Delete(proxyID, userID); svcErr != nil {
			log.Printf("[Proxies] Delete error: %v", svcErr)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to delete proxy",
			})
		}

		return c.JSON(fiber.Map{"success": true})
	}
}

// ── POST /api/proxies/:id/test ──────────────────────────────────────────────

// TestProxy tests a proxy connection.
func (h *ProxyHandler) TestProxy() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		proxyID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid proxy ID",
			})
		}

		proxy, svcErr := h.svc.TestProxy(proxyID, userID)
		if svcErr != nil {
			// Return the proxy data even on failure (with updated test_status)
			if proxy != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": svcErr.Error(),
					"proxy": proxy,
				})
			}
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.JSON(fiber.Map{
			"success": true,
			"proxy":   proxy,
		})
	}
}
