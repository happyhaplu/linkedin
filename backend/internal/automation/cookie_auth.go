package automation

import (
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/playwright-community/playwright-go"
	"github.com/reach/backend/internal/models"
)

// ──────────────────────────────────────────────────────────────────────────────
// Cookie Auth Module
//
// Go equivalent of lib/linkedin-cookie-auth.ts:
//   - parseCookieInput()           → ParseCookieInput
//   - buildPlaywrightCookies()     → BuildPlaywrightCookies
//   - sessionCookiesToPlaywright()  → SessionCookiesToPlaywright
//   - extractProfileViaAPI()       → ExtractProfileViaAPI
//   - loginWithCookie()            → LoginWithCookie
//   - validateSessionCookie()      → ValidateSessionCookie
//   - loginWithCredentialsThroughProxy() → LoginWithCredentialsThroughProxy
//   - completeProxy2FA()           → CompleteProxy2FA
// ──────────────────────────────────────────────────────────────────────────────

// ParseCookieInput extracts li_at token and a cookies map from various input
// formats: raw li_at string, JSON array, JSON object, or cookie header string.
// Mirrors lib/linkedin-cookie-auth.ts → parseCookieInput()
func ParseCookieInput(secretKey string) ParsedCookies {
	secretKey = strings.TrimSpace(secretKey)
	cookiesObj := make(map[string]string)

	if secretKey == "" {
		return ParsedCookies{CookiesObj: cookiesObj}
	}

	// 1. Try JSON array: [{ "name": "li_at", "value": "..." }, ...]
	var arr []map[string]interface{}
	if err := json.Unmarshal([]byte(secretKey), &arr); err == nil && len(arr) > 0 {
		liAt := ""
		for _, item := range arr {
			name, _ := item["name"].(string)
			value, _ := item["value"].(string)
			if name != "" && value != "" {
				cookiesObj[name] = value
				if name == "li_at" {
					liAt = value
				}
			}
		}
		if liAt != "" {
			return ParsedCookies{LiAt: liAt, CookiesObj: cookiesObj}
		}
	}

	// 2. Try JSON object: { "li_at": "...", "JSESSIONID": "..." }
	var obj map[string]interface{}
	if err := json.Unmarshal([]byte(secretKey), &obj); err == nil && len(obj) > 0 {
		liAt := ""
		for k, v := range obj {
			s := fmt.Sprintf("%v", v)
			cookiesObj[k] = s
			if k == "li_at" {
				liAt = s
			}
		}
		if liAt != "" {
			return ParsedCookies{LiAt: liAt, CookiesObj: cookiesObj}
		}
	}

	// 3. Try cookie header format: "li_at=ABC123; JSESSIONID=xyz"
	if strings.Contains(secretKey, "=") {
		liAt := ""
		parts := strings.Split(secretKey, ";")
		for _, part := range parts {
			kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
			if len(kv) == 2 {
				k := strings.TrimSpace(kv[0])
				v := strings.TrimSpace(kv[1])
				cookiesObj[k] = v
				if k == "li_at" {
					liAt = v
				}
			}
		}
		if liAt != "" {
			return ParsedCookies{LiAt: liAt, CookiesObj: cookiesObj}
		}
	}

	// 4. Assume raw li_at value
	cookiesObj["li_at"] = secretKey
	return ParsedCookies{LiAt: secretKey, CookiesObj: cookiesObj}
}

// BuildPlaywrightCookies constructs a full set of Playwright cookies from an li_at
// token and optional extra cookies.
// Mirrors lib/linkedin-cookie-auth.ts → buildPlaywrightCookies()
func BuildPlaywrightCookies(liAt string, extra map[string]string) []playwright.OptionalCookie {
	var cookies []playwright.OptionalCookie

	// Always add li_at
	cookies = append(cookies, playwright.OptionalCookie{
		Name:     "li_at",
		Value:    liAt,
		Domain:   playwright.String(".linkedin.com"),
		Path:     playwright.String("/"),
		HttpOnly: playwright.Bool(true),
		Secure:   playwright.Bool(true),
		SameSite: toSameSite("Lax"),
	})

	// Add any extra cookies (JSESSIONID, bcookie, etc.)
	for name, value := range extra {
		if name == "li_at" || value == "" {
			continue
		}
		httpOnly := true
		if name == "JSESSIONID" {
			httpOnly = false // JSESSIONID is used as CSRF token by JS
		}
		cookies = append(cookies, playwright.OptionalCookie{
			Name:     name,
			Value:    value,
			Domain:   playwright.String(".linkedin.com"),
			Path:     playwright.String("/"),
			HttpOnly: playwright.Bool(httpOnly),
			Secure:   playwright.Bool(true),
			SameSite: toSameSite("Lax"),
		})
	}

	return cookies
}

