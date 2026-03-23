package automation

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/playwright-community/playwright-go"
	"github.com/reach/backend/internal/models"
)

// ──────────────────────────────────────────────────────────────────────────────
// Campaign Automation Service
//
// Implements service.LinkedInAutomation:
//   SendConnectionRequest, SendMessage, SendInMail, ViewProfile,
//   FollowProfile, LikePost
//
// Go equivalent of lib/linkedin-campaign-automation.ts
// ──────────────────────────────────────────────────────────────────────────────

// CampaignAutomation implements the LinkedInAutomation interface using Playwright.
type CampaignAutomation struct {
	bm *BrowserManager
}

// NewCampaignAutomation creates a CampaignAutomation bound to a BrowserManager.
func NewCampaignAutomation(bm *BrowserManager) *CampaignAutomation {
	return &CampaignAutomation{bm: bm}
}

// ═══════════════════════════════════════════════════════════════════════════════
// SendConnectionRequest
//
// Mirrors lib/linkedin-campaign-automation.ts → sendConnectionRequest():
//   1. Navigate to profile
//   2. Check degree badge (1st = already connected)
//   3. Check Pending/Withdraw (already sent)
//   4. Check incoming invite → auto-accept
//   5. Find Connect button (direct or More dropdown)
//   6. Handle "How do you know" dialog
//   7. Handle "Add a note" flow
//   8. Click Send
// ═══════════════════════════════════════════════════════════════════════════════

