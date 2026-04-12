package handler

import (
	"encoding/json"

	"github.com/gofiber/fiber/v2"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// AdminListPlansHandler handles GET /admin/plans
func AdminListPlansHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var plans []models.Plan
		if err := db.Order("created_at desc").Find(&plans).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch plans"})
		}
		return c.JSON(fiber.Map{"plans": plans})
	}
}

// AdminCreatePlanHandler handles POST /admin/plans
func AdminCreatePlanHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			Name               string          `json:"name"`
			Type               models.PlanType `json:"type"` // "stripe" or "custom"
			Description        string          `json:"description"`
			PriceMonthly       int64           `json:"price_monthly"`
			StripePriceID      string          `json:"stripe_price_id"`
			StripeProductID    string          `json:"stripe_product_id"`
			MaxLinkedInSenders int             `json:"max_linkedin_senders"`
			MaxCampaigns       int             `json:"max_campaigns"`
			MaxLeads           int             `json:"max_leads"`
			Features           []string        `json:"features"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}
		if body.Name == "" {
			return c.Status(400).JSON(fiber.Map{"error": "Plan name is required"})
		}
		if body.Type == "" {
			body.Type = models.PlanTypeCustom
		}
		if body.MaxLinkedInSenders == 0 {
			body.MaxLinkedInSenders = 2
		}
		if body.MaxCampaigns == 0 {
			body.MaxCampaigns = -1
		}
		if body.MaxLeads == 0 {
			body.MaxLeads = -1
		}

		featuresJSON := "[]"
		if len(body.Features) > 0 {
			b, _ := json.Marshal(body.Features)
			featuresJSON = string(b)
		}

		plan := models.Plan{
			Name:               body.Name,
			Type:               body.Type,
			Description:        body.Description,
			PriceMonthly:       body.PriceMonthly,
			StripePriceID:      body.StripePriceID,
			StripeProductID:    body.StripeProductID,
			MaxLinkedInSenders: body.MaxLinkedInSenders,
			MaxCampaigns:       body.MaxCampaigns,
			MaxLeads:           body.MaxLeads,
			Features:           featuresJSON,
			IsActive:           true,
		}

		if err := db.Create(&plan).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create plan"})
		}
		return c.Status(201).JSON(fiber.Map{"plan": plan})
	}
}

// AdminUpdatePlanHandler handles PUT /admin/plans/:id
func AdminUpdatePlanHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		planID := c.Params("id")

		var body struct {
			Name               *string          `json:"name"`
			Description        *string          `json:"description"`
			MaxLinkedInSenders *int             `json:"max_linkedin_senders"`
			MaxCampaigns       *int             `json:"max_campaigns"`
			MaxLeads           *int             `json:"max_leads"`
			IsActive           *bool            `json:"is_active"`
			Features           []string         `json:"features"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}

		var plan models.Plan
		if err := db.Where("id = ?", planID).First(&plan).Error; err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "Plan not found"})
		}

		updates := map[string]interface{}{}
		if body.Name != nil {
			updates["name"] = *body.Name
		}
		if body.Description != nil {
			updates["description"] = *body.Description
		}
		if body.MaxLinkedInSenders != nil {
			updates["max_linkedin_senders"] = *body.MaxLinkedInSenders
		}
		if body.MaxCampaigns != nil {
			updates["max_campaigns"] = *body.MaxCampaigns
		}
		if body.MaxLeads != nil {
			updates["max_leads"] = *body.MaxLeads
		}
		if body.IsActive != nil {
			updates["is_active"] = *body.IsActive
		}
		if len(body.Features) > 0 {
			b, _ := json.Marshal(body.Features)
			updates["features"] = string(b)
		}

		if err := db.Model(&plan).Updates(updates).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to update plan"})
		}

		db.Where("id = ?", planID).First(&plan)
		return c.JSON(fiber.Map{"plan": plan})
	}
}