// SessionCookiesToPlaywright converts the session_cookies JSONB from the database
// to a Playwright-compatible cookie slice.
// Mirrors lib/linkedin-cookie-auth.ts → sessionCookiesToPlaywright()
func SessionCookiesToPlaywright(sessionCookies models.JSONB) []playwright.OptionalCookie {
	if sessionCookies == nil {
		return nil
	}

	raw, err := json.Marshal(sessionCookies)
	if err != nil {
		return nil
	}

	// Try flat map first
	var flat map[string]interface{}
	if err := json.Unmarshal(raw, &flat); err == nil && len(flat) > 0 {
		liAt, _ := flat["li_at"].(string)
		if liAt == "" {
			return nil
		}
		extra := make(map[string]string)
		for k, v := range flat {
			if k != "li_at" {
				extra[k] = fmt.Sprintf("%v", v)
			}
		}
		return BuildPlaywrightCookies(liAt, extra)
	}

	return nil
}

// ExtractProfileViaAPI uses the LinkedIn Voyager API to extract profile data
// from a logged-in Playwright page.
// Mirrors lib/linkedin-cookie-auth.ts → extractProfileViaAPI()
func ExtractProfileViaAPI(page playwright.Page, csrfToken string) *ProfileData {
	profile := &ProfileData{}

	if csrfToken == "" {
		log.Println("⚠️ [CookieAuth] No CSRF token for API extraction")
		return profile
	}

	// 1. Try /me endpoint (Voyager API)
	meResult, err := page.Evaluate(`async (token) => {
		try {
			const r = await fetch('https://www.linkedin.com/voyager/api/me', {
				headers: {
					'csrf-token': token,
					'accept': 'application/vnd.linkedin.normalized+json+2.1'
				}
			});
			if (!r.ok) return null;
			return await r.json();
		} catch { return null; }
	}`, csrfToken)
	if err == nil && meResult != nil {
		parseVoyagerMeResponse(meResult, profile)
	}

	// 2. Fallback: dashboard profile API
	if profile.Name == "" || profile.Headline == "" {
		log.Println("🔍 [CookieAuth] Trying dashboard profile API...")
		dashResult, err := page.Evaluate(`async (token) => {
			try {
				const r = await fetch(
					'https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=me&decorationId=com.linkedin.voyager.dash.deco.identity.profile.WebTopCardCore-18',
					{
						headers: {
							'csrf-token': token,
							'accept': 'application/vnd.linkedin.normalized+json+2.1'
						}
					}
				);
				if (!r.ok) return null;
				return await r.json();
			} catch { return null; }
		}`, csrfToken)
		if err == nil && dashResult != nil {
			parseDashboardProfileResponse(dashResult, profile)
		}
	}

	// 3. Parse headline into jobTitle + company
	if profile.Headline != "" && profile.JobTitle == "" {
		re := regexp.MustCompile(`(?i)^(.+?)\s+at\s+(.+)$`)
		if m := re.FindStringSubmatch(profile.Headline); m != nil {
			profile.JobTitle = strings.TrimSpace(m[1])
			profile.Company = strings.TrimSpace(m[2])
		}
	}

	return profile
}