func (ca *CampaignAutomation) SendConnectionRequest(account *models.LinkedInAccount, lead *models.Lead, message string) error {
	ab, err := ca.bm.CreateAuthenticatedBrowser(account, nil)
	if err != nil {
		HandleAccountDisconnection(ca.bm.accountRepo, account.ID, err.Error())
		return err
	}
	defer ab.Close()

	page := ab.Page

	// Navigate to profile
	profileURL := NormalizeLinkedInURL(deref(lead.LinkedInURL))
	if profileURL == "" {
		return fmt.Errorf("lead has no LinkedIn URL")
	}
	log.Printf("[Connect] Navigating to profile: %s", profileURL)

	if _, err := page.Goto(profileURL, playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateDomcontentloaded,
		Timeout:   playwright.Float(30000),
	}); err != nil {
		return fmt.Errorf("failed to navigate to profile: %w", err)
	}

	// Wait for page to render
	page.Locator("main").WaitFor(playwright.LocatorWaitForOptions{
		Timeout: playwright.Float(10000),
	})
	time.Sleep(2500 * time.Millisecond)

	// Check for 404
	currentURL := page.URL()
	if strings.Contains(currentURL, "/404") {
		return fmt.Errorf("profile not found (404): %s", profileURL)
	}

	// ── Determine connection degree ──────────────────────────────────────
	degreeText, _ := page.Evaluate(`() => {
		const els = Array.from(document.querySelectorAll('span, div'));
		for (const el of els) {
			const t = el.textContent?.trim() || '';
			if (t === '• 1st' || t.includes('· 1st') || t.includes('• 1st')) return '1st';
			if (t === '• 2nd' || t.includes('· 2nd') || t.includes('• 2nd')) return '2nd';
			if (t.includes('3rd') || t.includes('3rd+')) return '3rd';
		}
		return null;
	}`)
	degree, _ := degreeText.(string)
	log.Printf("[Connect] Degree badge: %s", degree)

	if degree == "1st" {
		log.Printf("[Connect] Already 1st-degree connected with lead")
		return fmt.Errorf("already connected")
	}

	// ── Check if invitation already pending ──────────────────────────────
	pendingCount, _ := page.Locator(
		"button[aria-label*='Withdraw'], button[aria-label*='Pending'], " +
			"button:has-text('Withdraw'), button:has-text('Pending')",
	).Count()
	if pendingCount > 0 {
		log.Printf("[Connect] Invitation already pending — skipping")
		return fmt.Errorf("invitation already sent")
	}

	// ── Check for incoming invite → auto-accept ──────────────────────────
	acceptCount, _ := page.Locator(
		"button[aria-label*='Accept' i]:not([aria-label*='cookie' i]), button:text-is('Accept')",
	).Count()
	if acceptCount > 0 {
		log.Printf("[Connect] Incoming invitation detected — auto-accepting")
		err := page.Locator(
			"button[aria-label*='Accept' i]:not([aria-label*='cookie' i]), button:text-is('Accept')",
		).First().Click(playwright.LocatorClickOptions{Timeout: playwright.Float(5000)})
		if err == nil {
			time.Sleep(2 * time.Second)
			log.Printf("[Connect] ✅ Accepted incoming invitation")
			return nil
		}
		log.Printf("[Connect] Failed to accept incoming invite — proceeding to connect")
	}

	// ── Find Connect button ──────────────────────────────────────────────
	connectBtn := page.Locator("button[aria-label^='Invite'], main button:text-is('Connect')").First()
	connectCount, _ := connectBtn.Count()

	if connectCount > 0 {
		log.Printf("[Connect] Found direct Connect button")
		if err := connectBtn.Click(); err != nil {
			return fmt.Errorf("failed to click connect: %w", err)
		}
	} else {
		// Try "More actions" dropdown
		moreBtn := page.Locator("button[aria-label='More actions']").First()
		moreCount, _ := moreBtn.Count()
		if moreCount == 0 {
			return fmt.Errorf("connect button not found")
		}

		log.Printf("[Connect] Trying More actions dropdown")
		moreBtn.Click()
		time.Sleep(1500 * time.Millisecond)

		// Find Connect in dropdown
		connectInDrop := page.Locator(
			"div[role='menu'] span:text-is('Connect'), " +
				"ul[role='menu'] span:text-is('Connect'), " +
				".artdeco-dropdown__content span:text-is('Connect'), " +
				"div[role='listitem'] span:text-is('Connect')",
		).First()
		dropCount, _ := connectInDrop.Count()

		if dropCount > 0 {
			log.Printf("[Connect] Found Connect in More dropdown")
			if err := connectInDrop.Click(); err != nil {
				return fmt.Errorf("failed to click connect in dropdown: %w", err)
			}
		} else {
			// Broader match
			connectBroad := page.Locator(
				"div[role='menu'] li:has-text('Connect'), " +
					".artdeco-dropdown__content li:has-text('Connect')",
			).First()
			broadCount, _ := connectBroad.Count()
			if broadCount > 0 {
				connectBroad.Click()
			} else {
				return fmt.Errorf("connect button not found in dropdown")
			}
		}
	}

	// ── Wait for dialog ──────────────────────────────────────────────────
	log.Printf("[Connect] Waiting for connection dialog...")
	dialogAppeared := false
	err = page.Locator("div[role='dialog'], .artdeco-modal, .send-invite").WaitFor(playwright.LocatorWaitForOptions{
		Timeout: playwright.Float(5000),
	})
	if err == nil {
		dialogAppeared = true
	} else {
		time.Sleep(2 * time.Second)
	}

	// Check if now pending (direct send without dialog)
	nowPending, _ := page.Locator(
		"button[aria-label*='Withdraw'], button[aria-label*='Pending'], " +
			"button:has-text('Withdraw'), button:has-text('Pending')",
	).Count()
	if nowPending > 0 {
		log.Printf("[Connect] ✅ Connection request sent (no dialog — direct send)")
		return nil
	}

	if !dialogAppeared {
		return fmt.Errorf("connect dialog did not appear")
	}

	// ── Handle "How do you know" dialog ──────────────────────────────────
	howCount, _ := page.Locator(
		"div[role='dialog'] label:has-text('Other'), .artdeco-modal label:has-text('Other')",
	).First().Count()
	if howCount > 0 {
		log.Printf("[Connect] 'How do you know' dialog — selecting Other")
		page.Locator("div[role='dialog'] label:has-text('Other'), .artdeco-modal label:has-text('Other')").First().Click()
		time.Sleep(500 * time.Millisecond)

		connectAfter := page.Locator(
			"div[role='dialog'] button:has-text('Connect'), div[role='dialog'] button:has-text('Send')",
		).First()
		afterCount, _ := connectAfter.Count()
		if afterCount > 0 {
			connectAfter.Click()
			time.Sleep(2 * time.Second)
			log.Printf("[Connect] ✅ Connection request sent (How do you know)")
			return nil
		}
	}

	// ── Handle "Add a note" flow ─────────────────────────────────────────
	addNoteBtn := page.Locator(
		"div[role='dialog'] button:has-text('Add a note'), .artdeco-modal button:has-text('Add a note')",
	).First()
	addNoteCount, _ := addNoteBtn.Count()

	if addNoteCount > 0 && strings.TrimSpace(message) != "" {
		log.Printf("[Connect] Adding personal note")
		addNoteBtn.Click()
		time.Sleep(800 * time.Millisecond)

		noteInput := page.Locator(
			"div[role='dialog'] textarea[name='message'], " +
				"div[role='dialog'] textarea, " +
				".artdeco-modal textarea, " +
				"#custom-message",
		).First()
		inputCount, _ := noteInput.Count()
		if inputCount > 0 {
			// Truncate to 300 chars (LinkedIn limit)
			note := message
			if len(note) > 300 {
				note = note[:300]
			}
			noteInput.Fill(note)
			time.Sleep(500 * time.Millisecond)
		}
	}

	// ── Click Send ───────────────────────────────────────────────────────
	sendBtn := page.Locator(
		"div[role='dialog'] button:has-text('Send'), " +
			".artdeco-modal button:has-text('Send'), " +
			"div[role='dialog'] button[aria-label*='Send']",
	).First()
	sendCount, _ := sendBtn.Count()

	if sendCount > 0 {
		log.Printf("[Connect] Clicking Send button")
		sendBtn.Click()
	} else {
		// Try Connect button in dialog
		connectInDialog := page.Locator(
			"div[role='dialog'] button:has-text('Connect'), .artdeco-modal button:has-text('Connect')",
		).First()
		dialogCount, _ := connectInDialog.Count()
		if dialogCount > 0 {
			connectInDialog.Click()
		} else {
			return fmt.Errorf("no Send/Connect button found in dialog")
		}
	}

	time.Sleep(2 * time.Second)
	log.Printf("[Connect] ✅ Connection request sent successfully")
	return nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// SendMessage
