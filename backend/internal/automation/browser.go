package automation

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/playwright-community/playwright-go"
	"github.com/reach/backend/internal/models"
	"github.com/reach/backend/internal/repository"
)

// ──────────────────────────────────────────────────────────────────────────────
// BrowserManager manages Playwright browser lifecycle and sessions.
//
// Go equivalent of:
//   - lib/linkedin-campaign-automation.ts → createAuthenticatedBrowser
//   - lib/linkedin-cookie-auth.ts → browser launch & cookie setup
//   - lib/linkedin-session-manager.ts → session management
// ──────────────────────────────────────────────────────────────────────────────

// BrowserManager is the central coordinator for all Playwright browser instances.
type BrowserManager struct {
	pw          *playwright.Playwright
	accountRepo *repository.LinkedInAccountRepository
}

// NewBrowserManager initialises Playwright and returns a BrowserManager.
func NewBrowserManager(accountRepo *repository.LinkedInAccountRepository) (*BrowserManager, error) {
	pw, err := playwright.Run()
	if err != nil {
		return nil, fmt.Errorf("failed to start playwright: %w", err)
	}
	return &BrowserManager{
		pw:          pw,
		accountRepo: accountRepo,
	}, nil
}

// Close shuts down the Playwright driver.
func (bm *BrowserManager) Close() {
	if bm.pw != nil {
		bm.pw.Stop()
	}
}

// ── Anti-detection launch args (shared across all browser contexts) ────────
var defaultLaunchArgs = []string{
	"--disable-blink-features=AutomationControlled",
	"--no-sandbox",
	"--disable-setuid-sandbox",
	"--disable-infobars",
	"--disable-dev-shm-usage",
	"--no-first-run",
	"--no-default-browser-check",
}

// ── AuthenticatedBrowser bundles a browser, context and page together ──────
type AuthenticatedBrowser struct {
	Browser playwright.Browser
	Context playwright.BrowserContext
	Page    playwright.Page
}

// Close cleans up all resources.
func (ab *AuthenticatedBrowser) Close() {
	if ab.Browser != nil {
		ab.Browser.Close()
	}
}

// ── CreateAuthenticatedBrowser ─────────────────────────────────────────────
// Mirrors lib/linkedin-campaign-automation.ts → createAuthenticatedBrowser():
//   1. Launch headless Chromium
//   2. Create context with anti-detection, viewport, proxy
//   3. Load cookies from account.SessionCookies (or li_at fallback)
//   4. Navigate to /feed to validate session
//   5. Falls back to credential login if session expired

func (bm *BrowserManager) CreateAuthenticatedBrowser(account *models.LinkedInAccount, proxyConf *ProxyConfig) (*AuthenticatedBrowser, error) {
	log.Printf("🌐 [Browser] Creating authenticated browser for %s", account.Email)

	// 1. Launch browser
	browser, err := bm.pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
		Headless: playwright.Bool(true),
		Args:     defaultLaunchArgs,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to launch browser: %w", err)
	}

	// 2. Build context options
	contextOpts := playwright.BrowserNewContextOptions{
		Viewport: &playwright.Size{Width: 1920, Height: 1080},
		UserAgent: playwright.String(
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
		),
		Locale:     playwright.String("en-US"),
		TimezoneId: playwright.String("America/New_York"),
	}

	// Wire proxy if available (from account or explicit param)
	if proxyConf == nil {
		proxyConf = buildProxyConfig(account)
	}
	if proxyConf != nil && proxyConf.Server != "" {
		contextOpts.Proxy = &playwright.Proxy{
			Server:   proxyConf.Server,
			Username: playwright.String(proxyConf.Username),
			Password: playwright.String(proxyConf.Password),
		}
	}

	ctx, err := browser.NewContext(contextOpts)
	if err != nil {
		browser.Close()
		return nil, fmt.Errorf("failed to create browser context: %w", err)
	}

	// Anti-detection init script
	if err := ctx.AddInitScript(playwright.Script{
		Content: playwright.String(`Object.defineProperty(navigator, 'webdriver', { get: () => false });`),
	}); err != nil {
		log.Printf("⚠️ [Browser] Failed to add init script: %v", err)
	}

	page, err := ctx.NewPage()
	if err != nil {
		browser.Close()
		return nil, fmt.Errorf("failed to create page: %w", err)
	}

	// 3. Load cookies
	cookies := buildCookiesFromAccount(account)
	if len(cookies) > 0 {
		if err := ctx.AddCookies(cookies); err != nil {
			log.Printf("⚠️ [Browser] Failed to set cookies: %v", err)
		}
	}

	// 4. Navigate to /feed to validate session
	resp, err := page.Goto("https://www.linkedin.com/feed/", playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateDomcontentloaded,
		Timeout:   playwright.Float(60000),
	})
	if err != nil && !strings.Contains(err.Error(), "timeout") {
		browser.Close()
		return nil, fmt.Errorf("navigation failed: %w", err)
	}
	_ = resp

	// Wait a bit for any redirects
	time.Sleep(3 * time.Second)

	currentURL := page.URL()
	log.Printf("📍 [Browser] Current URL after cookie load: %s", currentURL)

	// 5. Check if we landed on a login/authwall page
	if strings.Contains(currentURL, "/login") || strings.Contains(currentURL, "authwall") {
		log.Printf("⚠️ [Browser] Session cookies expired for %s — trying credential login", account.Email)

		if account.PasswordEncrypted != nil && *account.PasswordEncrypted != "" {
			if loginErr := loginWithCredentials(page, account.Email, *account.PasswordEncrypted); loginErr != nil {
				browser.Close()
				return nil, fmt.Errorf("credential login failed: %w", loginErr)
			}
			log.Printf("✅ [Browser] Credential login succeeded for %s", account.Email)
		} else {
			browser.Close()
			return nil, fmt.Errorf("session expired and no credentials available for %s", account.Email)
		}
	}

	// Verify we are on a LinkedIn page
	if !isLoggedIn(page) {
		browser.Close()
		return nil, fmt.Errorf("unable to verify LinkedIn login for %s", account.Email)
	}

	log.Printf("✅ [Browser] Authenticated browser ready for %s", account.Email)

	return &AuthenticatedBrowser{
		Browser: browser,
		Context: ctx,
		Page:    page,
	}, nil
}