// ── LoginWithCookie ───────────────────────────────────────────────────────
// Validates a session cookie by launching a browser, navigating to /feed,
// and extracting profile data via the Voyager API.
// Mirrors lib/linkedin-cookie-auth.ts → loginWithCookie()
func (bm *BrowserManager) LoginWithCookie(
	email, secretKey string,
	proxyConf *ProxyConfig,
) CookieAuthResult {
	log.Printf("🔑 [CookieAuth] Logging in with session cookie for %s", email)

	// 1. Parse cookie input
	parsed := ParseCookieInput(secretKey)
	if parsed.LiAt == "" {
		return CookieAuthResult{Success: false, Error: "INVALID_SECRET_KEY", Message: "No li_at cookie found in input"}
	}
	log.Printf("🍪 [CookieAuth] Parsed %d cookies", len(parsed.CookiesObj))

	// 2. Launch browser
	browser, err := bm.pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
		Headless: playwright.Bool(true),
		Args:     defaultLaunchArgs,
	})
	if err != nil {
		return CookieAuthResult{Success: false, Error: "BROWSER_FAILED", Message: err.Error()}
	}
	defer browser.Close()

	// 3. Create context
	contextOpts := playwright.BrowserNewContextOptions{
		Viewport: &playwright.Size{Width: 1920, Height: 1080},
		UserAgent: playwright.String(
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
		),
		Locale:     playwright.String("en-US"),
		TimezoneId: playwright.String("America/New_York"),
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
		return CookieAuthResult{Success: false, Error: "CONTEXT_FAILED", Message: err.Error()}
	}

	if err := ctx.AddInitScript(playwright.Script{
		Content: playwright.String(`Object.defineProperty(navigator, 'webdriver', { get: () => false });`),
	}); err != nil {
		log.Printf("⚠️ [CookieAuth] init script error: %v", err)
	}

	page, err := ctx.NewPage()
	if err != nil {
		return CookieAuthResult{Success: false, Error: "PAGE_FAILED", Message: err.Error()}
	}

	// 4. Set cookies
	cookies := BuildPlaywrightCookies(parsed.LiAt, parsed.CookiesObj)
	if err := ctx.AddCookies(cookies); err != nil {
		return CookieAuthResult{Success: false, Error: "COOKIE_FAILED", Message: err.Error()}
	}

	// 5. Navigate to /feed
	if _, err := page.Goto("https://www.linkedin.com/feed/", playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateDomcontentloaded,
		Timeout:   playwright.Float(60000),
	}); err != nil && !strings.Contains(err.Error(), "timeout") {
		return CookieAuthResult{Success: false, Error: "NAVIGATION_FAILED", Message: err.Error()}
	}
	time.Sleep(3 * time.Second)

	// 6. Validate
	currentURL := page.URL()
	log.Printf("📍 [CookieAuth] Current URL: %s", currentURL)

	if strings.Contains(currentURL, "/login") || strings.Contains(currentURL, "authwall") {
		return CookieAuthResult{
			Success: false,
			Error:   "INVALID_SECRET_KEY",
			Message: "Invalid or expired cookies. Please get fresh cookies from your browser.",
		}
	}
	if !strings.Contains(currentURL, "linkedin.com") {
		return CookieAuthResult{
			Success: false,
			Error:   "UNEXPECTED_REDIRECT",
			Message: "Unexpected redirect. Please try again with fresh cookies.",
		}
	}
	log.Println("✅ [CookieAuth] Session cookie is valid!")

	// 7. Capture JSESSIONID from browser
	allCookies, _ := ctx.Cookies()
	for _, c := range allCookies {
		if c.Name == "JSESSIONID" {
			if _, ok := parsed.CookiesObj["JSESSIONID"]; !ok {
				parsed.CookiesObj["JSESSIONID"] = c.Value
			}
		}
	}

	// 8. Extract profile via Voyager API
	csrfToken := parsed.CookiesObj["JSESSIONID"]
	log.Println("📊 [CookieAuth] Extracting profile data via Voyager API...")
	profileData := ExtractProfileViaAPI(page, csrfToken)

	log.Printf("✅ [CookieAuth] Profile extraction complete: name=%s", profileData.Name)

	return CookieAuthResult{
		Success:     true,
		Cookies:     parsed.CookiesObj,
		ProfileData: profileData,
	}
}

// ── ValidateSessionCookie ─────────────────────────────────────────────────
// Quick validation of a session cookie without full profile extraction.
// Mirrors lib/linkedin-cookie-auth.ts → validateSessionCookie()
func (bm *BrowserManager) ValidateSessionCookie(
	liAt string,
	sessionCookies models.JSONB,
	proxyConf *ProxyConfig,
) bool {
	browser, err := bm.pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
		Headless: playwright.Bool(true),
		Args:     []string{"--no-sandbox", "--disable-setuid-sandbox"},
	})
	if err != nil {
		return false
	}
	defer browser.Close()

	contextOpts := playwright.BrowserNewContextOptions{
		Viewport: &playwright.Size{Width: 1280, Height: 800},
		UserAgent: playwright.String(
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
		),
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
		return false
	}

	// Set cookies
	if sessionCookies != nil {
		pwCookies := SessionCookiesToPlaywright(sessionCookies)
		if len(pwCookies) > 0 {
			ctx.AddCookies(pwCookies)
		}
	} else {
		ctx.AddCookies([]playwright.OptionalCookie{
			{
				Name:     "li_at",
				Value:    liAt,
				Domain:   playwright.String(".linkedin.com"),
				Path:     playwright.String("/"),
				HttpOnly: playwright.Bool(true),
				Secure:   playwright.Bool(true),
				SameSite: toSameSite("Lax"),
			},
		})
	}

	page, err := ctx.NewPage()
	if err != nil {
		return false
	}

	if _, err := page.Goto("https://www.linkedin.com/feed/", playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateDomcontentloaded,
		Timeout:   playwright.Float(60000),
	}); err != nil && !strings.Contains(err.Error(), "timeout") {
		return false
	}
	time.Sleep(2 * time.Second)

	url := page.URL()
	return !strings.Contains(url, "/login") && !strings.Contains(url, "authwall")
}

