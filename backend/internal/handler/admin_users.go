package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// AdminListUsersHandler handles GET /admin/users
func AdminListUsersHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var userPlans []models.UserPlan
		if err := db.Preload("Plan").Order("created_at desc").Find(&userPlans).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch users"})
		}
		return c.JSON(fiber.Map{"users": userPlans})
	}
}

// AdminGetUserHandler handles GET /admin/users/:workspace_id
func AdminGetUserHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		wsID := c.Params("workspace_id")
		var userPlan models.UserPlan
		if err := db.Preload("Plan").Where("workspace_id = ?", wsID).First(&userPlan).Error; err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "User not found"})
		}
		return c.JSON(fiber.Map{"user": userPlan})
	}
}

// AdminUpdateUserHandler handles PUT /admin/users/:workspace_id
// Supports: is_active, max_linkedin_senders, notes, plan_id
func AdminUpdateUserHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		wsID := c.Params("workspace_id")

		var body struct {
			IsActive           *bool   `json:"is_active"`
			MaxLinkedInSenders *int    `json:"max_linkedin_senders"`
			Notes              *string `json:"notes"`
			PlanID             *string `json:"plan_id"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}

		var userPlan models.UserPlan
		if err := db.Where("workspace_id = ?", wsID).First(&userPlan).Error; err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "User not found"})
		}

		updates := map[string]interface{}{}
		if body.IsActive != nil {
			updates["is_active"] = *body.IsActive
		}
		if body.MaxLinkedInSenders != nil {
			updates["max_linkedin_senders"] = *body.MaxLinkedInSenders
		}
		if body.Notes != nil {
			updates["notes"] = *body.Notes
		}
		if body.PlanID != nil {
			// Validate plan exists
			var plan models.Plan
			if err := db.Where("id = ?", *body.PlanID).First(&plan).Error; err != nil {
				return c.Status(400).JSON(fiber.Map{"error": "Plan not found"})
			}
			updates["plan_id"] = *body.PlanID
			updates["assigned_by_admin"] = true
			updates["status"] = models.UserPlanActive
		}

		if err := db.Model(&userPlan).Updates(updates).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to update user"})
		}

		db.Preload("Plan").Where("workspace_id = ?", wsID).First(&userPlan)
		return c.JSON(fiber.Map{"user": userPlan})
	}
}

// AdminAssignCustomPlanHandler handles POST /admin/users/:workspace_id/assign-plan
func AdminAssignCustomPlanHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		wsID := c.Params("workspace_id")

		var body struct {
			PlanID             string `json:"plan_id"`
			MaxLinkedInSenders int    `json:"max_linkedin_senders"`
			Notes              string `json:"notes"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}

		var plan models.Plan
		if err := db.Where("id = ?", body.PlanID).First(&plan).Error; err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Plan not found"})
		}

		// Upsert UserPlan
		var userPlan models.UserPlan
		err := db.Where("workspace_id = ?", wsID).First(&userPlan).Error

		if err == gorm.ErrRecordNotFound {
			// Shouldn't happen (created at callback), but handle gracefully
			return c.Status(404).JSON(fiber.Map{"error": "User has not logged in yet"})
		}

		updates := map[string]interface{}{
			"plan_id":               body.PlanID,
			"status":                models.UserPlanActive,
			"assigned_by_admin":     true,
			"is_active":             true,
			"notes":                 body.Notes,
		}
		if body.MaxLinkedInSenders > 0 {
			updates["max_linkedin_senders"] = body.MaxLinkedInSenders
		}

		if err := db.Model(&userPlan).Updates(updates).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to assign plan"})
		}

		db.Preload("Plan").Where("workspace_id = ?", wsID).First(&userPlan)
		return c.JSON(fiber.Map{"user": userPlan})
	}
}
