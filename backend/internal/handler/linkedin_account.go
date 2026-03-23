package handler

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/reach/backend/internal/middleware"
	"github.com/reach/backend/internal/service"
)

// LinkedInAccountHandler handles all LinkedIn account API endpoints.
type LinkedInAccountHandler struct {
	svc *service.LinkedInAccountService
}

// NewLinkedInAccountHandler creates a new handler.
func NewLinkedInAccountHandler(svc *service.LinkedInAccountService) *LinkedInAccountHandler {
	return &LinkedInAccountHandler{svc: svc}
}

// getUserID extracts the authenticated user's UUID from Fiber locals.
func getUserID(c *fiber.Ctx) (uuid.UUID, error) {
	rawID := c.Locals(middleware.LocalsUserID)
	if rawID == nil {
		return uuid.Nil, fiber.NewError(fiber.StatusUnauthorized, "Not authenticated")
	}
	idStr, ok := rawID.(string)
	if !ok {
		return uuid.Nil, fiber.NewError(fiber.StatusUnauthorized, "Invalid user context")
	}
	id, err := uuid.Parse(idStr)
	if err != nil {
		return uuid.Nil, fiber.NewError(fiber.StatusUnauthorized, "Invalid user ID")
	}
	return id, nil
}

// ── GET /api/linkedin-accounts ──────────────────────────────────────────────

// ListAccounts returns all LinkedIn accounts for the authenticated user.
func (h *LinkedInAccountHandler) ListAccounts() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		accounts, err := h.svc.GetAll(userID)
		if err != nil {
			log.Printf("[Accounts] List error: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to fetch accounts",
			})
		}

		return c.JSON(accounts)
	}
}

// ── GET /api/linkedin-accounts/:id ──────────────────────────────────────────

// GetAccount returns a single LinkedIn account by ID.
func (h *LinkedInAccountHandler) GetAccount() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		accountID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid account ID",
			})
		}

		account, svcErr := h.svc.GetByID(accountID, userID)
		if svcErr != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.JSON(account)
	}
}

// ── POST /api/linkedin-accounts/cookie ──────────────────────────────────────

// CreateWithCookie creates a LinkedIn account using an imported session cookie.
func (h *LinkedInAccountHandler) CreateWithCookie() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		var req service.CreateAccountWithCookieRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		account, svcErr := h.svc.CreateWithCookie(userID, req)
		if svcErr != nil {
			log.Printf("[Accounts] Create with cookie error: %v", svcErr)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.Status(fiber.StatusCreated).JSON(account)
	}
}

// ── POST /api/linkedin-accounts/:id/reconnect ──────────────────────────────

// Reconnect reconnects a disconnected LinkedIn account with fresh cookies.
func (h *LinkedInAccountHandler) Reconnect() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		accountID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid account ID",
			})
		}

		var req service.ReconnectAccountRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		account, svcErr := h.svc.Reconnect(accountID, userID, req)
		if svcErr != nil {
			log.Printf("[Accounts] Reconnect error: %v", svcErr)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.JSON(account)
	}
}

// ── DELETE /api/linkedin-accounts/:id ───────────────────────────────────────

// DeleteAccount deletes a LinkedIn account.
func (h *LinkedInAccountHandler) DeleteAccount() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		accountID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid account ID",
			})
		}

		if svcErr := h.svc.Delete(accountID, userID); svcErr != nil {
			log.Printf("[Accounts] Delete error: %v", svcErr)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to delete account",
			})
		}

		return c.JSON(fiber.Map{"success": true})
	}
}

// ── POST /api/linkedin-accounts/:id/toggle-status ──────────────────────────

// ToggleStatus toggles account status between active and paused.
func (h *LinkedInAccountHandler) ToggleStatus() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		accountID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid account ID",
			})
		}

		account, svcErr := h.svc.ToggleStatus(accountID, userID)
		if svcErr != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.JSON(account)
	}
}

// ── PUT /api/linkedin-accounts/:id/limits ───────────────────────────────────