//
// Mirrors lib/linkedin-campaign-automation.ts → sendMessage():
//   1. Navigate to profile
//   2. Click Message button
//   3. Type into contenteditable div[role="textbox"]
//   4. Send via Ctrl+Enter or Send button
// ═══════════════════════════════════════════════════════════════════════════════

func (ca *CampaignAutomation) SendMessage(account *models.LinkedInAccount, lead *models.Lead, message string) error {
	ab, err := ca.bm.CreateAuthenticatedBrowser(account, nil)
	if err != nil {
		HandleAccountDisconnection(ca.bm.accountRepo, account.ID, err.Error())
		return err
	}
	defer ab.Close()

	page := ab.Page

	profileURL := NormalizeLinkedInURL(deref(lead.LinkedInURL))
	if profileURL == "" {
		return fmt.Errorf("lead has no LinkedIn URL")
	}
	log.Printf("[Message] Navigating to profile: %s", profileURL)

	if _, err := page.Goto(profileURL, playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateDomcontentloaded,
		Timeout:   playwright.Float(30000),
	}); err != nil {
		return fmt.Errorf("failed to navigate to profile: %w", err)
	}

	page.Locator("main").WaitFor(playwright.LocatorWaitForOptions{
		Timeout: playwright.Float(10000),
	})
	time.Sleep(2500 * time.Millisecond)

	// Find Message button
	msgBtn := page.Locator(
		"button[aria-label*='Message'], button[aria-label*='message'], main button:has-text('Message')",
	).First()
	msgCount, _ := msgBtn.Count()

	if msgCount == 0 {
		// Fallback: any Message button
		anyMsg := page.Locator("button:has-text('Message')").First()
		anyCount, _ := anyMsg.Count()
		if anyCount == 0 {
			return fmt.Errorf("not connected - cannot send message")
		}
		anyMsg.Click(playwright.LocatorClickOptions{Timeout: playwright.Float(10000)})
	} else {
		msgBtn.Click(playwright.LocatorClickOptions{Timeout: playwright.Float(10000)})
	}
	time.Sleep(1500 * time.Millisecond)

	// Type message into contenteditable textbox
	truncated := message
	if len(truncated) > 8000 {
		truncated = truncated[:8000]
	}

	textbox := page.Locator("div[role='textbox']").First()
	textbox.Click(playwright.LocatorClickOptions{Timeout: playwright.Float(10000)})
	time.Sleep(300 * time.Millisecond)

	// Clear existing content and type
	page.Keyboard().Press("Control+A")
	page.Keyboard().Type(truncated, playwright.KeyboardTypeOptions{Delay: playwright.Float(20)})
	time.Sleep(800 * time.Millisecond)

	// Send via Ctrl+Enter
	page.Keyboard().Press("Control+Enter")
	time.Sleep(1500 * time.Millisecond)

	// Fallback: try Send button
	sendBtn := page.Locator(
		".msg-form__send-button, button[aria-label*='Send'], button:has-text('Send')",
	).First()
	sendCount, _ := sendBtn.Count()
	if sendCount > 0 {
		sendBtn.Click(playwright.LocatorClickOptions{Timeout: playwright.Float(5000)})
		time.Sleep(1 * time.Second)
	}

	log.Printf("[Message] ✅ Message sent to %s", profileURL)
	return nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// SendInMail