// ── loginWithCredentials ───────────────────────────────────────────────────
// Mirrors lib/linkedin-campaign-automation.ts → loginWithCredentials()
func loginWithCredentials(page playwright.Page, email, password string) error {
	log.Printf("🔑 [Browser] Attempting credential login for %s", email)

	if _, err := page.Goto("https://www.linkedin.com/login", playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateDomcontentloaded,
		Timeout:   playwright.Float(30000),
	}); err != nil {
		return fmt.Errorf("failed to navigate to login: %w", err)
	}
	humanDelay(1500, 3000)

	// Wait for the login form
	if err := page.Locator("#username").WaitFor(playwright.LocatorWaitForOptions{
		Timeout: playwright.Float(10000),
	}); err != nil {
		return fmt.Errorf("login form not found: %w", err)
	}

	// Type email with human-like delays
	if err := page.Locator("#username").Click(); err != nil {
		return fmt.Errorf("failed to click username: %w", err)
	}
	humanDelay(200, 500)
	if err := page.Locator("#username").Fill(email); err != nil {
		return fmt.Errorf("failed to fill email: %w", err)
	}
	humanDelay(300, 800)

	// Type password
	if err := page.Locator("#password").Click(); err != nil {
		return fmt.Errorf("failed to click password: %w", err)
	}
	humanDelay(200, 500)
	if err := page.Locator("#password").Fill(password); err != nil {
		return fmt.Errorf("failed to fill password: %w", err)
	}
	humanDelay(500, 1500)

	// Submit
	if err := page.Locator("button[type='submit']").Click(); err != nil {
		return fmt.Errorf("failed to click submit: %w", err)
	}

	// Wait for navigation
	if err := page.WaitForURL("**/feed/**", playwright.PageWaitForURLOptions{
		Timeout: playwright.Float(15000),
	}); err != nil {
		// Check if on checkpoint
		url := page.URL()
		if strings.Contains(url, "checkpoint") || strings.Contains(url, "challenge") {
			return fmt.Errorf("2FA/checkpoint required")
		}
		if strings.Contains(url, "/login") {
			return fmt.Errorf("invalid credentials")
		}
		log.Printf("⚠️ [Browser] Navigation after login went to: %s", url)
	}

	humanDelay(2000, 3000)
	return nil
}

// ── isLoggedIn ─────────────────────────────────────────────────────────────
// Checks if the current page indicates a logged-in LinkedIn session.
func isLoggedIn(page playwright.Page) bool {
	url := page.URL()
	return strings.Contains(url, "/feed") ||
		strings.Contains(url, "/in/") ||
		strings.Contains(url, "/messaging") ||
		strings.Contains(url, "/mynetwork") ||
		(strings.Contains(url, "linkedin.com") &&
			!strings.Contains(url, "/login") &&
			!strings.Contains(url, "authwall"))
}