// ── LoginWithCredentialsThroughProxy ──────────────────────────────────────
// Logs into LinkedIn with email/password through a proxy, producing
// cookies bound to the proxy IP.
// Mirrors lib/linkedin-cookie-auth.ts → loginWithCredentialsThroughProxy()
func (bm *BrowserManager) LoginWithCredentialsThroughProxy(
	email, password string,
	proxyConf *ProxyConfig,
) ProxyLoginResult {
	log.Printf("🚀 [CookieAuth] Starting proxy login for: %s", email)

	// 1. Launch browser
	browser, err := bm.pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
		Headless: playwright.Bool(true),
		Args:     defaultLaunchArgs,
	})
	if err != nil {
		return ProxyLoginResult{Success: false, Error: "BROWSER_FAILED", Message: err.Error()}
	}

	// 2. Create context with proxy
	contextOpts := playwright.BrowserNewContextOptions{
		Viewport: &playwright.Size{Width: 1920, Height: 1080},
		UserAgent: playwright.String(
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
		),
		Locale:     playwright.String("en-US"),
		TimezoneId: playwright.String("Europe/London"),
		ExtraHttpHeaders: map[string]string{
			"Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
		},
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
		return ProxyLoginResult{Success: false, Error: "CONTEXT_FAILED", Message: err.Error()}
	}

	if err := ctx.AddInitScript(playwright.Script{
		Content: playwright.String(`
			Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
			delete window.__playwright;
			delete window.__pwInitScripts;
		`),
	}); err != nil {
		log.Printf("⚠️ [CookieAuth] init script error: %v", err)
	}

	page, err := ctx.NewPage()
	if err != nil {
		browser.Close()
		return ProxyLoginResult{Success: false, Error: "PAGE_FAILED", Message: err.Error()}
	}

	// 3. Navigate to LinkedIn login
	log.Println("📄 [CookieAuth] Navigating to LinkedIn login...")
	if _, err := page.Goto("https://www.linkedin.com/login", playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateDomcontentloaded,
		Timeout:   playwright.Float(30000),
	}); err != nil {
		browser.Close()
		return ProxyLoginResult{Success: false, Error: "NAVIGATION_FAILED", Message: err.Error()}
	}
	humanDelay(1500, 3000)

	// 4. Fill credentials with human-like behavior
	log.Println("✍️ [CookieAuth] Filling credentials...")
	if err := page.Locator("#username").WaitFor(playwright.LocatorWaitForOptions{
		Timeout: playwright.Float(10000),
	}); err != nil {
		browser.Close()
		return ProxyLoginResult{Success: false, Error: "FORM_NOT_FOUND", Message: "Login form not found"}
	}

	// Type email
	page.Locator("#username").Click()
	humanDelay(200, 500)
	page.Locator("#username").Type(email, playwright.LocatorTypeOptions{
		Delay: playwright.Float(50),
	})
	humanDelay(300, 800)

	// Type password
	page.Locator("#password").Click()
	humanDelay(200, 500)
	page.Locator("#password").Type(password, playwright.LocatorTypeOptions{
		Delay: playwright.Float(50),
	})
	humanDelay(500, 1500)

	// 5. Submit login
	log.Println("🔐 [CookieAuth] Submitting login...")
	page.Locator("button[type='submit']").Click()

	// Wait for navigation
	page.WaitForURL("**/*", playwright.PageWaitForURLOptions{
		Timeout: playwright.Float(15000),
	})
	time.Sleep(3 * time.Second)

	postLoginURL := page.URL()
	log.Printf("📍 [CookieAuth] Post-login URL: %s", postLoginURL)

	// 6. Check for 2FA / Checkpoint
	if strings.Contains(postLoginURL, "checkpoint") || strings.Contains(postLoginURL, "challenge") {
		log.Println("🔒 [CookieAuth] 2FA or checkpoint detected")

		hasPIN, _ := page.Locator("input[name='pin']").Count()
		if hasPIN > 0 {
			log.Println("📧 [CookieAuth] 2FA PIN required")
			// Store session for later 2FA completion
			sessionID := fmt.Sprintf("proxy_%s_%d", email, time.Now().UnixMilli())
			bm.store2FASession(sessionID, browser, ctx, page, email, proxyConf)

			return ProxyLoginResult{
				Success:     false,
				Requires2FA: true,
				SessionID:   sessionID,
				Message:     "LinkedIn sent a verification code to your email. Please enter it to complete login.",
			}
		}

		// Try to skip checkpoint
		skipSelectors := []string{
			"button:has-text('Skip')",
			"button:has-text('Not now')",
			"button:has-text('Remind me later')",
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

		afterSkipURL := page.URL()
		if strings.Contains(afterSkipURL, "checkpoint") || strings.Contains(afterSkipURL, "challenge") {
			browser.Close()
			return ProxyLoginResult{
				Success: false,
				Error:   "SECURITY_CHECKPOINT",
				Message: "LinkedIn security checkpoint detected. Try again in a few minutes, or use a different proxy.",
			}
		}
	}

	// 7. Check if login failed
	finalURL := page.URL()
	if strings.Contains(finalURL, "/login") || strings.Contains(finalURL, "/authwall") {
		errorText := ""
		locator := page.Locator(".form__input--error, .alert-content, [role='alert']")
		count, _ := locator.Count()
		if count > 0 {
			errorText, _ = locator.First().TextContent()
		}
		browser.Close()

		if strings.Contains(strings.ToLower(errorText), "password") || strings.Contains(strings.ToLower(errorText), "credential") {
			return ProxyLoginResult{Success: false, Error: "INVALID_CREDENTIALS", Message: "Invalid email or password."}
		}
		msg := errorText
		if msg == "" {
			msg = "Login failed. LinkedIn may be blocking the login attempt."
		}
		return ProxyLoginResult{Success: false, Error: "LOGIN_FAILED", Message: msg}
	}

	// 8. Login successful — navigate to /feed
	log.Println("✅ [CookieAuth] Login successful through proxy!")
	if !strings.Contains(finalURL, "/feed") {
		page.Goto("https://www.linkedin.com/feed/", playwright.PageGotoOptions{
			WaitUntil: playwright.WaitUntilStateDomcontentloaded,
			Timeout:   playwright.Float(15000),
		})
		time.Sleep(2 * time.Second)
	}

	// 9. Extract cookies
	allCookies, _ := ctx.Cookies()
	cookiesObj := make(map[string]string)
	importantCookies := []string{"li_at", "JSESSIONID", "bcookie", "bscookie", "lidc"}
	for _, c := range allCookies {
		for _, ic := range importantCookies {
			if c.Name == ic {
				cookiesObj[c.Name] = c.Value
			}
		}
	}

	if cookiesObj["li_at"] == "" {
		browser.Close()
		return ProxyLoginResult{Success: false, Error: "NO_COOKIES", Message: "Login appeared successful but no session cookie was created."}
	}
	log.Printf("🍪 [CookieAuth] Extracted %d cookies (bound to proxy IP)", len(cookiesObj))

	// 10. Extract profile
	csrfToken := cookiesObj["JSESSIONID"]
	profileData := ExtractProfileViaAPI(page, csrfToken)

	browser.Close()

	log.Printf("✅ [CookieAuth] Proxy login complete! name=%s", profileData.Name)

	return ProxyLoginResult{
		Success:     true,
		Cookies:     cookiesObj,
		ProfileData: profileData,
	}
}