//
// Mirrors lib/linkedin-campaign-automation.ts → sendInMail():
//   1. Navigate to profile
//   2. Click Message/InMail button
//   3. Fill subject + message
//   4. Click Send
// ═══════════════════════════════════════════════════════════════════════════════

func (ca *CampaignAutomation) SendInMail(account *models.LinkedInAccount, lead *models.Lead, subject, message string) error {
	ab, err := ca.bm.CreateAuthenticatedBrowser(account, nil)
	if err != nil {
		HandleAccountDisconnection(ca.bm.accountRepo, account.ID, err.Error())
		return err
	}
	defer ab.Close()

	page := ab.Page

	profileURL := NormalizeLinkedInURL(deref(lead.LinkedInURL))
	if profileURL == "" {
		return fmt.Errorf("lead has no LinkedIn URL")
	}
	log.Printf("[InMail] Navigating to profile: %s", profileURL)

	if _, err := page.Goto(profileURL, playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateDomcontentloaded,
		Timeout:   playwright.Float(30000),
	}); err != nil {
		return fmt.Errorf("failed to navigate to profile: %w", err)
	}
	time.Sleep(2 * time.Second)

	// Find Message button
	msgBtn := page.Locator("button:has-text('Message')").First()
	msgCount, _ := msgBtn.Count()

	if msgCount == 0 {
		// Try More dropdown
		moreBtn := page.Locator("button:has-text('More')").First()
		moreCount, _ := moreBtn.Count()
		if moreCount == 0 {
			return fmt.Errorf("InMail button not found")
		}
		moreBtn.Click()
		time.Sleep(500 * time.Millisecond)

		msgInDrop := page.Locator("div[role='menu'] >> text=Message").First()
		dropCount, _ := msgInDrop.Count()
		if dropCount == 0 {
			return fmt.Errorf("InMail not available (requires Premium)")
		}
		msgInDrop.Click()
	} else {
		msgBtn.Click()
	}
	time.Sleep(1500 * time.Millisecond)

	// Check for InMail modal (subject field indicates InMail)
	subjectInput := page.Locator("input[name='subject']").First()
	subjectCount, _ := subjectInput.Count()

	if subjectCount > 0 {
		// InMail flow — fill subject
		subj := subject
		if len(subj) > 200 {
			subj = subj[:200]
		}
		subjectInput.Fill(subj)
		time.Sleep(500 * time.Millisecond)

		// Fill message (1900 char limit for InMail)
		msgInput := page.Locator("textarea[name='message']").First()
		truncated := message
		if len(truncated) > 1900 {
			truncated = truncated[:1900]
		}
		msgInput.Fill(truncated)
		time.Sleep(500 * time.Millisecond)
	} else {
		// Regular message interface (connected user)
		textbox := page.Locator("div[role='textbox']").First()
		tbCount, _ := textbox.Count()
		if tbCount == 0 {
			return fmt.Errorf("message interface not found")
		}
		truncated := message
		if len(truncated) > 8000 {
			truncated = truncated[:8000]
		}
		textbox.Fill(truncated)
		time.Sleep(500 * time.Millisecond)
	}

	// Click Send
	sendBtn := page.Locator("button:has-text('Send')").First()
	sendBtn.Click()
	time.Sleep(2 * time.Second)

	log.Printf("[InMail] ✅ InMail sent to %s", profileURL)
	return nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// ViewProfile