// ── buildCookiesFromAccount ───────────────────────────────────────────────
// Converts account.SessionCookies (JSONB) to Playwright cookie slice.
// Supports both Playwright array format and flat key-value cookies object.
func buildCookiesFromAccount(account *models.LinkedInAccount) []playwright.OptionalCookie {
	var cookies []playwright.OptionalCookie

	if account.SessionCookies == nil {
		return cookies
	}

	raw, err := json.Marshal(account.SessionCookies)
	if err != nil {
		return cookies
	}

	// Try Playwright array format first
	var pwCookies []PlaywrightCookie
	if err := json.Unmarshal(raw, &pwCookies); err == nil && len(pwCookies) > 0 && pwCookies[0].Name != "" {
		for _, c := range pwCookies {
			cookies = append(cookies, playwright.OptionalCookie{
				Name:     c.Name,
				Value:    c.Value,
				Domain:   playwright.String(c.Domain),
				Path:     playwright.String(c.Path),
				HttpOnly: playwright.Bool(c.HTTPOnly),
				Secure:   playwright.Bool(c.Secure),
				SameSite: toSameSite(c.SameSite),
			})
		}
		return cookies
	}

	// Try flat object format { "li_at": "...", "JSESSIONID": "..." }
	var flat map[string]interface{}
	if err := json.Unmarshal(raw, &flat); err == nil {
		for name, val := range flat {
			strVal := fmt.Sprintf("%v", val)
			if strVal == "" || strVal == "<nil>" {
				continue
			}
			cookies = append(cookies, playwright.OptionalCookie{
				Name:     name,
				Value:    strVal,
				Domain:   playwright.String(".linkedin.com"),
				Path:     playwright.String("/"),
				HttpOnly: playwright.Bool(true),
				Secure:   playwright.Bool(true),
				SameSite: toSameSite("Lax"),
			})
		}
	}

	return cookies
}

// toSameSite converts a string to Playwright SameSiteAttribute pointer.
func toSameSite(s string) *playwright.SameSiteAttribute {
	switch strings.ToLower(s) {
	case "strict":
		return playwright.SameSiteAttributeStrict
	case "lax":
		return playwright.SameSiteAttributeLax
	case "none":
		return playwright.SameSiteAttributeNone
	default:
		return playwright.SameSiteAttributeLax
	}
}

// ── buildProxyConfig ──────────────────────────────────────────────────────
// Extracts proxy config from a LinkedInAccount's associated Proxy record.
func buildProxyConfig(account *models.LinkedInAccount) *ProxyConfig {
	if account.Proxy == nil {
		return nil
	}
	p := account.Proxy
	server := fmt.Sprintf("%s://%s:%d", p.Type, p.Host, p.Port)
	return &ProxyConfig{
		Server:   server,
		Username: deref(p.Username),
		Password: deref(p.PasswordEncrypted),
	}
}

// ── NormalizeLinkedInURL ──────────────────────────────────────────────────
// Canonicalises a LinkedIn profile URL to https://www.linkedin.com/in/<slug>/
// Mirrors lib/linkedin-campaign-automation.ts → normalizeLinkedInUrl()
func NormalizeLinkedInURL(url string) string {
	if url == "" {
		return ""
	}
	url = strings.TrimSpace(url)

	// Remove query string & fragment
	if idx := strings.Index(url, "?"); idx != -1 {
		url = url[:idx]
	}
	if idx := strings.Index(url, "#"); idx != -1 {
		url = url[:idx]
	}

	// Ensure trailing slash
	if !strings.HasSuffix(url, "/") {
		url += "/"
	}

	// Ensure https://www. prefix
	re := regexp.MustCompile(`^https?://(www\.)?linkedin\.com`)
	if re.MatchString(url) {
		url = re.ReplaceAllString(url, "https://www.linkedin.com")
	}

	return url
}

// ── HandleAccountDisconnection ────────────────────────────────────────────
// Auto-disconnects an account when a non-transient auth error occurs.
// Mirrors lib/linkedin-campaign-automation.ts → handleAccountDisconnection()
func HandleAccountDisconnection(accountRepo *repository.LinkedInAccountRepository, accountID uuid.UUID, errMsg string) {
	if IsTransientError(errMsg) {
		log.Printf("⚡ [Browser] Transient error for account %s (not disconnecting): %s", accountID, errMsg)
		return
	}

	log.Printf("🔌 [Browser] Disconnecting account %s due to: %s", accountID, errMsg)

	err := accountRepo.UpdateFields(accountID, map[string]interface{}{
		"status":        models.AccountStatusDisconnected,
		"error_message": errMsg,
	})
	if err != nil {
		log.Printf("❌ [Browser] Failed to disconnect account %s: %v", accountID, err)
	}
}

// ── Helpers ───────────────────────────────────────────────────────────────

// humanDelay sleeps for a random duration between minMs and maxMs milliseconds.
func humanDelay(minMs, maxMs int) {
	d := minMs + rand.Intn(maxMs-minMs+1)
	time.Sleep(time.Duration(d) * time.Millisecond)
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
