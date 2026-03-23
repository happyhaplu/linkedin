package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"github.com/reach/backend/internal/service"
)

// NetworkHandler handles all My Network HTTP endpoints.
type NetworkHandler struct {
	svc *service.NetworkService
}

func NewNetworkHandler(svc *service.NetworkService) *NetworkHandler {
	return &NetworkHandler{svc: svc}
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/network/connections
func (h *NetworkHandler) ListConnections() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		var f models.GetConnectionsFilter
		if err := c.QueryParser(&f); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid query parameters")
		}
		conns, err := h.svc.GetConnections(userID, f)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(conns)
	}
}

// GET /api/network/connections/stats
func (h *NetworkHandler) GetConnectionStats() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		stats, err := h.svc.GetConnectionStats(userID)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(stats)
	}
}

// GET /api/network/connections/:id
func (h *NetworkHandler) GetConnection() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid connection ID")
		}
		conn, err := h.svc.GetConnectionByID(id, userID)
		if err != nil {
			return fiber.NewError(fiber.StatusNotFound, "Connection not found")
		}
		return c.JSON(conn)
	}
}

// POST /api/network/connections
func (h *NetworkHandler) CreateConnection() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		var req models.CreateConnectionRequest
		if err := c.BodyParser(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
		}
		if req.LinkedInAccountID == "" {
			return fiber.NewError(fiber.StatusBadRequest, "linkedin_account_id is required")
		}
		conn, err := h.svc.CreateConnection(userID, req)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.Status(fiber.StatusCreated).JSON(conn)
	}
}

// PUT /api/network/connections/:id
func (h *NetworkHandler) UpdateConnection() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid connection ID")
		}
		var dto models.UpdateConnectionDTO
		if err := c.BodyParser(&dto); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
		}
		conn, err := h.svc.UpdateConnection(id, userID, dto)
		if err != nil {
			return fiber.NewError(fiber.StatusNotFound, "Connection not found")
		}
		return c.JSON(conn)
	}
}

// DELETE /api/network/connections/:id
func (h *NetworkHandler) DeleteConnection() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid connection ID")
		}
		if err := h.svc.DeleteConnection(id, userID); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.SendStatus(fiber.StatusNoContent)
	}
}

// POST /api/network/connections/:id/favorite
func (h *NetworkHandler) ToggleFavorite() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid connection ID")
		}
		var req models.ToggleFavoriteRequest
		if err := c.BodyParser(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
		}
		conn, err := h.svc.ToggleFavorite(id, userID, req.IsFavorite)
		if err != nil {
			return fiber.NewError(fiber.StatusNotFound, "Connection not found")
		}
		return c.JSON(conn)
	}
}

// POST /api/network/connections/bulk-delete
func (h *NetworkHandler) BulkDeleteConnections() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		var req models.BulkConnectionIDsRequest
		if err := c.BodyParser(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
		}
		if len(req.ConnectionIDs) == 0 {
			return fiber.NewError(fiber.StatusBadRequest, "connection_ids is required")
		}
		if err := h.svc.BulkDeleteConnections(userID, req); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(fiber.Map{"success": true})
	}
}

// POST /api/network/connections/bulk-tags
func (h *NetworkHandler) BulkUpdateTags() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		var req models.BulkUpdateTagsRequest
		if err := c.BodyParser(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
		}
		if len(req.ConnectionIDs) == 0 {
			return fiber.NewError(fiber.StatusBadRequest, "connection_ids is required")
		}
		if err := h.svc.BulkUpdateConnectionTags(userID, req); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(fiber.Map{"success": true})
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTION REQUESTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/network/requests
func (h *NetworkHandler) ListRequests() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		var f models.GetConnectionRequestsFilter
		if err := c.QueryParser(&f); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid query parameters")
		}
		reqs, err := h.svc.GetConnectionRequests(userID, f)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(reqs)
	}
}

// POST /api/network/requests
func (h *NetworkHandler) CreateRequest() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		var dto models.CreateConnReqDTO
		if err := c.BodyParser(&dto); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
		}
		if dto.LinkedInAccountID == "" {
			return fiber.NewError(fiber.StatusBadRequest, "linkedin_account_id is required")
		}
		if dto.TargetLinkedInURL == "" {
			return fiber.NewError(fiber.StatusBadRequest, "target_linkedin_url is required")
		}
		req, err := h.svc.CreateConnectionReq(userID, dto)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.Status(fiber.StatusCreated).JSON(req)
	}
}

// PUT /api/network/requests/:id
func (h *NetworkHandler) UpdateRequest() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request ID")
		}
		var dto models.UpdateConnReqDTO
		if err := c.BodyParser(&dto); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
		}
		req, err := h.svc.UpdateConnectionReq(id, userID, dto)
		if err != nil {
			return fiber.NewError(fiber.StatusNotFound, "Connection request not found")
		}
		return c.JSON(req)
	}
}

// POST /api/network/requests/:id/accept
func (h *NetworkHandler) AcceptRequest() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request ID")
		}
		req, err := h.svc.AcceptConnectionRequest(id, userID)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(req)
	}
}

// POST /api/network/requests/:id/withdraw
func (h *NetworkHandler) WithdrawRequest() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request ID")
		}
		req, err := h.svc.WithdrawConnectionRequest(id, userID)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(req)
	}
}

// DELETE /api/network/requests/:id
func (h *NetworkHandler) DeleteRequest() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request ID")
		}
		if err := h.svc.DeleteConnectionRequest(id, userID); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.SendStatus(fiber.StatusNoContent)
	}
}

// POST /api/network/requests/bulk-withdraw
func (h *NetworkHandler) BulkWithdrawRequests() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		var req models.BulkRequestIDsRequest
		if err := c.BodyParser(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
		}
		if len(req.RequestIDs) == 0 {
			return fiber.NewError(fiber.StatusBadRequest, "request_ids is required")
		}
		if err := h.svc.BulkWithdrawRequests(userID, req); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(fiber.Map{"success": true})
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/network/sync
func (h *NetworkHandler) StartSync() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		var req models.StartSyncRequest
		if err := c.BodyParser(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
		}
		if req.LinkedInAccountID == "" {
			return fiber.NewError(fiber.StatusBadRequest, "linkedin_account_id is required")
		}
		result, err := h.svc.SyncNetworkFromLinkedIn(userID, req)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(result)
	}
}

// GET /api/network/sync/logs
func (h *NetworkHandler) GetSyncLogs() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		accountID := c.Query("linkedin_account_id")
		logs, err := h.svc.GetSyncLogs(userID, accountID)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(logs)
	}
}

// GET /api/network/sync/latest
func (h *NetworkHandler) GetLatestSyncLog() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		accountID := c.Query("linkedin_account_id")
		if accountID == "" {
			return fiber.NewError(fiber.StatusBadRequest, "linkedin_account_id is required")
		}
		log, err := h.svc.GetLatestSyncLog(userID, accountID)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		if log == nil {
			return c.JSON(nil)
		}
		return c.JSON(log)
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/network/analytics
func (h *NetworkHandler) GetAnalytics() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		accountID := c.Query("linkedin_account_id")
		analytics, err := h.svc.GetNetworkAnalytics(userID, accountID)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(analytics)
	}
}