// ═══════════════════════════════════════════════════════════════════════════════

func (ca *CampaignAutomation) ViewProfile(account *models.LinkedInAccount, lead *models.Lead) error {
	ab, err := ca.bm.CreateAuthenticatedBrowser(account, nil)
	if err != nil {
		return err
	}
	defer ab.Close()

	profileURL := NormalizeLinkedInURL(deref(lead.LinkedInURL))
	if profileURL == "" {
		return fmt.Errorf("lead has no LinkedIn URL")
	}
	log.Printf("[ViewProfile] Viewing: %s", profileURL)

	if _, err := ab.Page.Goto(profileURL, playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateDomcontentloaded,
		Timeout:   playwright.Float(30000),
	}); err != nil {
		return fmt.Errorf("failed to navigate to profile: %w", err)
	}

	// Scroll down to simulate viewing
	ab.Page.Evaluate(`window.scrollBy(0, 500)`)
	humanDelay(2000, 4000)
	ab.Page.Evaluate(`window.scrollBy(0, 500)`)
	humanDelay(1000, 2000)

	log.Printf("[ViewProfile] ✅ Viewed profile: %s", profileURL)
	return nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// FollowProfile
// ═══════════════════════════════════════════════════════════════════════════════

func (ca *CampaignAutomation) FollowProfile(account *models.LinkedInAccount, lead *models.Lead) error {
	ab, err := ca.bm.CreateAuthenticatedBrowser(account, nil)
	if err != nil {
		return err
	}
	defer ab.Close()

	profileURL := NormalizeLinkedInURL(deref(lead.LinkedInURL))
	if profileURL == "" {
		return fmt.Errorf("lead has no LinkedIn URL")
	}
	log.Printf("[Follow] Following: %s", profileURL)

	if _, err := ab.Page.Goto(profileURL, playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateDomcontentloaded,
		Timeout:   playwright.Float(30000),
	}); err != nil {
		return fmt.Errorf("failed to navigate to profile: %w", err)
	}
	time.Sleep(2 * time.Second)

	// Try to find Follow button (may be in More dropdown)
	followBtn := ab.Page.Locator("button[aria-label*='Follow'], button:has-text('Follow')").First()
	fCount, _ := followBtn.Count()

	if fCount > 0 {
		followBtn.Click()
		time.Sleep(1 * time.Second)
		log.Printf("[Follow] ✅ Followed profile: %s", profileURL)
		return nil
	}

	// Try More dropdown
	moreBtn := ab.Page.Locator("button[aria-label='More actions']").First()
	moreCount, _ := moreBtn.Count()
	if moreCount > 0 {
		moreBtn.Click()
		time.Sleep(1 * time.Second)

		followInDrop := ab.Page.Locator(
			"div[role='menu'] span:text-is('Follow'), .artdeco-dropdown__content span:text-is('Follow')",
		).First()
		dropCount, _ := followInDrop.Count()
		if dropCount > 0 {
			followInDrop.Click()
			time.Sleep(1 * time.Second)
			log.Printf("[Follow] ✅ Followed profile from dropdown: %s", profileURL)
			return nil
		}
	}

	return fmt.Errorf("follow button not found")
}

// ═══════════════════════════════════════════════════════════════════════════════
// LikePost
// ═══════════════════════════════════════════════════════════════════════════════

func (ca *CampaignAutomation) LikePost(account *models.LinkedInAccount, postURL string) error {
	ab, err := ca.bm.CreateAuthenticatedBrowser(account, nil)
	if err != nil {
		return err
	}
	defer ab.Close()

	if postURL == "" {
		return fmt.Errorf("post URL is empty")
	}
	log.Printf("[LikePost] Liking post: %s", postURL)

	if _, err := ab.Page.Goto(postURL, playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateDomcontentloaded,
		Timeout:   playwright.Float(30000),
	}); err != nil {
		return fmt.Errorf("failed to navigate to post: %w", err)
	}
	time.Sleep(2 * time.Second)

	// Find Like button
	likeBtn := ab.Page.Locator(
		"button[aria-label*='Like'], button[aria-label*='like'], " +
			"button.react-button:not(.react-button--active)",
	).First()
	likeCount, _ := likeBtn.Count()
	if likeCount == 0 {
		return fmt.Errorf("like button not found or already liked")
	}

	likeBtn.Click()
	time.Sleep(1 * time.Second)

	log.Printf("[LikePost] ✅ Liked post: %s", postURL)
	return nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// CheckConnectionStatus
