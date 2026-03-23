package service

import (
	"bytes"
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

// AIIcebreakerService generates personalised icebreaker sentences using OpenAI.
type AIIcebreakerService struct {
	leadDataRepo *repository.LeadRepository
	leadRepo     *repository.CampaignLeadRepository
	apiKey       string
	model        string
	client       *http.Client
}

func NewAIIcebreakerService(
	leadDataRepo *repository.LeadRepository,
	leadRepo *repository.CampaignLeadRepository,
	apiKey string,
) *AIIcebreakerService {
	model := "gpt-4o-mini"
	return &AIIcebreakerService{
		leadDataRepo: leadDataRepo,
		leadRepo:     leadRepo,
		apiKey:       apiKey,
		model:        model,
		client:       &http.Client{Timeout: 30 * time.Second},
	}
}

// GenerateIcebreakers generates AI icebreaker sentences for all leads in a
// campaign that don't already have one. This mirrors the TS
// generateAIIcebreakers function from campaigns.ts.
//
// Safe to call fire-and-forget (errors are logged internally).
func (s *AIIcebreakerService) GenerateIcebreakers(campaignID uuid.UUID) {
	if s.apiKey == "" {
		log.Printf("[AI Icebreaker] No OPENAI_API_KEY configured, skipping")
		return
	}

	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[AI Icebreaker] Panic recovered: %v", r)
			}
		}()

		campaignLeads, err := s.leadRepo.FindByCampaignID(campaignID, nil, nil)
		if err != nil || len(campaignLeads) == 0 {
			return
		}

		// Collect lead IDs
		leadIDs := make([]uuid.UUID, len(campaignLeads))
		for i, cl := range campaignLeads {
			leadIDs[i] = cl.LeadID
		}

		leads, err := s.leadDataRepo.FindByIDs(leadIDs)
		if err != nil || len(leads) == 0 {
			return
		}

		generated := 0
		for i := range leads {
			lead := &leads[i]
			if lead.AIIcebreaker != nil && *lead.AIIcebreaker != "" {
				continue
			}

			icebreaker, err := s.generateSingleIcebreaker(lead)
			if err != nil {
				log.Printf("[AI Icebreaker] Error for lead %s: %v", lead.ID, err)
				continue
			}

			// Persist back to leads table
			if s.leadDataRepo != nil {
				if err := s.leadDataRepo.UpdateAIIcebreaker(lead.ID, icebreaker); err != nil {
					log.Printf("[AI Icebreaker] Failed to save icebreaker for %s: %v", lead.ID, err)
				}
			}
			generated++
		}

		log.Printf("[AI Icebreaker] Campaign %s: generated %d icebreakers for %d leads",
			campaignID, generated, len(leads))
	}()
}

// generateSingleIcebreaker calls OpenAI to produce a short personalised opener.
func (s *AIIcebreakerService) generateSingleIcebreaker(lead *models.Lead) (string, error) {
	firstName := ""
	if lead.FirstName != nil {
		firstName = *lead.FirstName
	}
	company := ""
	if lead.Company != nil {
		company = *lead.Company
	}
	position := ""
	if lead.Position != nil {
		position = *lead.Position
	}
	headline := ""
	if lead.Headline != nil {
		headline = *lead.Headline
	}

	prompt := fmt.Sprintf(
		`Write a short, personalised icebreaker sentence (1-2 sentences, max 100 characters) for a LinkedIn connection request to:
Name: %s
Company: %s
Position: %s
Headline: %s

Rules:
- Be conversational and genuine, not salesy
- Reference their role, company, or headline if available
- Do NOT include greetings like "Hi" or "Hello"
- Do NOT include the person's name
- Keep it under 100 characters`,
		firstName, company, position, headline,
	)

	type chatMessage struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	type chatRequest struct {
		Model       string        `json:"model"`
		Messages    []chatMessage `json:"messages"`
		MaxTokens   int           `json:"max_tokens"`
		Temperature float64       `json:"temperature"`
	}

	reqBody := chatRequest{
		Model: s.model,
		Messages: []chatMessage{
			{Role: "system", Content: "You are a professional LinkedIn outreach assistant."},
			{Role: "user", Content: prompt},
		},
		MaxTokens:   60,
		Temperature: 0.8,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("OpenAI API error %d: %s", resp.StatusCode, string(respBody))
	}

	type chatChoice struct {
		Message chatMessage `json:"message"`
	}
	type chatResponse struct {
		Choices []chatChoice `json:"choices"`
	}

	var chatResp chatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return "", err
	}

	if len(chatResp.Choices) == 0 {
		return "", fmt.Errorf("no response from OpenAI")
	}

	return chatResp.Choices[0].Message.Content, nil
}
