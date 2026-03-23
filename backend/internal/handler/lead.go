package handler

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"github.com/reach/backend/internal/service"
)

// LeadHandler handles all lead-management HTTP endpoints (leads, lists, custom fields).
type LeadHandler struct {
	svc *service.LeadService
}

func NewLeadHandler(svc *service.LeadService) *LeadHandler {
	return &LeadHandler{svc: svc}
}

// ═══════════════════════════════════════════════════════════════════════════════
// LISTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/lists
func (h *LeadHandler) ListLists() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		lists, err := h.svc.GetLists(userID)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(lists)
	}
}

// GET /api/lists/:id
func (h *LeadHandler) GetList() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid list ID")
		}
		list, err := h.svc.GetListByID(id, userID)
		if err != nil {
			return fiber.NewError(fiber.StatusNotFound, "List not found")
		}
		return c.JSON(list)
	}
}

// POST /api/lists
func (h *LeadHandler) CreateList() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		var req models.CreateListRequest
		if err := c.BodyParser(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
		}
		if req.Name == "" {
			return fiber.NewError(fiber.StatusBadRequest, "Name is required")
		}
		list, err := h.svc.CreateList(userID, req)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.Status(fiber.StatusCreated).JSON(list)
	}
}

// PUT /api/lists/:id
func (h *LeadHandler) UpdateList() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid list ID")
		}
		var req models.UpdateListRequest
		if err := c.BodyParser(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
		}
		list, err := h.svc.UpdateList(id, userID, req)
		if err != nil {
			return fiber.NewError(fiber.StatusNotFound, "List not found")
		}
		return c.JSON(list)
	}
}

// DELETE /api/lists/:id
func (h *LeadHandler) DeleteList() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid list ID")
		}
		if err := h.svc.DeleteList(id, userID); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.SendStatus(fiber.StatusNoContent)
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEADS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/leads
func (h *LeadHandler) ListLeads() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		var filter models.GetLeadsFilter
		if err := c.QueryParser(&filter); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid query parameters")
		}
		leads, err := h.svc.GetLeads(userID, filter)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(leads)
	}
}

// GET /api/leads/:id
func (h *LeadHandler) GetLead() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid lead ID")
		}
		lead, err := h.svc.GetLeadByID(id, userID)
		if err != nil {
			return fiber.NewError(fiber.StatusNotFound, "Lead not found")
		}
		return c.JSON(lead)
	}
}

// POST /api/leads/import
func (h *LeadHandler) ImportLeads() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		var req models.ImportLeadsRequest
		if err := c.BodyParser(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
		}
		if req.ListID == "" {
			return fiber.NewError(fiber.StatusBadRequest, "list_id is required")
		}
		if len(req.Leads) == 0 {
			return fiber.NewError(fiber.StatusBadRequest, "At least one lead is required")
		}
		leads, err := h.svc.ImportLeadsFromCSV(userID, req)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.Status(fiber.StatusCreated).JSON(leads)
	}
}

// PUT /api/leads/:id
func (h *LeadHandler) UpdateLead() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid lead ID")
		}
		var req models.UpdateLeadRequest
		if err := c.BodyParser(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
		}
		lead, err := h.svc.UpdateLead(id, userID, req)
		if err != nil {
			return fiber.NewError(fiber.StatusNotFound, "Lead not found")
		}
		return c.JSON(lead)
	}
}

// DELETE /api/leads/:id
func (h *LeadHandler) DeleteLead() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid lead ID")
		}
		if err := h.svc.DeleteLead(id, userID); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.SendStatus(fiber.StatusNoContent)
	}
}

// POST /api/leads/bulk-status
func (h *LeadHandler) BulkUpdateStatus() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		var req models.BulkStatusRequest
		if err := c.BodyParser(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
		}
		if len(req.LeadIDs) == 0 {
			return fiber.NewError(fiber.StatusBadRequest, "lead_ids is required")
		}
		if err := h.svc.BulkUpdateStatus(userID, req); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(fiber.Map{"success": true})
	}
}

// POST /api/leads/bulk-delete
func (h *LeadHandler) BulkDeleteLeads() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		var req models.BulkDeleteRequest
		if err := c.BodyParser(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
		}
		if len(req.LeadIDs) == 0 {
			return fiber.NewError(fiber.StatusBadRequest, "lead_ids is required")
		}
		if err := h.svc.BulkDeleteLeads(userID, req); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(fiber.Map{"success": true})
	}
}

// POST /api/leads/add-from-connection
func (h *LeadHandler) AddFromConnection() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		var req models.AddFromConnectionRequest
		if err := c.BodyParser(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
		}
		if req.FullName == "" {
			return fiber.NewError(fiber.StatusBadRequest, "Name is required")
		}
		lead, err := h.svc.AddFromConnection(userID, req)
		if err != nil {
			var dupErr *service.DuplicateLeadError
			if errors.As(err, &dupErr) {
				return c.Status(fiber.StatusConflict).JSON(fiber.Map{
					"error":    dupErr.Error(),
					"message":  "Already exists",
					"existing": true,
				})
			}
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.Status(fiber.StatusCreated).JSON(fiber.Map{
			"success": true,
			"lead":    lead,
			"message": "Successfully added to leads",
		})
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM FIELDS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/custom-fields
func (h *LeadHandler) ListCustomFields() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		fields, err := h.svc.GetCustomFields(userID)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(fields)
	}
}

// POST /api/custom-fields
func (h *LeadHandler) CreateCustomField() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		var req models.CreateCustomFieldRequest
		if err := c.BodyParser(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
		}
		if req.Name == "" {
			return fiber.NewError(fiber.StatusBadRequest, "Name is required")
		}
		if req.FieldType == "" {
			return fiber.NewError(fiber.StatusBadRequest, "field_type is required")
		}
		field, err := h.svc.CreateCustomField(userID, req)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.Status(fiber.StatusCreated).JSON(field)
	}
}

// PUT /api/custom-fields/:id
func (h *LeadHandler) UpdateCustomField() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid custom field ID")
		}
		var req models.UpdateCustomFieldRequest
		if err := c.BodyParser(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
		}
		field, err := h.svc.UpdateCustomField(id, userID, req)
		if err != nil {
			return fiber.NewError(fiber.StatusNotFound, "Custom field not found")
		}
		return c.JSON(field)
	}
}

// DELETE /api/custom-fields/:id
func (h *LeadHandler) DeleteCustomField() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid custom field ID")
		}
		if err := h.svc.DeleteCustomField(id, userID); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.SendStatus(fiber.StatusNoContent)
	}
}