//
// Mirrors lib/linkedin-campaign-automation.ts → checkConnectionStatus()
// ═══════════════════════════════════════════════════════════════════════════════

func (ca *CampaignAutomation) CheckConnectionStatus(account *models.LinkedInAccount, lead *models.Lead) (ConnectionStatus, error) {
	ab, err := ca.bm.CreateAuthenticatedBrowser(account, nil)
	if err != nil {
		return ConnectionStatusError, err
	}
	defer ab.Close()

	profileURL := NormalizeLinkedInURL(deref(lead.LinkedInURL))
	if profileURL == "" {
		return ConnectionStatusError, fmt.Errorf("lead has no LinkedIn URL")
	}

	if _, err := ab.Page.Goto(profileURL, playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateDomcontentloaded,
		Timeout:   playwright.Float(30000),
	}); err != nil {
		return ConnectionStatusError, err
	}
	time.Sleep(2 * time.Second)

	msgCount, _ := ab.Page.Locator("button:has-text('Message')").Count()
	pendingCount, _ := ab.Page.Locator("button:has-text('Pending')").Count()
	connectCount, _ := ab.Page.Locator("button:has-text('Connect')").Count()

	if msgCount > 0 {
		return ConnectionStatusAccepted, nil
	}
	if pendingCount > 0 {
		return ConnectionStatusPending, nil
	}
	if connectCount > 0 {
		return ConnectionStatusNotConnected, nil
	}
	return ConnectionStatusError, fmt.Errorf("unable to determine connection status")
}

// ═══════════════════════════════════════════════════════════════════════════════
// ScanInboxForReplies
//
// Mirrors lib/linkedin-campaign-automation.ts → scanInboxForReplies()
// ═══════════════════════════════════════════════════════════════════════════════

// InboxReply represents a reply found in the inbox scan.
type InboxReply struct {
	ProfileURL    string `json:"profileUrl"`
	HasNewMessage bool   `json:"hasNewMessage"`
	LastMessage   string `json:"lastMessage,omitempty"`
}

func (ca *CampaignAutomation) ScanInboxForReplies(account *models.LinkedInAccount, leadURLs []string) ([]InboxReply, error) {
	ab, err := ca.bm.CreateAuthenticatedBrowser(account, nil)
	if err != nil {
		return nil, err
	}
	defer ab.Close()

	page := ab.Page

	// Navigate to messaging
	if _, err := page.Goto("https://www.linkedin.com/messaging/", playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateDomcontentloaded,
		Timeout:   playwright.Float(30000),
	}); err != nil {
		return nil, fmt.Errorf("failed to navigate to messaging: %w", err)
	}
	time.Sleep(3 * time.Second)

	var results []InboxReply

	conversations := page.Locator("ul.msg-conversations-container__conversations-list >> li")
	count, _ := conversations.Count()

	limit := count
	if limit > 50 {
		limit = 50
	}

	for i := 0; i < limit; i++ {
		conv := conversations.Nth(i)
		conv.Click()
		time.Sleep(1 * time.Second)

		// Get profile link
		profileLink, _ := page.Locator("a[href*='/in/']").First().GetAttribute("href")
		if profileLink == "" {
			continue
		}

		// Check if this profile matches any lead URL
		matched := false
		for _, url := range leadURLs {
			if strings.Contains(profileLink, url) {
				matched = true
				break
			}
		}
		if !matched {
			continue
		}

		// Check for unread badge
		unreadCount, _ := conv.Locator(".msg-conversation-card__unread-count").Count()
		hasNew := unreadCount > 0

		// Get last message
		lastMsg, _ := page.Locator("div.msg-s-event-listitem__body").Last().TextContent()
		lastMsg = strings.TrimSpace(lastMsg)

		results = append(results, InboxReply{
			ProfileURL:    profileLink,
			HasNewMessage: hasNew,
			LastMessage:   lastMsg,
		})
	}

	return results, nil
}
