package handler

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/reach/backend/internal/config"
	"github.com/reach/backend/internal/models"
	stripe "github.com/stripe/stripe-go/v76"
	billingportalsession "github.com/stripe/stripe-go/v76/billingportal/session"
	checkoutsession "github.com/stripe/stripe-go/v76/checkout/session"
	"github.com/stripe/stripe-go/v76/customer"
	"github.com/stripe/stripe-go/v76/webhook"
	"gorm.io/gorm"
)

// BillingCheckoutHandler handles POST /api/billing/checkout
// Creates a Stripe Checkout session and returns the URL.
func BillingCheckoutHandler(cfg *config.Config, db *gorm.DB) fiber.Handler {
	stripe.Key = cfg.StripeSecretKey
	return func(c *fiber.Ctx) error {
		userID := c.Locals("user_id").(string)
		email := c.Locals("email").(string)
		wsID := c.Locals("workspace_id").(string)

		var body struct {
			PriceID string `json:"price_id"`
		}
		if err := c.BodyParser(&body); err != nil || body.PriceID == "" {
			return c.Status(400).JSON(fiber.Map{"error": "price_id required"})
		}

		// Find or create Stripe customer
		stripeCustomerID := ""
		var up models.UserPlan
		if err := db.Where("workspace_id = ?", wsID).First(&up).Error; err == nil {
			stripeCustomerID = up.StripeCustomerID
		}

		if stripeCustomerID == "" {
			cust, err := customer.New(&stripe.CustomerParams{
				Email: stripe.String(email),
				Metadata: map[string]string{
					"workspace_id": wsID,
					"user_id":      userID,
				},
			})
			if err != nil {
				return c.Status(500).JSON(fiber.Map{"error": "Failed to create Stripe customer"})
			}
			stripeCustomerID = cust.ID
		}

		successURL := cfg.FrontendURL + "/dashboard?checkout=success"
		cancelURL := cfg.FrontendURL + "/pricing?checkout=canceled"

		params := &stripe.CheckoutSessionParams{
			Customer: stripe.String(stripeCustomerID),
			Mode:     stripe.String(string(stripe.CheckoutSessionModeSubscription)),
			LineItems: []*stripe.CheckoutSessionLineItemParams{
				{
					Price:    stripe.String(body.PriceID),
					Quantity: stripe.Int64(1),
				},
			},
			SuccessURL: stripe.String(successURL),
			CancelURL:  stripe.String(cancelURL),
			SubscriptionData: &stripe.CheckoutSessionSubscriptionDataParams{
				Metadata: map[string]string{
					"workspace_id": wsID,
					"user_id":      userID,
				},
			},
		}

		sess, err := checkoutsession.New(params)
		if err != nil {
			log.Printf("[Billing] Checkout session error: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create checkout session"})
		}

		// Persist stripe customer ID
		if up.ID != "" && up.StripeCustomerID == "" {
			db.Model(&up).Update("stripe_customer_id", stripeCustomerID)
		}

		return c.JSON(fiber.Map{"url": sess.URL})
	}
}

// BillingPortalHandler handles GET /api/billing/portal
// Returns a Stripe Customer Portal URL for managing subscriptions.
func BillingPortalHandler(cfg *config.Config, db *gorm.DB) fiber.Handler {
	stripe.Key = cfg.StripeSecretKey
	return func(c *fiber.Ctx) error {
		wsID := c.Locals("workspace_id").(string)

		var up models.UserPlan
		if err := db.Where("workspace_id = ?", wsID).First(&up).Error; err != nil || up.StripeCustomerID == "" {
			return c.Status(400).JSON(fiber.Map{"error": "No Stripe customer found"})
		}

		params := &stripe.BillingPortalSessionParams{
			Customer:  stripe.String(up.StripeCustomerID),
			ReturnURL: stripe.String(cfg.FrontendURL + "/profile"),
		}

		// Use the billing portal session package
		portalSess, err := billingportalsession.New(params)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create portal session"})
		}

		return c.JSON(fiber.Map{"url": portalSess.URL})
	}
}

