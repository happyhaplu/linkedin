package handler

import (
	"log"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"github.com/reach/backend/internal/service"
)

// CampaignHandler handles all campaign-related HTTP endpoints.
type CampaignHandler struct {
	campaignSvc *service.CampaignService
	executorSvc *service.CampaignExecutorService
}

// NewCampaignHandler creates a new handler.
func NewCampaignHandler(
	campaignSvc *service.CampaignService,
	executorSvc *service.CampaignExecutorService,
) *CampaignHandler {
	return &CampaignHandler{
		campaignSvc: campaignSvc,
		executorSvc: executorSvc,
	}
}

// ─── helper ─────────────────────────────────────────────────────────────────

func parseCampaignID(c *fiber.Ctx) (uuid.UUID, error) {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return uuid.Nil, c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid campaign ID",
		})
	}
	return id, nil
}

// ═══════════════════════════════════════════════════════════════════════════
// CAMPAIGN CRUD
// ═══════════════════════════════════════════════════════════════════════════

// ── GET /api/campaigns ──────────────────────────────────────────────────────

func (h *CampaignHandler) ListCampaigns() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		status := c.Query("status")
		search := c.Query("search")

		var statusPtr, searchPtr *string
		if status != "" {
			statusPtr = &status
		}
		if search != "" {
			searchPtr = &search
		}

		campaigns, err := h.campaignSvc.GetCampaigns(userID, statusPtr, searchPtr)
		if err != nil {
			log.Printf("[Campaigns] List error: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to fetch campaigns",
			})
		}

		return c.JSON(campaigns)
	}
}

// ── GET /api/campaigns/:id ──────────────────────────────────────────────────

func (h *CampaignHandler) GetCampaign() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil // response already sent
		}

		campaign, svcErr := h.campaignSvc.GetCampaignByID(campaignID, userID)
		if svcErr != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "Campaign not found",
			})
		}

		return c.JSON(campaign)
	}
}

// ── POST /api/campaigns ─────────────────────────────────────────────────────

func (h *CampaignHandler) CreateCampaign() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		var input models.CreateCampaignInput
		if err := c.BodyParser(&input); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		if input.Name == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Campaign name is required",
			})
		}

		campaign, svcErr := h.campaignSvc.CreateCampaign(userID, input)
		if svcErr != nil {
			log.Printf("[Campaigns] Create error: %v", svcErr)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.Status(fiber.StatusCreated).JSON(campaign)
	}
}

// ── PUT /api/campaigns/:id ──────────────────────────────────────────────────

func (h *CampaignHandler) UpdateCampaign() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		var input models.UpdateCampaignInput
		if err := c.BodyParser(&input); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		campaign, svcErr := h.campaignSvc.UpdateCampaign(campaignID, userID, input)
		if svcErr != nil {
			log.Printf("[Campaigns] Update error: %v", svcErr)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.JSON(campaign)
	}
}

// ── DELETE /api/campaigns/:id ───────────────────────────────────────────────

func (h *CampaignHandler) DeleteCampaign() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		if svcErr := h.campaignSvc.DeleteCampaign(campaignID, userID); svcErr != nil {
			log.Printf("[Campaigns] Delete error: %v", svcErr)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to delete campaign",
			})
		}

		return c.JSON(fiber.Map{"success": true})
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// CAMPAIGN LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════

// ── POST /api/campaigns/:id/start ───────────────────────────────────────────

func (h *CampaignHandler) StartCampaign() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		var body struct {
			LaunchImmediately bool `json:"launch_immediately"`
		}
		_ = c.BodyParser(&body) // optional

		result := h.executorSvc.StartCampaign(campaignID, body.LaunchImmediately)
		if !result.Success {
			return c.Status(fiber.StatusBadRequest).JSON(result)
		}

		return c.JSON(result)
	}
}

// ── POST /api/campaigns/:id/pause ───────────────────────────────────────────

func (h *CampaignHandler) PauseCampaign() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		result := h.executorSvc.PauseCampaign(campaignID)
		if !result.Success {
			return c.Status(fiber.StatusBadRequest).JSON(result)
		}

		return c.JSON(result)
	}
}

// ── POST /api/campaigns/:id/resume ──────────────────────────────────────────

