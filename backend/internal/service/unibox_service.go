package service

import (
	"errors"
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"github.com/reach/backend/internal/repository"
	"gorm.io/gorm"
)

// ──────────────────────────────────────────────────────────────────────────────
// MessageQueueFunc — abstraction for the real LinkedIn delivery queue.
// Provide a real implementation to push messages to the Playwright worker;
// nil means "skip queueing (message saved in DB only)".
// ──────────────────────────────────────────────────────────────────────────────

// MessageQueuePayload describes the payload pushed to the queue.
type MessageQueuePayload struct {
	LinkedInAccountID string `json:"linkedinAccountId"`
	ThreadID          string `json:"threadId"`
	MessageText       string `json:"messageText"`
	ConversationID    string `json:"conversationId"`
}

// MessageQueueFunc is a function that enqueues a reply for real LinkedIn delivery.
type MessageQueueFunc func(payload MessageQueuePayload) error

// SyncTriggerFunc triggers an immediate message sync for a user's accounts.
type SyncTriggerFunc func(userID string) error

// UniboxService encapsulates all Unibox business logic.
type UniboxService struct {
	convRepo    *repository.ConversationRepository
	msgRepo     *repository.MessageRepository
	accountRepo *repository.LinkedInAccountRepository
	db          *gorm.DB // for campaign-context cross-table query
	queueReply  MessageQueueFunc
	triggerSync SyncTriggerFunc
}

