package automation

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/playwright-community/playwright-go"
	"github.com/reach/backend/internal/models"
	"github.com/reach/backend/internal/repository"
	"gorm.io/gorm"
)

// ──────────────────────────────────────────────────────────────────────────────
// Message Scraper
//
// Implements workers.MessageSyncAutomation:
//   SyncAllAccounts, SyncAccountMessages, SendLinkedInReply
//
// Go equivalent of lib/linkedin-message-scraper.ts
// ──────────────────────────────────────────────────────────────────────────────

// MessageScraperService implements the MessageSyncAutomation interface.
type MessageScraperService struct {
	bm          *BrowserManager
	accountRepo *repository.LinkedInAccountRepository
	convRepo    *repository.ConversationRepository
	msgRepo     *repository.MessageRepository
	db          *gorm.DB
}

// NewMessageScraperService creates a MessageScraperService.
func NewMessageScraperService(
	bm *BrowserManager,
	accountRepo *repository.LinkedInAccountRepository,
	convRepo *repository.ConversationRepository,
	msgRepo *repository.MessageRepository,
	db *gorm.DB,
) *MessageScraperService {
	return &MessageScraperService{
		bm:          bm,
		accountRepo: accountRepo,
		convRepo:    convRepo,
		msgRepo:     msgRepo,
		db:          db,
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// ScrapeConversations
//
// Mirrors lib/linkedin-message-scraper.ts → scrapeConversations()
// Navigates to /messaging, scrolls to load conversations, extracts list.
// ═══════════════════════════════════════════════════════════════════════════════

func (ms *MessageScraperService) ScrapeConversations(account *models.LinkedInAccount) ([]ScrapedConversation, error) {
	ab, err := ms.bm.CreateAuthenticatedBrowser(account, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create browser: %w", err)
	}
	defer ab.Close()

	page := ab.Page

	log.Printf("📬 [MsgScraper] Navigating to messaging for %s", account.Email)
	if _, err := page.Goto("https://www.linkedin.com/messaging/", playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateDomcontentloaded,
		Timeout:   playwright.Float(60000),
	}); err != nil {
		return nil, fmt.Errorf("failed to navigate to messaging: %w", err)
	}
	time.Sleep(3 * time.Second)

	// Scroll to load more conversations
	for i := 0; i < 5; i++ {
		page.Evaluate(`
			const list = document.querySelector('.msg-conversations-container__conversations-list');
			if (list) list.scrollTop = list.scrollHeight;
		`)
		time.Sleep(1 * time.Second)
	}

	// Extract conversations via page.evaluate
	result, err := page.Evaluate(`() => {
		const conversations = [];
		const items = document.querySelectorAll('.msg-conversation-listitem, .msg-conversations-container__conversations-list li');
		items.forEach(item => {
			const nameEl = item.querySelector('.msg-conversation-card__participant-names, .msg-conversation-listitem__participant-names');
			const headlineEl = item.querySelector('.msg-conversation-card__message-snippet-body, .msg-conversation-card__subtitle');
			const avatarEl = item.querySelector('img.presence-entity__image, img.msg-facepile-grid__img');
			const previewEl = item.querySelector('.msg-conversation-card__message-snippet-body');
			const unreadEl = item.querySelector('.msg-conversation-card__unread-count, .notification-badge');
			
			// Try to get threadId from data attribute or link
			let threadId = item.getAttribute('data-thread-id') || '';
			if (!threadId) {
				const link = item.querySelector('a[href*="/messaging/thread/"]');
				if (link) {
					const m = link.getAttribute('href').match(/thread\/([^/]+)/);
					if (m) threadId = m[1];
				}
			}
			// fallback: use index
			if (!threadId) threadId = 'thread_' + conversations.length;
			
			conversations.push({
				threadId: threadId,
				participantName: nameEl ? nameEl.textContent.trim() : '',
				headline: headlineEl ? headlineEl.textContent.trim() : '',
				avatarUrl: avatarEl ? avatarEl.src : '',
				preview: previewEl ? previewEl.textContent.trim() : '',
				isUnread: !!unreadEl,
			});
		});
		return conversations;
	}`)
	if err != nil {
		return nil, fmt.Errorf("failed to extract conversations: %w", err)
	}

	// Parse result
	var conversations []ScrapedConversation
	if arr, ok := result.([]interface{}); ok {
		for _, item := range arr {
			if obj, ok := item.(map[string]interface{}); ok {
				conversations = append(conversations, ScrapedConversation{
					ThreadID:        getString(obj, "threadId"),
					ParticipantName: getString(obj, "participantName"),
					Headline:        getString(obj, "headline"),
					AvatarURL:       getString(obj, "avatarUrl"),
					Preview:         getString(obj, "preview"),
					IsUnread:        getBool(obj, "isUnread"),
				})
			}
		}
	}

	log.Printf("📬 [MsgScraper] Scraped %d conversations for %s", len(conversations), account.Email)
	return conversations, nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// ScrapeThreadMessages
//
// Mirrors lib/linkedin-message-scraper.ts → scrapeThreadMessages()
// Navigates to a specific thread and extracts all messages.
// ═══════════════════════════════════════════════════════════════════════════════

func (ms *MessageScraperService) ScrapeThreadMessages(account *models.LinkedInAccount, threadID string) ([]ScrapedMessage, error) {
	ab, err := ms.bm.CreateAuthenticatedBrowser(account, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create browser: %w", err)
	}
	defer ab.Close()

	page := ab.Page

	threadURL := fmt.Sprintf("https://www.linkedin.com/messaging/thread/%s/", threadID)
	log.Printf("📬 [MsgScraper] Navigating to thread: %s", threadURL)

	if _, err := page.Goto(threadURL, playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateDomcontentloaded,
		Timeout:   playwright.Float(60000),
	}); err != nil {
		return nil, fmt.Errorf("failed to navigate to thread: %w", err)
	}
	time.Sleep(3 * time.Second)

	// Scroll up to load message history
	for i := 0; i < 5; i++ {
		page.Evaluate(`
			const msgList = document.querySelector('.msg-s-message-list');
			if (msgList) msgList.scrollTop = 0;
		`)
		time.Sleep(800 * time.Millisecond)
	}

	// Extract messages
	result, err := page.Evaluate(`() => {
		const messages = [];
		const events = document.querySelectorAll('.msg-s-event-listitem, .msg-s-message-list__event');
		events.forEach((event, index) => {
			const senderEl = event.querySelector('.msg-s-event-listitem__link, .msg-s-message-group__name');
			const bodyEl = event.querySelector('.msg-s-event-listitem__body, .msg-s-event__content');
			const timeEl = event.querySelector('.msg-s-message-group__timestamp, time');
			
			const sender = senderEl ? senderEl.textContent.trim() : '';
			const content = bodyEl ? bodyEl.textContent.trim() : '';
			const timeText = timeEl ? (timeEl.getAttribute('datetime') || timeEl.textContent.trim()) : '';
			
			// Detect if message is from the logged-in user
			const isFromMe = event.classList.contains('msg-s-event-listitem--other') === false;
			
			if (content) {
				messages.push({
					messageId: 'msg_' + index + '_' + Date.now(),
					sender: sender,
					content: content,
					time: timeText,
					isFromMe: isFromMe,
				});
			}
		});
		return messages;
	}`)
	if err != nil {
		return nil, fmt.Errorf("failed to extract messages: %w", err)
	}

	var messages []ScrapedMessage
	if arr, ok := result.([]interface{}); ok {
		for _, item := range arr {
			if obj, ok := item.(map[string]interface{}); ok {
				messages = append(messages, ScrapedMessage{
					MessageID: getString(obj, "messageId"),
					Sender:    getString(obj, "sender"),
					Content:   getString(obj, "content"),
					Time:      getString(obj, "time"),
					IsFromMe:  getBool(obj, "isFromMe"),
				})
			}
		}
	}

	log.Printf("📬 [MsgScraper] Scraped %d messages from thread %s", len(messages), threadID)
	return messages, nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// SendLinkedInReply
//
// Mirrors lib/linkedin-message-scraper.ts → sendLinkedInReply()
// Navigates to a thread and sends a message.
// ═══════════════════════════════════════════════════════════════════════════════

func (ms *MessageScraperService) SendLinkedInReply(account *models.LinkedInAccount, threadID, messageText string) error {
	ab, err := ms.bm.CreateAuthenticatedBrowser(account, nil)
	if err != nil {
		return fmt.Errorf("failed to create browser: %w", err)
	}
	defer ab.Close()

	page := ab.Page

	threadURL := fmt.Sprintf("https://www.linkedin.com/messaging/thread/%s/", threadID)
	log.Printf("💬 [MsgScraper] Sending reply to thread: %s", threadURL)

	if _, err := page.Goto(threadURL, playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateDomcontentloaded,
		Timeout:   playwright.Float(60000),
	}); err != nil {
		return fmt.Errorf("failed to navigate to thread: %w", err)
	}
	time.Sleep(3 * time.Second)

	// Find the composer textbox
	textbox := page.Locator("div[role='textbox'].msg-form__contenteditable, div[role='textbox']").First()
	tbCount, _ := textbox.Count()
	if tbCount == 0 {
		return fmt.Errorf("message composer not found")
	}

	// Click and type
	textbox.Click()
	time.Sleep(300 * time.Millisecond)
	page.Keyboard().Type(messageText, playwright.KeyboardTypeOptions{
		Delay: playwright.Float(20),
	})
	time.Sleep(500 * time.Millisecond)

	// Send via button or Enter
	sendBtn := page.Locator(".msg-form__send-button, button[aria-label*='Send'], button:has-text('Send')").First()
	sendCount, _ := sendBtn.Count()
	if sendCount > 0 {
		sendBtn.Click()
	} else {
		page.Keyboard().Press("Enter")
	}
	time.Sleep(2 * time.Second)

	log.Printf("💬 [MsgScraper] ✅ Reply sent to thread %s", threadID)
	return nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// SyncAccountMessages
//
// Mirrors lib/linkedin-message-scraper.ts → syncAccountMessages()
// Full sync: scrape conversations, upsert to DB, scrape unread thread messages.
// ═══════════════════════════════════════════════════════════════════════════════

func (ms *MessageScraperService) SyncAccountMessages(linkedinAccountID string) (map[string]interface{}, error) {
	accountUUID, err := uuid.Parse(linkedinAccountID)
	if err != nil {
		return nil, fmt.Errorf("invalid account ID: %w", err)
	}

	account, err := ms.accountRepo.FindByID(accountUUID)
	if err != nil {
		return nil, fmt.Errorf("account not found: %w", err)
	}

	log.Printf("📬 [MsgScraper] Starting message sync for %s (%s)", account.Email, linkedinAccountID)

	// 1. Scrape conversations
	conversations, err := ms.ScrapeConversations(account)
	if err != nil {
		HandleAccountDisconnection(ms.accountRepo, account.ID, err.Error())
		return nil, fmt.Errorf("failed to scrape conversations: %w", err)
	}

	// 2. Upsert conversations to DB
	syncedConvs := 0
	newMessages := 0
	for _, conv := range conversations {
		if conv.ThreadID == "" || conv.ParticipantName == "" {
			continue
		}

		// Upsert conversation
		existing := &models.Conversation{}
		result := ms.db.Where("thread_id = ?", conv.ThreadID).First(existing)

		now := time.Now()
		if result.Error == gorm.ErrRecordNotFound {
			// Create new conversation
			newConv := models.Conversation{
				LinkedInAccountID: account.ID,
				ParticipantName:   conv.ParticipantName,
				ThreadID:          conv.ThreadID,
				LastMessagePreview: strPtr(conv.Preview),
				LastMessageAt:     &now,
				UnreadCount:       boolToInt(conv.IsUnread),
			}
			if conv.Headline != "" {
				newConv.ParticipantHeadline = &conv.Headline
			}
			if conv.AvatarURL != "" {
				newConv.ParticipantAvatarURL = &conv.AvatarURL
			}
			ms.db.Create(&newConv)
			syncedConvs++
		} else if result.Error == nil {
			// Update existing
			updates := map[string]interface{}{
				"participant_name":   conv.ParticipantName,
				"last_message_at":    now,
				"last_message_preview": conv.Preview,
				"updated_at":        now,
			}
			if conv.IsUnread {
				updates["unread_count"] = gorm.Expr("unread_count + 1")
			}
			ms.db.Model(existing).Updates(updates)
			syncedConvs++
		}

		// 3. Scrape messages for unread conversations
		if conv.IsUnread {
			messages, msgErr := ms.ScrapeThreadMessages(account, conv.ThreadID)
			if msgErr != nil {
				log.Printf("⚠️ [MsgScraper] Failed to scrape thread %s: %v", conv.ThreadID, msgErr)
				continue
			}

			// Get the conversation ID for this thread
			var dbConv models.Conversation
			if err := ms.db.Where("thread_id = ?", conv.ThreadID).First(&dbConv).Error; err != nil {
				continue
			}

			for _, msg := range messages {
				// Check if message already exists
				var existingMsg models.Message
				if ms.db.Where("message_id = ?", msg.MessageID).First(&existingMsg).Error == gorm.ErrRecordNotFound {
					newMsg := models.Message{
						ConversationID:    dbConv.ID,
						LinkedInAccountID: account.ID,
						MessageID:         msg.MessageID,
						SenderName:        msg.Sender,
						IsFromMe:          msg.IsFromMe,
						Content:           msg.Content,
						SentAt:            now,
						IsRead:            false,
					}
					ms.db.Create(&newMsg)
					newMessages++
				}
			}
		}
	}

	// Update last activity
	ms.accountRepo.UpdateFields(account.ID, map[string]interface{}{
		"last_activity_at": time.Now(),
	})

	result := map[string]interface{}{
		"conversations_synced": syncedConvs,
		"new_messages":         newMessages,
		"total_conversations":  len(conversations),
	}

	log.Printf("📬 [MsgScraper] ✅ Sync complete for %s: %d convs, %d new msgs", account.Email, syncedConvs, newMessages)
	return result, nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// SyncAllAccounts
//
// Mirrors lib/linkedin-message-scraper.ts → syncAllAccounts()
// Iterates all active LinkedIn accounts and syncs messages for each.
// ═══════════════════════════════════════════════════════════════════════════════

func (ms *MessageScraperService) SyncAllAccounts(userID string) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid user ID: %w", err)
	}

	accounts, err := ms.accountRepo.FindAllByUser(uid)
	if err != nil {
		return fmt.Errorf("failed to fetch accounts: %w", err)
	}

	log.Printf("📬 [MsgScraper] Syncing messages for %d accounts (user: %s)", len(accounts), userID)

	for _, acct := range accounts {
		if acct.Status != models.AccountStatusActive {
			continue
		}
		if _, err := ms.SyncAccountMessages(acct.ID.String()); err != nil {
			log.Printf("⚠️ [MsgScraper] Failed to sync account %s: %v", acct.Email, err)
			continue
		}
		// Add a delay between accounts to avoid rate limiting
		humanDelay(2000, 5000)
	}

	return nil
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return strings.TrimSpace(v)
	}
	return ""
}

func getBool(m map[string]interface{}, key string) bool {
	if v, ok := m[key].(bool); ok {
		return v
	}
	return false
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