func (h *CampaignHandler) ResumeCampaign() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		result := h.executorSvc.ResumeCampaign(campaignID)
		if !result.Success {
			return c.Status(fiber.StatusBadRequest).JSON(result)
		}

		return c.JSON(result)
	}
}

// ── POST /api/campaigns/:id/stop ────────────────────────────────────────────

func (h *CampaignHandler) StopCampaign() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		result := h.executorSvc.StopCampaign(campaignID)
		if !result.Success {
			return c.Status(fiber.StatusBadRequest).JSON(result)
		}

		return c.JSON(result)
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// SEQUENCES
// ═══════════════════════════════════════════════════════════════════════════

// ── GET /api/campaigns/:id/sequences ────────────────────────────────────────

func (h *CampaignHandler) GetSequences() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		seqs, svcErr := h.campaignSvc.GetCampaignSequences(campaignID)
		if svcErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to fetch sequences",
			})
		}

		return c.JSON(seqs)
	}
}

// ── PUT /api/campaigns/:id/sequences/:seqId ─────────────────────────────────

func (h *CampaignHandler) UpdateSequence() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}

		seqID, err := uuid.Parse(c.Params("seqId"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid sequence ID",
			})
		}

		var fields map[string]interface{}
		if err := c.BodyParser(&fields); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		seq, svcErr := h.campaignSvc.UpdateCampaignSequence(seqID, fields)
		if svcErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.JSON(seq)
	}
}

// ── POST /api/campaigns/:id/sequences/:seqId/ab-winner ─────────────────────

func (h *CampaignHandler) DeclareABWinner() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}

		seqID, err := uuid.Parse(c.Params("seqId"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid sequence ID",
			})
		}

		var body struct {
			Winner string `json:"winner"`
		}
		if err := c.BodyParser(&body); err != nil || (body.Winner != "A" && body.Winner != "B") {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Winner must be 'A' or 'B'",
			})
		}

		if svcErr := h.campaignSvc.DeclareABTestWinner(seqID, body.Winner); svcErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.JSON(fiber.Map{"success": true, "winner": body.Winner})
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// LEADS
// ═══════════════════════════════════════════════════════════════════════════

// ── GET /api/campaigns/:id/leads ────────────────────────────────────────────

func (h *CampaignHandler) GetLeads() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		status := c.Query("status")
		senderID := c.Query("sender_id")

		var statusPtr, senderPtr *string
		if status != "" {
			statusPtr = &status
		}
		if senderID != "" {
			senderPtr = &senderID
		}

		leads, svcErr := h.campaignSvc.GetCampaignLeads(campaignID, statusPtr, senderPtr)
		if svcErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to fetch leads",
			})
		}

		return c.JSON(leads)
	}
}

// ── POST /api/campaigns/:id/leads ───────────────────────────────────────────

func (h *CampaignHandler) AddLeads() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		var body struct {
			LeadIDs []string `json:"lead_ids"`
		}
		if err := c.BodyParser(&body); err != nil || len(body.LeadIDs) == 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "lead_ids is required",
			})
		}

		leads, svcErr := h.campaignSvc.AddLeadsToCampaign(campaignID, body.LeadIDs)
		if svcErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.Status(fiber.StatusCreated).JSON(fiber.Map{
			"added": len(leads),
			"leads": leads,
		})
	}
}

// ── POST /api/campaigns/:id/leads/from-list ─────────────────────────────────

func (h *CampaignHandler) AddLeadsFromList() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		var body struct {
			ListID string `json:"list_id"`
		}
		if err := c.BodyParser(&body); err != nil || body.ListID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "list_id is required",
			})
		}

		count, svcErr := h.campaignSvc.AddLeadsFromList(campaignID, body.ListID, userID)
		if svcErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.JSON(fiber.Map{"added": count})
	}
}

// ── DELETE /api/campaigns/:id/leads ─────────────────────────────────────────

func (h *CampaignHandler) RemoveLeads() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}

		var body struct {
			CampaignLeadIDs []string `json:"campaign_lead_ids"`
		}
		if err := c.BodyParser(&body); err != nil || len(body.CampaignLeadIDs) == 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "campaign_lead_ids is required",
			})
		}

		if svcErr := h.campaignSvc.RemoveLeadsFromCampaign(body.CampaignLeadIDs); svcErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to remove leads",
			})
		}

		return c.JSON(fiber.Map{"success": true})
	}
}