// UpdateLimits updates the daily sending limits for an account.
func (h *LinkedInAccountHandler) UpdateLimits() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		accountID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid account ID",
			})
		}

		var req service.UpdateLimitsRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		account, svcErr := h.svc.UpdateLimits(accountID, userID, req)
		if svcErr != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.JSON(account)
	}
}

// ── PUT /api/linkedin-accounts/:id/proxy ────────────────────────────────────

// UpdateProxy assigns or removes a proxy from an account.
func (h *LinkedInAccountHandler) UpdateProxy() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		accountID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid account ID",
			})
		}

		var req service.UpdateAccountProxyRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		account, svcErr := h.svc.UpdateProxy(accountID, userID, req.ProxyID)
		if svcErr != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.JSON(account)
	}
}

// ── PUT /api/linkedin-accounts/:id/campaigns ────────────────────────────────

// AssignCampaigns assigns campaigns to a LinkedIn account.
func (h *LinkedInAccountHandler) AssignCampaigns() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		accountID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid account ID",
			})
		}

		var req service.AssignCampaignsRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		account, svcErr := h.svc.AssignCampaigns(accountID, userID, req.CampaignIDs)
		if svcErr != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.JSON(account)
	}
}

// ── POST /api/linkedin-accounts/:id/verify-otp ─────────────────────────────

// VerifyOTP verifies an OTP code for a connecting account.
func (h *LinkedInAccountHandler) VerifyOTP() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		accountID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid account ID",
			})
		}

		var req service.VerifyOTPRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		account, svcErr := h.svc.VerifyOTP(accountID, userID, req.OTP)
		if svcErr != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.JSON(account)
	}
}

// ── POST /api/linkedin-accounts/:id/check-connection ────────────────────────

// CheckConnection validates the session for a specific account.
func (h *LinkedInAccountHandler) CheckConnection() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		accountID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid account ID",
			})
		}

		result, svcErr := h.svc.CheckConnection(accountID, userID)
		if svcErr != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.JSON(result)
	}
}

// ── POST /api/linkedin-accounts/monitor-health ──────────────────────────────

// MonitorHealth monitors health for one or all accounts.
func (h *LinkedInAccountHandler) MonitorHealth() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		// Optional account_id in query or body
		var accountID *uuid.UUID
		if idStr := c.Query("account_id"); idStr != "" {
			parsed, parseErr := uuid.Parse(idStr)
			if parseErr == nil {
				accountID = &parsed
			}
		}
		// Also check request body
		if accountID == nil {
			var body struct {
				AccountID string `json:"account_id"`
			}
			if err := c.BodyParser(&body); err == nil && body.AccountID != "" {
				parsed, parseErr := uuid.Parse(body.AccountID)
				if parseErr == nil {
					accountID = &parsed
				}
			}
		}

		monitored, svcErr := h.svc.MonitorHealth(userID, accountID)
		if svcErr != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.JSON(fiber.Map{
			"monitored": monitored,
		})
	}
}

// ── GET /api/linkedin-accounts/:id/health-history ───────────────────────────

// GetHealthHistory returns the health check history for an account.
func (h *LinkedInAccountHandler) GetHealthHistory() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		accountID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid account ID",
			})
		}

		logs, svcErr := h.svc.GetHealthHistory(accountID, userID)
		if svcErr != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.JSON(logs)
	}
}

// ── PUT /api/linkedin-accounts/:id/profile ──────────────────────────────────

// UpdateProfile updates the profile data for an account (manual resync).
func (h *LinkedInAccountHandler) UpdateProfile() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		accountID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid account ID",
			})
		}

		var profileData map[string]interface{}
		if err := c.BodyParser(&profileData); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		if svcErr := h.svc.UpdateProfile(accountID, userID, profileData); svcErr != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		// Return the updated account
		account, _ := h.svc.GetByID(accountID, userID)
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Profile data updated successfully",
			"data":    account,
		})
	}
}