func NewUniboxService(
	convRepo *repository.ConversationRepository,
	msgRepo *repository.MessageRepository,
	accountRepo *repository.LinkedInAccountRepository,
	db *gorm.DB,
	queueReply MessageQueueFunc,
	triggerSync SyncTriggerFunc,
) *UniboxService {
	return &UniboxService{
		convRepo:    convRepo,
		msgRepo:     msgRepo,
		accountRepo: accountRepo,
		db:          db,
		queueReply:  queueReply,
		triggerSync: triggerSync,
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSATIONS
// ═══════════════════════════════════════════════════════════════════════════════

// GetConversations returns conversations scoped to the user's LinkedIn accounts.
func (s *UniboxService) GetConversations(userID uuid.UUID, f models.GetConversationsFilter) ([]models.Conversation, error) {
	// Get user's LinkedIn account IDs for proper row-scoping
	accountIDs, err := s.getUserAccountIDs(userID)
	if err != nil {
		return nil, err
	}
	if len(accountIDs) == 0 {
		return []models.Conversation{}, nil
	}
	return s.convRepo.FindAllByAccountIDs(accountIDs, f)
}

// GetConversationMessages returns all messages for a conversation, ordered by sent_at ASC.
func (s *UniboxService) GetConversationMessages(conversationID uuid.UUID) ([]models.Message, error) {
	return s.msgRepo.FindByConversation(conversationID)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEND MESSAGE
// ═══════════════════════════════════════════════════════════════════════════════

// SendMessage saves a message to DB immediately (optimistic) and queues LinkedIn delivery.
func (s *UniboxService) SendMessage(userID uuid.UUID, req models.SendMessageRequest) (*models.Message, error) {
	convID, err := uuid.Parse(req.ConversationID)
	if err != nil {
		return nil, errors.New("invalid conversation_id")
	}
	accountID, err := uuid.Parse(req.LinkedInAccountID)
	if err != nil {
		return nil, errors.New("invalid linkedin_account_id")
	}

	// Get the thread_id for the queue payload
	conv, err := s.convRepo.FindByID(convID)
	if err != nil {
		return nil, errors.New("conversation not found")
	}

	// Generate a unique message ID
	messageID := fmt.Sprintf("sent_%d_%s", time.Now().UnixMilli(), randomString(5))
	now := time.Now()

	msg := models.Message{
		ConversationID:    convID,
		LinkedInAccountID: accountID,
		MessageID:         messageID,
		SenderName:        "Me",
		IsFromMe:          true,
		Content:           req.Content,
		SentAt:            now,
		IsRead:            true,
	}

	if err := s.msgRepo.Create(&msg); err != nil {
		return nil, fmt.Errorf("failed to save message: %w", err)
	}

	// Update conversation preview
	_ = s.convRepo.UpdateLastMessage(convID, truncate(req.Content, 200))

	// Queue real delivery via LinkedIn (async, non-blocking)
	if s.queueReply != nil {
		go func() {
			_ = s.queueReply(MessageQueuePayload{
				LinkedInAccountID: req.LinkedInAccountID,
				ThreadID:          conv.ThreadID,
				MessageText:       req.Content,
				ConversationID:    req.ConversationID,
			})
		}()
	}

	return &msg, nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARK AS READ
// ═══════════════════════════════════════════════════════════════════════════════

// MarkConversationAsRead marks all incoming messages in a conversation as read
// and resets the unread counter.
func (s *UniboxService) MarkConversationAsRead(conversationID uuid.UUID) error {
	if err := s.msgRepo.MarkAllAsReadInConversation(conversationID); err != nil {
		return err
	}
	return s.convRepo.ResetUnreadCount(conversationID)
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARCHIVE / LABEL
// ═══════════════════════════════════════════════════════════════════════════════

// ArchiveConversation sets or clears the archived flag.
func (s *UniboxService) ArchiveConversation(conversationID uuid.UUID, archive bool) error {
	return s.convRepo.SetArchived(conversationID, archive)
}

// SetConversationLabel sets or clears the label on a conversation.
func (s *UniboxService) SetConversationLabel(conversationID uuid.UUID, label *string) error {
	return s.convRepo.SetLabel(conversationID, label)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC
// ═══════════════════════════════════════════════════════════════════════════════

// TriggerSync triggers an immediate message sync for the user's accounts.
func (s *UniboxService) TriggerSync(userID uuid.UUID) (*models.TriggerSyncResponse, error) {
	if s.triggerSync == nil {
		return &models.TriggerSyncResponse{Success: false, Error: "sync engine not configured"}, nil
	}
	if err := s.triggerSync(userID.String()); err != nil {
		return &models.TriggerSyncResponse{Success: false, Error: err.Error()}, nil
	}
	return &models.TriggerSyncResponse{Success: true}, nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// LINKEDIN ACCOUNTS (for unibox account picker)
// ═══════════════════════════════════════════════════════════════════════════════

// GetLinkedInAccounts returns active accounts for the dropdown.
// (The existing account service already has this; but unibox only needs id/email/status.)
func (s *UniboxService) GetLinkedInAccounts(userID uuid.UUID) ([]map[string]interface{}, error) {
	// FindAllByUser already orders by created_at DESC
	accounts, err := s.accountRepo.FindAllByUser(userID)
	if err != nil {
		return nil, err
	}
	result := make([]map[string]interface{}, 0)
	for _, a := range accounts {
		if a.Status == "active" {
			result = append(result, map[string]interface{}{
				"id":     a.ID,
				"email":  a.Email,
				"status": a.Status,
			})
		}
	}
	return result, nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAMPAIGN CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

// GetCampaignContext looks up campaign_leads for a participant name and returns
// inline context (campaign name, lead status, company, position).
func (s *UniboxService) GetCampaignContext(participantName string, linkedinAccountID string) (*models.CampaignContextResponse, error) {
	if participantName == "" {
		return nil, nil
	}

	// The TS version splits first name and does an OR on full_name / first_name.
	firstName := firstWord(participantName)
	fullPattern := "%" + participantName + "%"
	firstPattern := "%" + firstName + "%"

	var row struct {
		Status       string  `gorm:"column:status"`
		CampaignName *string `gorm:"column:campaign_name"`
		Company      *string `gorm:"column:company"`
		Position     *string `gorm:"column:position"`
	}

	err := s.db.Raw(`
		SELECT cl.status,
		       c.name AS campaign_name,
		       l.company,
		       l.position
		FROM campaign_leads cl
		LEFT JOIN leads l ON l.id = cl.lead_id
		LEFT JOIN campaigns c ON c.id = cl.campaign_id
		WHERE (l.full_name ILIKE ? OR l.first_name ILIKE ?)
		LIMIT 1
	`, fullPattern, firstPattern).Scan(&row).Error

	if err != nil || row.Status == "" {
		return nil, nil
	}

	resp := &models.CampaignContextResponse{
		LeadStatus: &row.Status,
	}
	if row.CampaignName != nil {
		resp.CampaignName = row.CampaignName
	}
	if row.Company != nil {
		resp.Company = row.Company
	}
	if row.Position != nil {
		resp.Position = row.Position
	}
	return resp, nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

// getUserAccountIDs returns the UUIDs of all LinkedIn accounts owned by the user.
func (s *UniboxService) getUserAccountIDs(userID uuid.UUID) ([]uuid.UUID, error) {
	accounts, err := s.accountRepo.FindAllByUser(userID)
	if err != nil {
		return nil, err
	}
	ids := make([]uuid.UUID, len(accounts))
	for i, a := range accounts {
		ids[i] = a.ID
	}
	return ids, nil
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "…"
}

func firstWord(s string) string {
	for i, c := range s {
		if c == ' ' {
			return s[:i]
		}
	}
	return s
}
