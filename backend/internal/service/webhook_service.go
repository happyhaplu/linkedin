package service

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"github.com/reach/backend/internal/repository"
)

// WebhookService handles outbound webhook delivery with retries.
type WebhookService struct {
	webhookRepo *repository.CampaignWebhookRepository
	logRepo     *repository.CampaignWebhookLogRepository
	client      *http.Client
}

func NewWebhookService(
	webhookRepo *repository.CampaignWebhookRepository,
	logRepo *repository.CampaignWebhookLogRepository,
) *WebhookService {
	return &WebhookService{
		webhookRepo: webhookRepo,
		logRepo:     logRepo,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// ── Types ───────────────────────────────────────────────────────────────────

type WebhookEvent string

const (
	WebhookEventConnectionSent     WebhookEvent = "connection_sent"
	WebhookEventConnectionAccepted WebhookEvent = "connection_accepted"
	WebhookEventMessageSent        WebhookEvent = "message_sent"
	WebhookEventReplied            WebhookEvent = "replied"
	WebhookEventCampaignPaused     WebhookEvent = "campaign_paused"
	WebhookEventCampaignCompleted  WebhookEvent = "campaign_completed"
)

type WebhookPayload struct {
	Event        WebhookEvent           `json:"event"`
	CampaignID   string                 `json:"campaign_id"`
	CampaignName string                 `json:"campaign_name"`
	Timestamp    string                 `json:"timestamp"`
	Lead         *WebhookLeadData       `json:"lead,omitempty"`
	Meta         map[string]interface{} `json:"meta,omitempty"`
}

type WebhookLeadData struct {
	ID          string `json:"id"`
	FullName    string `json:"full_name"`
	Company     string `json:"company,omitempty"`
	Position    string `json:"position,omitempty"`
	LinkedInURL string `json:"linkedin_url,omitempty"`
}

type deliveryResult struct {
	Success    bool
	StatusCode int
	Error      string
}

// ── Main entry point ────────────────────────────────────────────────────────

// TriggerWebhook looks up active webhooks for a campaign and fires them.
// Safe to call fire-and-forget; errors are caught internally.
func (s *WebhookService) TriggerWebhook(
	event WebhookEvent,
	campaignID uuid.UUID,
	campaignName string,
	leadData *WebhookLeadData,
	meta map[string]interface{},
) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[Webhook] Panic recovered: %v", r)
			}
		}()

		webhooks, err := s.webhookRepo.FindActiveByCampaignID(campaignID)
		if err != nil || len(webhooks) == 0 {
			return
		}

		payload := WebhookPayload{
			Event:        event,
			CampaignID:   campaignID.String(),
			CampaignName: campaignName,
			Timestamp:    time.Now().UTC().Format(time.RFC3339),
			Lead:         leadData,
			Meta:         meta,
		}

		for _, wh := range webhooks {
			// Check if this webhook listens to this event
			if len(wh.Events) > 0 {
				matched := false
				for _, e := range wh.Events {
					if e == string(event) {
						matched = true
						break
					}
				}
				if !matched {
					continue
				}
			}

			result := s.deliverWebhook(wh.URL, payload, wh.Secret)
			s.logDelivery(wh.ID, campaignID, event, result)
		}
	}()
}

// ── Delivery with retries ───────────────────────────────────────────────────

func (s *WebhookService) deliverWebhook(url string, payload WebhookPayload, secret *string) deliveryResult {
	body, err := json.Marshal(payload)
	if err != nil {
		return deliveryResult{Success: false, Error: fmt.Sprintf("JSON marshal error: %v", err)}
	}

	const maxRetries = 3
	var lastError string

	for attempt := 0; attempt < maxRetries; attempt++ {
		req, err := http.NewRequest("POST", url, bytes.NewReader(body))
		if err != nil {
			lastError = fmt.Sprintf("Request creation error: %v", err)
			continue
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "Reach-Webhooks/1.0")
		req.Header.Set("X-Webhook-Event", string(payload.Event))
		req.Header.Set("X-Webhook-Timestamp", payload.Timestamp)

		// HMAC signature
		if secret != nil && *secret != "" {
			mac := hmac.New(sha256.New, []byte(*secret))
			mac.Write(body)
			sig := hex.EncodeToString(mac.Sum(nil))
			req.Header.Set("X-Webhook-Signature", "sha256="+sig)
		}

		resp, err := s.client.Do(req)
		if err != nil {
			lastError = err.Error()
		} else {
			// Drain and close body
			_, _ = io.Copy(io.Discard, resp.Body)
			resp.Body.Close()

			if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				return deliveryResult{Success: true, StatusCode: resp.StatusCode}
			}
			lastError = fmt.Sprintf("HTTP %d", resp.StatusCode)
		}

		// Exponential back-off: 1s → 2s → 4s
		if attempt < maxRetries-1 {
			time.Sleep(time.Duration(1<<attempt) * time.Second)
		}
	}

	return deliveryResult{Success: false, Error: lastError}
}

// ── Logging ─────────────────────────────────────────────────────────────────

func (s *WebhookService) logDelivery(webhookID, campaignID uuid.UUID, event WebhookEvent, result deliveryResult) {
	logEntry := models.CampaignWebhookLog{
		WebhookID:  webhookID,
		CampaignID: campaignID,
		Event:      string(event),
		Success:    result.Success,
	}

	if result.Success {
		logEntry.StatusCode = &result.StatusCode
	} else {
		logEntry.ErrorMessage = &result.Error
		log.Printf("[Webhook] Failed delivery to webhook %s: %s", webhookID, result.Error)
	}

	if err := s.logRepo.Create(&logEntry); err != nil {
		log.Printf("[Webhook] Failed to log delivery: %v", err)
	}
}