// ── GET /api/campaigns/:id/leads/stats ──────────────────────────────────────

func (h *CampaignHandler) GetLeadStats() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		stats, svcErr := h.campaignSvc.GetCampaignLeadStats(campaignID)
		if svcErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to fetch lead stats",
			})
		}

		return c.JSON(stats)
	}
}

// ── GET /api/campaigns/:id/export ───────────────────────────────────────────

func (h *CampaignHandler) ExportLeads() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		csv, svcErr := h.campaignSvc.ExportCampaignLeads(campaignID)
		if svcErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to export leads",
			})
		}

		c.Set("Content-Type", "text/csv")
		c.Set("Content-Disposition", "attachment; filename=campaign-leads.csv")
		return c.SendString(csv)
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// STATISTICS & ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

// ── GET /api/campaigns/stats ────────────────────────────────────────────────

func (h *CampaignHandler) GetStats() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		stats, svcErr := h.campaignSvc.GetCampaignStats(userID)
		if svcErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to fetch campaign stats",
			})
		}

		return c.JSON(stats)
	}
}

// ── GET /api/campaigns/:id/stats ────────────────────────────────────────────

func (h *CampaignHandler) GetCampaignDetailStats() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		performance, svcErr := h.campaignSvc.GetCampaignPerformance(campaignID, userID)
		if svcErr != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "Campaign not found",
			})
		}

		return c.JSON(performance)
	}
}

// ── GET /api/campaigns/:id/analytics ────────────────────────────────────────

func (h *CampaignHandler) GetAnalytics() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		analytics, svcErr := h.campaignSvc.GetCampaignAnalytics(campaignID)
		if svcErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to fetch analytics",
			})
		}

		return c.JSON(analytics)
	}
}

// ── GET /api/campaigns/:id/performance/sequences ────────────────────────────

func (h *CampaignHandler) GetSequencePerformance() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		seqs, svcErr := h.campaignSvc.GetSequencePerformance(campaignID)
		if svcErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to fetch sequence performance",
			})
		}

		return c.JSON(seqs)
	}
}

// ── GET /api/campaigns/:id/performance/senders ──────────────────────────────

func (h *CampaignHandler) GetSenderPerformance() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		senders, svcErr := h.campaignSvc.GetSenderPerformance(campaignID)
		if svcErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to fetch sender performance",
			})
		}

		return c.JSON(senders)
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTIVITY LOG
// ═══════════════════════════════════════════════════════════════════════════

// ── GET /api/campaigns/:id/activity ─────────────────────────────────────────

func (h *CampaignHandler) GetActivityLog() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		limit := 100
		if lStr := c.Query("limit"); lStr != "" {
			if l, err := strconv.Atoi(lStr); err == nil && l > 0 {
				limit = l
			}
		}

		logs, svcErr := h.campaignSvc.GetActivityLog(campaignID, limit)
		if svcErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to fetch activity log",
			})
		}

		return c.JSON(logs)
	}
}

// ── POST /api/campaigns/:id/activity ────────────────────────────────────────

