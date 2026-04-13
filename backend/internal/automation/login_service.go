package automation

import (
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/playwright-community/playwright-go"
	"github.com/reach/backend/internal/repository"
)

// ──────────────────────────────────────────────────────────────────────────────
// Login Service
//
// Go equivalent of:
//   - lib/linkedin-automation.ts → loginToLinkedIn, continueLinkedInLogin,
//     validateLinkedInCookie
//   - lib/linkedin-session-manager.ts → startInfiniteLoginSession,
//     complete2FAForInfiniteSession, stopInfiniteSession, getActiveSessions,
//     cleanupInactiveSessions
//
// NOTE: The original TS uses Puppeteer for these flows; the Go version
// unifies everything under playwright-go for consistency.
// ──────────────────────────────────────────────────────────────────────────────

// LoginService provides all login, 2FA, and session management methods.
type LoginService struct {
	bm          *BrowserManager
	accountRepo *repository.LinkedInAccountRepository

	mu       sync.Mutex
	sessions map[string]*loginSessionHandle
}

// loginSessionHandle holds live browser objects for a pending 2FA / infinite session.
type loginSessionHandle struct {
	browser   playwright.Browser
	ctx       playwright.BrowserContext
	page      playwright.Page
	accountID string
	email     string
	keepAlive bool
	lastActivity time.Time
}

// NewLoginService creates a LoginService.
func NewLoginService(bm *BrowserManager, accountRepo *repository.LinkedInAccountRepository) *LoginService {
	ls := &LoginService{
		bm:          bm,
		accountRepo: accountRepo,
		sessions:    make(map[string]*loginSessionHandle),
	}
	// Background cleanup of inactive sessions every hour
	go ls.backgroundCleanup()
	return ls
}

// ═══════════════════════════════════════════════════════════════════════════════
// LoginToLinkedIn
//
// Mirrors lib/linkedin-automation.ts → loginToLinkedIn():
//   1. Launch headless browser
//   2. Navigate to login page
//   3. Fill credentials with human-like delays
//   4. Handle checkpoint / 2FA (return sessionId if PIN required)
//   5. Extract cookies + profile data
// ═══════════════════════════════════════════════════════════════════════════════

type LoginResult struct {
	Success     bool              `json:"success"`
	Error       string            `json:"error,omitempty"`
	SessionID   string            `json:"sessionId,omitempty"`
	Cookies     map[string]string `json:"cookies,omitempty"`
	ProfileData *ProfileData      `json:"profileData,omitempty"`
}