// StripeWebhookHandler handles POST /stripe/webhook
func StripeWebhookHandler(cfg *config.Config, db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		body := c.Body()

		sig := c.Get("Stripe-Signature")
		event, err := webhook.ConstructEvent(body, sig, cfg.StripeWebhookSecret)
		if err != nil {
			log.Printf("[Webhook] Signature verification failed: %v", err)
			return c.Status(400).JSON(fiber.Map{"error": "Invalid signature"})
		}

		switch event.Type {
		case "customer.subscription.created", "customer.subscription.updated":
			handleSubscriptionUpsert(db, event.Data.Raw)
		case "customer.subscription.deleted":
			handleSubscriptionDeleted(db, event.Data.Raw)
		case "checkout.session.completed":
			handleCheckoutCompleted(db, event.Data.Raw)
		}

		return c.JSON(fiber.Map{"received": true})
	}
}

func handleCheckoutCompleted(db *gorm.DB, raw json.RawMessage) {
	var sess struct {
		Customer     string            `json:"customer"`
		Subscription string            `json:"subscription"`
		Metadata     map[string]string `json:"metadata"`
	}
	if err := json.Unmarshal(raw, &sess); err != nil {
		return
	}

	wsID := sess.Metadata["workspace_id"]
	if wsID == "" {
		return
	}

	var userPlan models.UserPlan
	if err := db.Where("workspace_id = ?", wsID).First(&userPlan).Error; err != nil {
		log.Printf("[Webhook] checkout.session.completed: workspace %s not found in user_plans", wsID)
		return
	}

	updates := map[string]interface{}{
		"status":                 models.UserPlanActive,
		"is_active":              true,
		"assigned_by_admin":      false,
		"stripe_subscription_id": sess.Subscription,
	}
	if sess.Customer != "" {
		updates["stripe_customer_id"] = sess.Customer
	}
	db.Model(&userPlan).Updates(updates)
	log.Printf("[Webhook] ✅ checkout.session.completed for workspace %s", wsID)
}

func handleSubscriptionUpsert(db *gorm.DB, raw json.RawMessage) {
	var sub stripe.Subscription
	if err := json.Unmarshal(raw, &sub); err != nil {
		return
	}

	wsID := sub.Metadata["workspace_id"]
	var userPlan models.UserPlan
	query := db.Where("workspace_id = ?", wsID)
	if wsID == "" {
		query = db.Where("stripe_subscription_id = ?", sub.ID)
	}
	if err := query.First(&userPlan).Error; err != nil {
		return
	}

	status := models.UserPlanActive
	switch sub.Status {
	case stripe.SubscriptionStatusCanceled:
		status = models.UserPlanCanceled
	case stripe.SubscriptionStatusPastDue:
		status = models.UserPlanPastDue
	case stripe.SubscriptionStatusTrialing:
		status = models.UserPlanTrialing
	}

	var periodEnd *time.Time
	if sub.CurrentPeriodEnd > 0 {
		t := time.Unix(sub.CurrentPeriodEnd, 0)
		periodEnd = &t
	}

	planID := userPlan.PlanID
	if sub.Items != nil && len(sub.Items.Data) > 0 && sub.Items.Data[0].Price != nil {
		var plan models.Plan
		if err := db.Where("stripe_price_id = ? AND type = ?", sub.Items.Data[0].Price.ID, models.PlanTypeStripe).First(&plan).Error; err == nil {
			planID = plan.ID
		}
	}

	updates := map[string]interface{}{
		"plan_id":                    planID,
		"stripe_subscription_id":    sub.ID,
		"status":                    status,
		"is_active":                 status == models.UserPlanActive || status == models.UserPlanTrialing,
		"assigned_by_admin":         false,
		"stripe_current_period_end": periodEnd,
	}
	if sub.Customer != nil {
		updates["stripe_customer_id"] = sub.Customer.ID
	}

	db.Model(&userPlan).Updates(updates)
	log.Printf("[Webhook] subscription.%s for workspace %s → %s", sub.Status, userPlan.WorkspaceID, status)
}

func handleSubscriptionDeleted(db *gorm.DB, raw json.RawMessage) {
	var sub stripe.Subscription
	if err := json.Unmarshal(raw, &sub); err != nil {
		return
	}
	wsID := sub.Metadata["workspace_id"]
	query := db.Model(&models.UserPlan{})
	if wsID != "" {
		query = query.Where("workspace_id = ?", wsID)
	} else {
		query = query.Where("stripe_subscription_id = ?", sub.ID)
	}
	query.Updates(map[string]interface{}{
		"status":    models.UserPlanCanceled,
		"is_active": false,
	})
	log.Printf("[Webhook] subscription.deleted for workspace %s", wsID)
}
