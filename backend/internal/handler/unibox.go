package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"github.com/reach/backend/internal/service"
)

// UniboxHandler handles all Unibox (Unified Inbox) HTTP endpoints.
type UniboxHandler struct {
	svc *service.UniboxService
}

func NewUniboxHandler(svc *service.UniboxService) *UniboxHandler {
	return &UniboxHandler{svc: svc}
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSATIONS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/unibox/conversations
func (h *UniboxHandler) ListConversations() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		var f models.GetConversationsFilter
		if err := c.QueryParser(&f); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid query parameters")
		}
		convs, err := h.svc.GetConversations(userID, f)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(convs)
	}
}

// GET /api/unibox/conversations/:id/messages
func (h *UniboxHandler) GetMessages() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid conversation ID")
		}
		msgs, err := h.svc.GetConversationMessages(id)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(msgs)
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEND MESSAGE
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/unibox/messages
func (h *UniboxHandler) SendMessage() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		var req models.SendMessageRequest
		if err := c.BodyParser(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
		}
		if req.ConversationID == "" || req.LinkedInAccountID == "" || req.Content == "" {
			return fiber.NewError(fiber.StatusBadRequest, "conversation_id, linkedin_account_id, and content are required")
		}
		msg, err := h.svc.SendMessage(userID, req)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.Status(fiber.StatusCreated).JSON(msg)
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARK AS READ
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/unibox/conversations/:id/read
func (h *UniboxHandler) MarkAsRead() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid conversation ID")
		}
		if err := h.svc.MarkConversationAsRead(id); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(fiber.Map{"success": true})
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARCHIVE / LABEL
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/unibox/conversations/:id/archive
func (h *UniboxHandler) ArchiveConversation() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid conversation ID")
		}
		var req models.ArchiveConversationRequest
		if err := c.BodyParser(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
		}
		archive := true
		if req.Archive != nil {
			archive = *req.Archive
		}
		if err := h.svc.ArchiveConversation(id, archive); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(fiber.Map{"success": true})
	}
}

// PUT /api/unibox/conversations/:id/label
func (h *UniboxHandler) SetLabel() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid conversation ID")
		}
		var req models.SetLabelRequest
		if err := c.BodyParser(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
		}
		if err := h.svc.SetConversationLabel(id, req.Label); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(fiber.Map{"success": true})
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/unibox/sync
func (h *UniboxHandler) TriggerSync() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		resp, err := h.svc.TriggerSync(userID)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(resp)
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// LINKEDIN ACCOUNTS (for the account picker)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/unibox/accounts
func (h *UniboxHandler) GetLinkedInAccounts() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		accounts, err := h.svc.GetLinkedInAccounts(userID)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(accounts)
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAMPAIGN CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/unibox/campaign-context
func (h *UniboxHandler) GetCampaignContext() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}
		participantName := c.Query("participant_name")
		linkedinAccountID := c.Query("linkedin_account_id")
		if participantName == "" {
			return c.JSON(nil)
		}
		ctx, err := h.svc.GetCampaignContext(participantName, linkedinAccountID)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(ctx)
	}
}