// ── CompleteProxy2FA ─────────────────────────────────────────────────────
// Completes a 2FA flow for a stored proxy login session.
// Mirrors lib/linkedin-cookie-auth.ts → completeProxy2FA()
func (bm *BrowserManager) CompleteProxy2FA(sessionID, pin string) ProxyLoginResult {
	session := bm.get2FASession(sessionID)
	if session == nil {
		return ProxyLoginResult{Success: false, Error: "SESSION_EXPIRED", Message: "Login session expired. Please try again."}
	}
	defer bm.remove2FASession(sessionID)

	page := session.page
	ctx := session.ctx
	browser := session.browser

	log.Printf("🔢 [CookieAuth] Entering 2FA PIN for %s...", session.email)

	// Find and fill PIN input
	count, _ := page.Locator("input[name='pin']").Count()
	if count == 0 {
		browser.Close()
		return ProxyLoginResult{Success: false, Error: "NO_PIN_INPUT", Message: "PIN input not found. Session may have changed."}
	}

	page.Locator("input[name='pin']").Click()
	humanDelay(200, 400)
	page.Locator("input[name='pin']").Type(pin, playwright.LocatorTypeOptions{
		Delay: playwright.Float(60),
	})
	humanDelay(500, 800)

	// Submit
	page.Locator("button[type='submit']").Click()
	page.WaitForURL("**/*", playwright.PageWaitForURLOptions{
		Timeout: playwright.Float(15000),
	})
	time.Sleep(3 * time.Second)

	finalURL := page.URL()
	log.Printf("📍 [CookieAuth] Post-2FA URL: %s", finalURL)

	if strings.Contains(finalURL, "/login") || strings.Contains(finalURL, "checkpoint") || strings.Contains(finalURL, "challenge") {
		browser.Close()
		return ProxyLoginResult{Success: false, Error: "INVALID_PIN", Message: "Invalid verification code or additional verification required."}
	}

	// Navigate to feed
	if !strings.Contains(finalURL, "/feed") {
		page.Goto("https://www.linkedin.com/feed/", playwright.PageGotoOptions{
			WaitUntil: playwright.WaitUntilStateDomcontentloaded,
			Timeout:   playwright.Float(15000),
		})
		time.Sleep(2 * time.Second)
	}

	// Extract cookies
	allCookies, _ := ctx.Cookies()
	cookiesObj := make(map[string]string)
	importantCookies := []string{"li_at", "JSESSIONID", "bcookie", "bscookie", "lidc"}
	for _, c := range allCookies {
		for _, ic := range importantCookies {
			if c.Name == ic {
				cookiesObj[c.Name] = c.Value
			}
		}
	}

	if cookiesObj["li_at"] == "" {
		browser.Close()
		return ProxyLoginResult{Success: false, Error: "NO_COOKIES", Message: "2FA succeeded but no session cookie was created."}
	}

	// Extract profile
	csrfToken := cookiesObj["JSESSIONID"]
	profileData := ExtractProfileViaAPI(page, csrfToken)

	browser.Close()

	return ProxyLoginResult{
		Success:     true,
		Cookies:     cookiesObj,
		ProfileData: profileData,
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// Voyager API Response Parsers
// ──────────────────────────────────────────────────────────────────────────────

func parseVoyagerMeResponse(data interface{}, profile *ProfileData) {
	m, ok := data.(map[string]interface{})
	if !ok {
		return
	}

	// Parse from top-level fields
	if fn, ok := m["firstName"].(string); ok && profile.Name == "" {
		ln, _ := m["lastName"].(string)
		profile.Name = strings.TrimSpace(fn + " " + ln)
	}
	if occ, ok := m["occupation"].(string); ok && profile.Headline == "" {
		profile.Headline = occ
	}
	if pi, ok := m["publicIdentifier"].(string); ok && profile.ProfileURL == "" {
		profile.ProfileURL = fmt.Sprintf("https://www.linkedin.com/in/%s/", pi)
	}

	// Parse from included array
	included, _ := m["included"].([]interface{})
	for _, item := range included {
		obj, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		if fn, ok := obj["firstName"].(string); ok && profile.Name == "" {
			ln, _ := obj["lastName"].(string)
			profile.Name = strings.TrimSpace(fn + " " + ln)
		}
		if occ, ok := obj["occupation"].(string); ok && profile.Headline == "" {
			profile.Headline = occ
		}
		if pi, ok := obj["publicIdentifier"].(string); ok && profile.ProfileURL == "" {
			profile.ProfileURL = fmt.Sprintf("https://www.linkedin.com/in/%s/", pi)
		}
		// Extract profile picture
		if profile.ProfilePictureURL == "" {
			if pic, ok := obj["picture"].(map[string]interface{}); ok {
				profile.ProfilePictureURL = extractProfileImageURL(pic)
			}
		}
	}
}

func parseDashboardProfileResponse(data interface{}, profile *ProfileData) {
	m, ok := data.(map[string]interface{})
	if !ok {
		return
	}

	elements := getIncludedOrElements(m)
	for _, el := range elements {
		obj, ok := el.(map[string]interface{})
		if !ok {
			continue
		}
		if fn, ok := obj["firstName"].(string); ok && profile.Name == "" {
			ln, _ := obj["lastName"].(string)
			profile.Name = strings.TrimSpace(fn + " " + ln)
		}
		if hl, ok := obj["headline"].(string); ok && profile.Headline == "" {
			profile.Headline = hl
		}
		if loc, ok := obj["locationName"].(string); ok && profile.Location == "" {
			profile.Location = loc
		} else if loc, ok := obj["geoLocationName"].(string); ok && profile.Location == "" {
			profile.Location = loc
		}
		if pi, ok := obj["publicIdentifier"].(string); ok && profile.ProfileURL == "" {
			profile.ProfileURL = fmt.Sprintf("https://www.linkedin.com/in/%s/", pi)
		}
		// Profile picture from dashboard API
		if profile.ProfilePictureURL == "" {
			if pp, ok := obj["profilePicture"].(map[string]interface{}); ok {
				if dir, ok := pp["displayImageReference"].(map[string]interface{}); ok {
					if vi, ok := dir["vectorImage"].(map[string]interface{}); ok {
						profile.ProfilePictureURL = extractProfileImageURL(vi)
					}
				}
			}
		}
	}
}

func extractProfileImageURL(pic map[string]interface{}) string {
	rootURL, _ := pic["rootUrl"].(string)
	if rootURL == "" {
		if vi, ok := pic["com_linkedin_common_VectorImage"].(map[string]interface{}); ok {
			rootURL, _ = vi["rootUrl"].(string)
		}
	}
	artifacts, _ := pic["artifacts"].([]interface{})
	if len(artifacts) == 0 {
		if vi, ok := pic["com_linkedin_common_VectorImage"].(map[string]interface{}); ok {
			artifacts, _ = vi["artifacts"].([]interface{})
		}
	}
	if rootURL != "" && len(artifacts) > 0 {
		last, ok := artifacts[len(artifacts)-1].(map[string]interface{})
		if ok {
			seg, _ := last["fileIdentifyingUrlPathSegment"].(string)
			return rootURL + seg
		}
	}
	return ""
}

func getIncludedOrElements(m map[string]interface{}) []interface{} {
	if inc, ok := m["included"].([]interface{}); ok {
		return inc
	}
	if el, ok := m["elements"].([]interface{}); ok {
		return el
	}
	return nil
}

// ──────────────────────────────────────────────────────────────────────────────
// 2FA Session Store (in-memory, auto-cleanup after 5 min)
// ──────────────────────────────────────────────────────────────────────────────

type twoFASession struct {
	browser  playwright.Browser
	ctx      playwright.BrowserContext
	page     playwright.Page
	email    string
	proxyConf *ProxyConfig
}

var (
	twoFASessions   = make(map[string]*twoFASession)
	twoFASessionsMu sync.Mutex
)

func (bm *BrowserManager) store2FASession(sessionID string, browser playwright.Browser, ctx playwright.BrowserContext, page playwright.Page, email string, proxyConf *ProxyConfig) {
	twoFASessionsMu.Lock()
	twoFASessions[sessionID] = &twoFASession{
		browser:   browser,
		ctx:       ctx,
		page:      page,
		email:     email,
		proxyConf: proxyConf,
	}
	twoFASessionsMu.Unlock()

	// Auto-cleanup after 5 minutes
	go func() {
		time.Sleep(5 * time.Minute)
		twoFASessionsMu.Lock()
		if s, ok := twoFASessions[sessionID]; ok {
			log.Printf("🧹 [CookieAuth] Cleaning up expired 2FA session: %s", sessionID)
			s.browser.Close()
			delete(twoFASessions, sessionID)
		}
		twoFASessionsMu.Unlock()
	}()
}

func (bm *BrowserManager) get2FASession(sessionID string) *twoFASession {
	twoFASessionsMu.Lock()
	defer twoFASessionsMu.Unlock()
	return twoFASessions[sessionID]
}

func (bm *BrowserManager) remove2FASession(sessionID string) {
	twoFASessionsMu.Lock()
	defer twoFASessionsMu.Unlock()
	delete(twoFASessions, sessionID)
}