func (h *CampaignHandler) LogActivity() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		var body struct {
			CampaignLeadID *string `json:"campaign_lead_id,omitempty"`
			ActivityType    string  `json:"activity_type"`
			ActivityStatus  string  `json:"activity_status"`
			MessageContent  *string `json:"message_content,omitempty"`
			ErrorMessage    *string `json:"error_message,omitempty"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		var campaignLeadID *uuid.UUID
		if body.CampaignLeadID != nil {
			parsed, err := uuid.Parse(*body.CampaignLeadID)
			if err == nil {
				campaignLeadID = &parsed
			}
		}

		if svcErr := h.campaignSvc.LogActivity(
			campaignID,
			campaignLeadID,
			models.ActivityType(body.ActivityType),
			models.ActivityStatus(body.ActivityStatus),
			body.MessageContent,
			body.ErrorMessage,
		); svcErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to log activity",
			})
		}

		return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true})
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// DUPLICATE
// ═══════════════════════════════════════════════════════════════════════════

// ── POST /api/campaigns/:id/duplicate ───────────────────────────────────────

func (h *CampaignHandler) DuplicateCampaign() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		copy, svcErr := h.campaignSvc.DuplicateCampaign(campaignID, userID)
		if svcErr != nil {
			log.Printf("[Campaigns] Duplicate error: %v", svcErr)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.Status(fiber.StatusCreated).JSON(copy)
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATES (static)
// ═══════════════════════════════════════════════════════════════════════════

// ── GET /api/campaigns/templates ────────────────────────────────────────────

func (h *CampaignHandler) GetTemplates() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}

		templates := h.campaignSvc.GetCampaignTemplates()
		return c.JSON(templates)
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// SENDERS
// ═══════════════════════════════════════════════════════════════════════════

// ── POST /api/campaigns/:id/senders ─────────────────────────────────────────

func (h *CampaignHandler) AddSender() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		var body struct {
			LinkedInAccountID string `json:"linkedin_account_id"`
		}
		if err := c.BodyParser(&body); err != nil || body.LinkedInAccountID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "linkedin_account_id is required",
			})
		}

		accountID, err := uuid.Parse(body.LinkedInAccountID)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid LinkedIn account ID",
			})
		}

		sender, svcErr := h.campaignSvc.AddCampaignSender(campaignID, accountID, userID)
		if svcErr != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.Status(fiber.StatusCreated).JSON(sender)
	}
}

// ── DELETE /api/campaigns/:id/senders/:senderId ─────────────────────────────

func (h *CampaignHandler) RemoveSender() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		senderID, err := uuid.Parse(c.Params("senderId"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid sender ID",
			})
		}

		if svcErr := h.campaignSvc.RemoveCampaignSender(campaignID, senderID, userID); svcErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.JSON(fiber.Map{"success": true})
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOKS
// ═══════════════════════════════════════════════════════════════════════════

// ── GET /api/campaigns/:id/webhooks ─────────────────────────────────────────

func (h *CampaignHandler) GetWebhooks() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		webhooks, svcErr := h.campaignSvc.GetCampaignWebhooks(campaignID, userID)
		if svcErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to fetch webhooks",
			})
		}

		return c.JSON(webhooks)
	}
}

// ── POST /api/campaigns/:id/webhooks ────────────────────────────────────────

func (h *CampaignHandler) CreateWebhook() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		var body struct {
			URL         string   `json:"url"`
			Secret      *string  `json:"secret,omitempty"`
			Description *string  `json:"description,omitempty"`
			Events      []string `json:"events"`
		}
		if err := c.BodyParser(&body); err != nil || body.URL == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "url is required",
			})
		}

		wh, svcErr := h.campaignSvc.CreateCampaignWebhook(
			campaignID, userID,
			body.URL, body.Secret, body.Description, body.Events,
		)
		if svcErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.Status(fiber.StatusCreated).JSON(wh)
	}
}

// ── PUT /api/campaigns/:id/webhooks/:webhookId ──────────────────────────────

func (h *CampaignHandler) UpdateWebhook() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		webhookID, err := uuid.Parse(c.Params("webhookId"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid webhook ID",
			})
		}

		var fields map[string]interface{}
		if err := c.BodyParser(&fields); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		if svcErr := h.campaignSvc.UpdateCampaignWebhook(webhookID, userID, fields); svcErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.JSON(fiber.Map{"success": true})
	}
}

// ── DELETE /api/campaigns/:id/webhooks/:webhookId ───────────────────────────

func (h *CampaignHandler) DeleteWebhook() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, err := getUserID(c)
		if err != nil {
			return err
		}

		webhookID, err := uuid.Parse(c.Params("webhookId"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid webhook ID",
			})
		}

		if svcErr := h.campaignSvc.DeleteCampaignWebhook(webhookID, userID); svcErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": svcErr.Error(),
			})
		}

		return c.JSON(fiber.Map{"success": true})
	}
}

// ── GET /api/campaigns/:id/webhook-logs ─────────────────────────────────────

func (h *CampaignHandler) GetWebhookLogs() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, err := getUserID(c)
		if err != nil {
			return err
		}

		campaignID, err := parseCampaignID(c)
		if err != nil {
			return nil
		}

		limit := 50
		if lStr := c.Query("limit"); lStr != "" {
			if l, err := strconv.Atoi(lStr); err == nil && l > 0 {
				limit = l
			}
		}

		logs, svcErr := h.campaignSvc.GetCampaignWebhookLogs(campaignID, limit)
		if svcErr != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to fetch webhook logs",
			})
		}

		return c.JSON(logs)
	}
}