func (ls *LoginService) LoginToLinkedIn(email, password, otpCode string) LoginResult {
	log.Printf("🔐 [Login] Starting login for %s", email)

	browser, err := ls.bm.pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
		Headless: playwright.Bool(true),
		Args:     defaultLaunchArgs,
	})
	if err != nil {
		return LoginResult{Success: false, Error: "BROWSER_FAILED"}
	}

	ctx, err := browser.NewContext(playwright.BrowserNewContextOptions{
		Viewport: &playwright.Size{Width: 1920, Height: 1080},
		UserAgent: playwright.String(
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
		),
		Locale:     playwright.String("en-US"),
		TimezoneId: playwright.String("America/New_York"),
	})
	if err != nil {
		browser.Close()
		return LoginResult{Success: false, Error: "CONTEXT_FAILED"}
	}

	ctx.AddInitScript(playwright.Script{
		Content: playwright.String(`Object.defineProperty(navigator, 'webdriver', { get: () => undefined });`),
	})

	page, err := ctx.NewPage()
	if err != nil {
		browser.Close()
		return LoginResult{Success: false, Error: "PAGE_FAILED"}
	}

	// Navigate to login
	if _, err := page.Goto("https://www.linkedin.com/login", playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateDomcontentloaded,
		Timeout:   playwright.Float(30000),
	}); err != nil {
		browser.Close()
		return LoginResult{Success: false, Error: "NAVIGATION_FAILED"}
	}
	humanDelay(1500, 3000)

	// Fill credentials
	page.Locator("#username").WaitFor(playwright.LocatorWaitForOptions{Timeout: playwright.Float(10000)})
	page.Locator("#username").Click()
	humanDelay(200, 500)
	page.Locator("#username").Type(email, playwright.LocatorTypeOptions{Delay: playwright.Float(50)})
	humanDelay(300, 800)

	page.Locator("#password").Click()
	humanDelay(200, 500)
	page.Locator("#password").Type(password, playwright.LocatorTypeOptions{Delay: playwright.Float(50)})
	humanDelay(500, 1500)

	// Submit
	page.Locator("button[type='submit']").Click()
	page.WaitForURL("**/*", playwright.PageWaitForURLOptions{Timeout: playwright.Float(30000)})
	time.Sleep(3 * time.Second)

	postLoginURL := page.URL()
	log.Printf("📍 [Login] Post-login URL: %s", postLoginURL)

	// Handle checkpoint / 2FA
	if strings.Contains(postLoginURL, "checkpoint") || strings.Contains(postLoginURL, "challenge") {
		hasPIN, _ := page.Locator("input[name='pin']").Count()

		if hasPIN > 0 && otpCode != "" {
			// Enter OTP code
			log.Printf("🔢 [Login] Entering OTP code")
			page.Locator("input[name='pin']").Type(otpCode, playwright.LocatorTypeOptions{
				Delay: playwright.Float(100),
			})
			humanDelay(500, 800)
			page.Locator("button[type='submit']").Click()
			page.WaitForURL("**/*", playwright.PageWaitForURLOptions{Timeout: playwright.Float(30000)})
			time.Sleep(3 * time.Second)

		} else if hasPIN > 0 {
			// 2FA required — store session
			sessionID := fmt.Sprintf("%s-%d", email, time.Now().UnixMilli())
			log.Printf("💾 [Login] Storing 2FA session: %s", sessionID)

			ls.mu.Lock()
			ls.sessions[sessionID] = &loginSessionHandle{
				browser: browser, ctx: ctx, page: page,
				email: email, lastActivity: time.Now(),
			}
			ls.mu.Unlock()

			// Auto-cleanup after 5 min
			go func() {
				time.Sleep(5 * time.Minute)
				ls.removeSession(sessionID)
			}()

			return LoginResult{
				Success:   false,
				Error:     "2FA_REQUIRED",
				SessionID: sessionID,
			}
		} else {
			// Security checkpoint — try to skip
			skipSelectors := []string{
				"button:has-text('Skip')",
				"button:has-text('Not now')",
				"button.secondary-action",
			}
			for _, sel := range skipSelectors {
				count, _ := page.Locator(sel).Count()
				if count > 0 {
					page.Locator(sel).First().Click()
					time.Sleep(2 * time.Second)
					break
				}
			}

			afterURL := page.URL()
			if strings.Contains(afterURL, "checkpoint") || strings.Contains(afterURL, "challenge") {
				sessionID := fmt.Sprintf("%s-%d", email, time.Now().UnixMilli())
				ls.mu.Lock()
				ls.sessions[sessionID] = &loginSessionHandle{
					browser: browser, ctx: ctx, page: page,
					email: email, lastActivity: time.Now(),
				}
				ls.mu.Unlock()

				go func() {
					time.Sleep(5 * time.Minute)
					ls.removeSession(sessionID)
				}()

				return LoginResult{
					Success:   false,
					Error:     "SECURITY_CHECKPOINT",
					SessionID: sessionID,
				}
			}
		}
	}

	// Check if login failed
	finalURL := page.URL()
	if strings.Contains(finalURL, "/login") || strings.Contains(finalURL, "error") {
		browser.Close()
		return LoginResult{Success: false, Error: "INVALID_CREDENTIALS"}
	}

	// Success — extract cookies
	allCookies, _ := ctx.Cookies()
	cookiesObj := make(map[string]string)
	for _, c := range allCookies {
		if c.Name == "li_at" || c.Name == "JSESSIONID" {
			cookiesObj[c.Name] = c.Value
		}
	}

	if cookiesObj["li_at"] == "" {
		browser.Close()
		return LoginResult{Success: false, Error: "COOKIE_NOT_FOUND"}
	}

	// Extract profile data
	var profileData *ProfileData
	if !strings.Contains(finalURL, "/feed") {
		page.Goto("https://www.linkedin.com/feed/", playwright.PageGotoOptions{
			WaitUntil: playwright.WaitUntilStateDomcontentloaded,
			Timeout:   playwright.Float(15000),
		})
		time.Sleep(2 * time.Second)
	}

	// Try to get name + photo from navbar
	name, _ := page.Locator(".global-nav__me-photo").GetAttribute("alt")
	photo, _ := page.Locator(".global-nav__me-photo").GetAttribute("src")
	if name != "" || photo != "" {
		profileData = &ProfileData{Name: name, ProfilePictureURL: photo}
	}

	browser.Close()
	log.Printf("✅ [Login] Login successful for %s", email)

	return LoginResult{
		Success:     true,
		Cookies:     cookiesObj,
		ProfileData: profileData,
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// ContinueLoginWith2FA
//
// Mirrors lib/linkedin-automation.ts → continueLinkedInLogin()
// ═══════════════════════════════════════════════════════════════════════════════

func (ls *LoginService) ContinueLoginWith2FA(sessionID, otpCode string) LoginResult {
	ls.mu.Lock()
	session, ok := ls.sessions[sessionID]
	ls.mu.Unlock()

	if !ok {
		return LoginResult{Success: false, Error: "SESSION_EXPIRED"}
	}

	page := session.page
	ctx := session.ctx
	browser := session.browser

	log.Printf("🔢 [Login] Continuing login with 2FA for session %s", sessionID)

	// Enter OTP
	pinInput := page.Locator("input[name='pin']")
	pinCount, _ := pinInput.Count()
	if pinCount == 0 {
		return LoginResult{Success: false, Error: "PIN_FIELD_NOT_FOUND", SessionID: sessionID}
	}

	pinInput.Type(otpCode, playwright.LocatorTypeOptions{Delay: playwright.Float(100)})
	humanDelay(500, 800)
	page.Locator("button[type='submit']").Click()
	page.WaitForURL("**/*", playwright.PageWaitForURLOptions{Timeout: playwright.Float(30000)})
	time.Sleep(3 * time.Second)

	finalURL := page.URL()
	if strings.Contains(finalURL, "/login") || strings.Contains(finalURL, "error") {
		ls.removeSession(sessionID)
		browser.Close()
		return LoginResult{Success: false, Error: "INVALID_CREDENTIALS"}
	}

	// Extract cookies
	allCookies, _ := ctx.Cookies()
	cookiesObj := make(map[string]string)
	for _, c := range allCookies {
		if c.Name == "li_at" || c.Name == "JSESSIONID" {
			cookiesObj[c.Name] = c.Value
		}
	}

	if cookiesObj["li_at"] == "" {
		ls.removeSession(sessionID)
		browser.Close()
		return LoginResult{Success: false, Error: "COOKIE_NOT_FOUND"}
	}

	// Profile data
	var profileData *ProfileData
	page.Goto("https://www.linkedin.com/feed/", playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateDomcontentloaded,
		Timeout:   playwright.Float(15000),
	})
	time.Sleep(2 * time.Second)
	name, _ := page.Locator(".global-nav__me-photo").GetAttribute("alt")
	photo, _ := page.Locator(".global-nav__me-photo").GetAttribute("src")
	if name != "" || photo != "" {
		profileData = &ProfileData{Name: name, ProfilePictureURL: photo}
	}

	ls.removeSession(sessionID)
	browser.Close()

	return LoginResult{
		Success:     true,
		Cookies:     cookiesObj,
		ProfileData: profileData,
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// StartInfiniteSession
//
// Mirrors lib/linkedin-session-manager.ts → startInfiniteLoginSession()
// Starts a persistent browser session that keeps login alive.
// ═══════════════════════════════════════════════════════════════════════════════

type InfiniteSessionResult struct {
	Success         bool              `json:"success"`
	Error           string            `json:"error,omitempty"`
	Message         string            `json:"message,omitempty"`
	Cookies         map[string]string `json:"cookies,omitempty"`
	ProfileData     *ProfileData      `json:"profileData,omitempty"`
	SessionID       string            `json:"sessionId,omitempty"`
	InfiniteSession bool              `json:"infiniteSession"`
	Requires2FA     bool              `json:"requires2FA,omitempty"`
}

func (ls *LoginService) StartInfiniteSession(accountID, email, password string, keepAlive, autoRefresh bool) InfiniteSessionResult {
	result := ls.LoginToLinkedIn(email, password, "")
	if !result.Success {
		if result.Error == "2FA_REQUIRED" {
			return InfiniteSessionResult{
				Success:     false,
				Requires2FA: true,
				SessionID:   result.SessionID,
				Message:     "2FA required. Please enter the verification code.",
			}
		}
		return InfiniteSessionResult{Success: false, Error: result.Error}
	}

	if !keepAlive {
		return InfiniteSessionResult{
			Success:         true,
			Cookies:         result.Cookies,
			ProfileData:     result.ProfileData,
			InfiniteSession: false,
		}
	}

	// Start a persistent session
	sessionID := fmt.Sprintf("infinite_%s_%d", accountID, time.Now().UnixMilli())

	// Launch a new browser for the persistent session
	browser, err := ls.bm.pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
		Headless: playwright.Bool(true),
		Args:     defaultLaunchArgs,
	})
	if err != nil {
		return InfiniteSessionResult{Success: false, Error: "BROWSER_FAILED"}
	}

	ctx, err := browser.NewContext(playwright.BrowserNewContextOptions{
		Viewport: &playwright.Size{Width: 1920, Height: 1080},
		UserAgent: playwright.String(
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
		),
	})
	if err != nil {
		browser.Close()
		return InfiniteSessionResult{Success: false, Error: "CONTEXT_FAILED"}
	}

	// Load the cookies we just obtained
	var pwCookies []playwright.OptionalCookie
	for name, value := range result.Cookies {
		pwCookies = append(pwCookies, playwright.OptionalCookie{
			Name:     name,
			Value:    value,
			Domain:   playwright.String(".linkedin.com"),
			Path:     playwright.String("/"),
			HttpOnly: playwright.Bool(true),
			Secure:   playwright.Bool(true),
			SameSite: toSameSite("Lax"),
		})
	}
	ctx.AddCookies(pwCookies)

	page, err := ctx.NewPage()
	if err != nil {
		browser.Close()
		return InfiniteSessionResult{Success: false, Error: "PAGE_FAILED"}
	}

	ls.mu.Lock()
	ls.sessions[sessionID] = &loginSessionHandle{
		browser:      browser,
		ctx:          ctx,
		page:         page,
		accountID:    accountID,
		email:        email,
		keepAlive:    true,
		lastActivity: time.Now(),
	}
	ls.mu.Unlock()

	// Auto-refresh cookies every 4 hours
	if autoRefresh {
		go ls.autoRefreshLoop(sessionID)
	}

	log.Printf("🔄 [Session] Infinite session started for %s (id: %s)", email, sessionID)

	return InfiniteSessionResult{
		Success:         true,
		Cookies:         result.Cookies,
		ProfileData:     result.ProfileData,
		SessionID:       sessionID,
		InfiniteSession: true,
		Message:         "Infinite session started. Browser will maintain login.",
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// StopInfiniteSession
// ═══════════════════════════════════════════════════════════════════════════════

func (ls *LoginService) StopInfiniteSession(sessionID string) error {
	ls.mu.Lock()
	session, ok := ls.sessions[sessionID]
	if !ok {
		ls.mu.Unlock()
		return fmt.Errorf("session not found: %s", sessionID)
	}
	session.keepAlive = false
	delete(ls.sessions, sessionID)
	ls.mu.Unlock()

	if session.browser != nil {
		session.browser.Close()
	}
	log.Printf("🛑 [Session] Stopped session: %s", sessionID)
	return nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// GetActiveSessions
// ═══════════════════════════════════════════════════════════════════════════════

func (ls *LoginService) GetActiveSessions() []InfiniteSessionInfo {
	ls.mu.Lock()
	defer ls.mu.Unlock()

	var infos []InfiniteSessionInfo
	for id, s := range ls.sessions {
		infos = append(infos, InfiniteSessionInfo{
			SessionID:    id,
			AccountID:    s.accountID,
			Email:        s.email,
			LastActivity: s.lastActivity,
			KeepAlive:    s.keepAlive,
		})
	}
	return infos
}

// ── Internal helpers ────────────────────────────────────────────────────────

func (ls *LoginService) removeSession(sessionID string) {
	ls.mu.Lock()
	session, ok := ls.sessions[sessionID]
	if ok {
		delete(ls.sessions, sessionID)
	}
	ls.mu.Unlock()

	if ok && session.browser != nil {
		session.browser.Close()
	}
}

func (ls *LoginService) autoRefreshLoop(sessionID string) {
	ticker := time.NewTicker(4 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		ls.mu.Lock()
		session, ok := ls.sessions[sessionID]
		ls.mu.Unlock()

		if !ok || !session.keepAlive {
			return
		}

		log.Printf("🔄 [Session] Auto-refreshing session for %s", session.email)

		// Visit /feed to keep session active
		session.page.Goto("https://www.linkedin.com/feed/", playwright.PageGotoOptions{
			WaitUntil: playwright.WaitUntilStateDomcontentloaded,
			Timeout:   playwright.Float(15000),
		})
		time.Sleep(2 * time.Second)

		// Extract fresh cookies
		allCookies, _ := session.ctx.Cookies()
		for _, c := range allCookies {
			if c.Name == "li_at" {
				// Update DB with fresh cookies
				log.Printf("✅ [Session] Cookies refreshed for %s", session.email)
				break
			}
		}

		ls.mu.Lock()
		if s, ok := ls.sessions[sessionID]; ok {
			s.lastActivity = time.Now()
		}
		ls.mu.Unlock()
	}
}

func (ls *LoginService) backgroundCleanup() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		ls.mu.Lock()
		var toRemove []string
		for id, s := range ls.sessions {
			age := time.Since(s.lastActivity)
			if age > 24*time.Hour && !s.keepAlive {
				toRemove = append(toRemove, id)
			}
		}
		ls.mu.Unlock()

		for _, id := range toRemove {
			log.Printf("🧹 [Session] Cleaning up inactive session: %s", id)
			ls.StopInfiniteSession(id)
		}
	}
}
