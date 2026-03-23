package automation

import (
	"encoding/json"
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
// Network Sync Service
//
// Implements service.NetworkSyncer:
//   Sync(sessionCookies, linkedinAccountID, userID, syncType)
//
// Go equivalent of lib/linkedin-network-sync.ts:
//   - fetchConnectionsViaAPI()  → FetchConnectionsViaAPI
//   - fetchConnectionsViaDOM()  → FetchConnectionsViaDOM
//   - syncLinkedInNetwork()     → SyncLinkedInNetwork / Sync (interface method)
//   - getLinkedInConnectionCount() → GetLinkedInConnectionCount
// ──────────────────────────────────────────────────────────────────────────────

const (
	apiPageSize = 40 // Voyager API connections pagination size
)

// NetworkSyncService implements the NetworkSyncer interface.
type NetworkSyncService struct {
	bm          *BrowserManager
	accountRepo *repository.LinkedInAccountRepository
	connRepo    *repository.NetworkConnectionRepository
	db          *gorm.DB
}

// NewNetworkSyncService creates a NetworkSyncService.
func NewNetworkSyncService(
	bm *BrowserManager,
	accountRepo *repository.LinkedInAccountRepository,
	connRepo *repository.NetworkConnectionRepository,
	db *gorm.DB,
) *NetworkSyncService {
	return &NetworkSyncService{
		bm:          bm,
		accountRepo: accountRepo,
		connRepo:    connRepo,
		db:          db,
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sync (interface method)
//
// Called by service.NetworkService when a sync is triggered via API.
// ═══════════════════════════════════════════════════════════════════════════════

func (ns *NetworkSyncService) Sync(
	sessionCookies models.JSONB,
	linkedinAccountID string,
	userID string,
	syncType string,
) (*models.NetworkSyncResult, error) {
	return ns.SyncLinkedInNetwork(sessionCookies, linkedinAccountID, userID, syncType)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SyncLinkedInNetwork
//
// Mirrors lib/linkedin-network-sync.ts → syncLinkedInNetwork():
//   1. Launch browser with cookies
//   2. Navigate to connections page
//   3. Try API first, fallback to DOM scraping
//   4. Upsert connections to network_connections table
// ═══════════════════════════════════════════════════════════════════════════════

func (ns *NetworkSyncService) SyncLinkedInNetwork(
	sessionCookies models.JSONB,
	linkedinAccountID string,
	userID string,
	syncType string,
) (*models.NetworkSyncResult, error) {
	accountUUID, err := uuid.Parse(linkedinAccountID)
	if err != nil {
		return nil, fmt.Errorf("invalid account ID: %w", err)
	}
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID: %w", err)
	}

	account, err := ns.accountRepo.FindByID(accountUUID)
	if err != nil {
		return nil, fmt.Errorf("account not found: %w", err)
	}

	log.Printf("🔗 [NetworkSync] Starting %s sync for %s", syncType, account.Email)

	// Build a temporary account-like object to pass to CreateAuthenticatedBrowser
	// Override session cookies if provided
	if sessionCookies != nil {
		account.SessionCookies = sessionCookies
	}

	ab, err := ns.bm.CreateAuthenticatedBrowser(account, nil)
	if err != nil {
		HandleAccountDisconnection(ns.accountRepo, account.ID, err.Error())
		return nil, fmt.Errorf("failed to create browser: %w", err)
	}
	defer ab.Close()

	page := ab.Page

	// Navigate to connections page
	if _, err := page.Goto("https://www.linkedin.com/mynetwork/invite-connect/connections/", playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateDomcontentloaded,
		Timeout:   playwright.Float(60000),
	}); err != nil {
		return nil, fmt.Errorf("failed to navigate to connections: %w", err)
	}
	time.Sleep(3 * time.Second)

	// Get CSRF token from cookies
	csrfToken := ""
	cookies, _ := ab.Context.Cookies()
	for _, c := range cookies {
		if c.Name == "JSESSIONID" {
			csrfToken = c.Value
			break
		}
	}

	// Try API strategy first (more reliable + faster)
	var connections []SyncedConnection
	if csrfToken != "" {
		log.Printf("🔗 [NetworkSync] Trying Voyager API strategy...")
		apiConns, apiErr := ns.FetchConnectionsViaAPI(page, csrfToken)
		if apiErr == nil && len(apiConns) > 0 {
			connections = apiConns
			log.Printf("🔗 [NetworkSync] API returned %d connections", len(connections))
		} else {
			log.Printf("⚠️ [NetworkSync] API strategy failed: %v — falling back to DOM", apiErr)
		}
	}

	// Fallback: DOM scraping
	if len(connections) == 0 {
		log.Printf("🔗 [NetworkSync] Using DOM scraping strategy...")
		domConns, domErr := ns.FetchConnectionsViaDOM(page)
		if domErr != nil {
			return nil, fmt.Errorf("both API and DOM strategies failed: %w", domErr)
		}
		connections = domConns
		log.Printf("🔗 [NetworkSync] DOM returned %d connections", len(connections))
	}

	// Upsert connections to DB
	result := &models.NetworkSyncResult{
		TotalConnectionsSynced: len(connections),
	}

	for _, conn := range connections {
		existing := &models.NetworkConnection{}
		q := ns.db.Where(
			"linkedin_account_id = ? AND connection_linkedin_url = ?",
			accountUUID, conn.ProfileURL,
		).First(existing)

		if q.Error == gorm.ErrRecordNotFound {
			// Create new connection
			newConn := models.NetworkConnection{
				UserID:                userUUID,
				LinkedInAccountID:     accountUUID,
				ConnectionLinkedInURL: strPtr(conn.ProfileURL),
				ConnectionProfileID:   strPtr(conn.ProfileID),
				FirstName:             strPtr(conn.FirstName),
				LastName:              strPtr(conn.LastName),
				FullName:              strPtr(conn.FullName),
				Headline:              strPtr(conn.Headline),
				ProfilePictureURL:     strPtr(conn.ProfileImage),
				Location:              strPtr(conn.Location),
				Company:               strPtr(conn.Company),
				Position:              strPtr(conn.Position),
				ConnectionStatus:      models.ConnectionStatusConnected,
			}
			if !conn.ConnectedAt.IsZero() {
				newConn.ConnectedAt = &conn.ConnectedAt
			}
			ns.db.Create(&newConn)
			result.NewConnectionsAdded++
		} else if q.Error == nil {
			// Update existing connection
			updates := map[string]interface{}{
				"updated_at": time.Now(),
			}
			if conn.FullName != "" {
				updates["full_name"] = conn.FullName
			}
			if conn.Headline != "" {
				updates["headline"] = conn.Headline
			}
			if conn.ProfileImage != "" {
				updates["profile_picture_url"] = conn.ProfileImage
			}
			if conn.Company != "" {
				updates["company"] = conn.Company
			}
			if conn.Position != "" {
				updates["position"] = conn.Position
			}
			ns.db.Model(existing).Updates(updates)
			result.ConnectionsUpdated++
		}
	}

	// Update account's connection count
	ns.accountRepo.UpdateFields(account.ID, map[string]interface{}{
		"connections_count": len(connections),
		"last_activity_at":  time.Now(),
	})

	log.Printf("🔗 [NetworkSync] ✅ Sync complete: %d total, %d new, %d updated",
		result.TotalConnectionsSynced, result.NewConnectionsAdded, result.ConnectionsUpdated)

	return result, nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// FetchConnectionsViaAPI
//
// Mirrors lib/linkedin-network-sync.ts → fetchConnectionsViaAPI()
// Uses LinkedIn Voyager API with CSRF token to fetch connections with pagination.
// ═══════════════════════════════════════════════════════════════════════════════

func (ns *NetworkSyncService) FetchConnectionsViaAPI(page playwright.Page, csrfToken string) ([]SyncedConnection, error) {
	var allConns []SyncedConnection
	start := 0
	maxPages := 50 // Safety limit

	for page_num := 0; page_num < maxPages; page_num++ {
		log.Printf("🔗 [NetworkSync] API page %d (start=%d)", page_num+1, start)

		result, err := page.Evaluate(fmt.Sprintf(`async () => {
			try {
				const r = await fetch(
					'https://www.linkedin.com/voyager/api/relationships/dash/connections?decorationId=com.linkedin.voyager.dash.deco.web.mynetwork.ConnectionListWithProfile-16&count=%d&start=%d&q=search&sortType=RECENTLY_ADDED',
					{
						headers: {
							'csrf-token': '%s',
							'accept': 'application/vnd.linkedin.normalized+json+2.1'
						}
					}
				);
				if (!r.ok) return { error: r.status };
				return await r.json();
			} catch (e) { return { error: e.message }; }
		}`, apiPageSize, start, csrfToken))
		if err != nil {
			return allConns, fmt.Errorf("API call failed: %w", err)
		}

		resultMap, ok := result.(map[string]interface{})
		if !ok {
			return allConns, fmt.Errorf("unexpected API response type")
		}

		if errVal, hasErr := resultMap["error"]; hasErr {
			return allConns, fmt.Errorf("API error: %v", errVal)
		}

		// Parse the included array — contains both Profile and Connection objects
		included, _ := resultMap["included"].([]interface{})
		if len(included) == 0 {
			break // No more results
		}

		// Build a map of profiles by entityUrn
		profiles := make(map[string]SyncedConnection)
		for _, item := range included {
			obj, ok := item.(map[string]interface{})
			if !ok {
				continue
			}

			// Check if this is a Profile entity
			entityUrn, _ := obj["entityUrn"].(string)
			if !strings.Contains(entityUrn, "fs_profile:") && !strings.Contains(entityUrn, "miniProfile:") {
				continue
			}

			conn := SyncedConnection{}
			if fn, ok := obj["firstName"].(string); ok {
				conn.FirstName = fn
			}
			if ln, ok := obj["lastName"].(string); ok {
				conn.LastName = ln
			}
			if conn.FirstName != "" || conn.LastName != "" {
				conn.FullName = strings.TrimSpace(conn.FirstName + " " + conn.LastName)
			}
			if occ, ok := obj["occupation"].(string); ok {
				conn.Headline = occ
			}
			if pi, ok := obj["publicIdentifier"].(string); ok {
				conn.ProfileID = pi
				conn.ProfileURL = fmt.Sprintf("https://www.linkedin.com/in/%s/", pi)
			}

			// Extract profile picture
			if pic, ok := obj["picture"].(map[string]interface{}); ok {
				conn.ProfileImage = extractProfileImageURL(pic)
			}

			if entityUrn != "" {
				profiles[entityUrn] = conn
			}
		}

		// Parse Connection entities to get connected_at dates
		for _, item := range included {
			obj, ok := item.(map[string]interface{})
			if !ok {
				continue
			}
			entityUrn, _ := obj["entityUrn"].(string)
			if !strings.Contains(entityUrn, "connection:") {
				continue
			}

			// Get the linked profile URN
			connMember, _ := obj["connectedMember"].(string)
			if connMember == "" {
				connMemberURN, _ := obj["connectedMemberResolutionResult"].(map[string]interface{})
				if connMemberURN != nil {
					connMember, _ = connMemberURN["entityUrn"].(string)
				}
			}

			// Get createdAt timestamp
			if createdAt, ok := obj["createdAt"].(float64); ok && connMember != "" {
				if profile, exists := profiles[connMember]; exists {
					profile.ConnectedAt = time.UnixMilli(int64(createdAt))
					profiles[connMember] = profile
				}
			}
		}

		for _, conn := range profiles {
			if conn.ProfileURL != "" {
				allConns = append(allConns, conn)
			}
		}

		// Check pagination
		paging, _ := resultMap["paging"].(map[string]interface{})
		total, _ := paging["total"].(float64)
		if start+apiPageSize >= int(total) || len(profiles) == 0 {
			break
		}
		start += apiPageSize

		// Rate limit between pages
		humanDelay(500, 1500)
	}

	return allConns, nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// FetchConnectionsViaDOM
//
// Mirrors lib/linkedin-network-sync.ts → fetchConnectionsViaDOM()
// Scrolls the connections page and scrapes connection cards from the DOM.
// ═══════════════════════════════════════════════════════════════════════════════

func (ns *NetworkSyncService) FetchConnectionsViaDOM(page playwright.Page) ([]SyncedConnection, error) {
	log.Printf("🔗 [NetworkSync] DOM scraping connections page...")

	// Scroll to load all connections
	prevCount := 0
	for attempt := 0; attempt < 30; attempt++ {
		page.Evaluate(`window.scrollTo(0, document.body.scrollHeight)`)
		time.Sleep(2 * time.Second)

		// Click "Show more" button if present
		showMore := page.Locator("button:has-text('Show more results'), button:has-text('Show more')").First()
		smCount, _ := showMore.Count()
		if smCount > 0 {
			showMore.Click()
			time.Sleep(2 * time.Second)
		}

		// Count current connections
		currentCount, _ := page.Locator("a[data-view-name='connections-profile'], li.mn-connection-card").Count()
		if currentCount == prevCount {
			break // No more new connections loaded
		}
		prevCount = currentCount
		log.Printf("🔗 [NetworkSync] DOM loaded %d connections so far...", currentCount)
	}

	// Extract connection data
	result, err := page.Evaluate(`() => {
		const connections = [];
		const cards = document.querySelectorAll('a[data-view-name="connections-profile"], li.mn-connection-card');
		cards.forEach(card => {
			const link = card.tagName === 'A' ? card : card.querySelector('a[href*="/in/"]');
			const nameEl = card.querySelector('.mn-connection-card__name, .entity-result__title-text a span');
			const headlineEl = card.querySelector('.mn-connection-card__occupation, .entity-result__primary-subtitle');
			const imgEl = card.querySelector('img.presence-entity__image, img.EntityPhoto-circle-4');
			
			const href = link ? link.getAttribute('href') : '';
			const name = nameEl ? nameEl.textContent.trim() : '';
			const headline = headlineEl ? headlineEl.textContent.trim() : '';
			const img = imgEl ? imgEl.src : '';
			
			if (href && name) {
				const profileId = href.match(/\/in\/([^/?]+)/);
				connections.push({
					profileUrl: href.startsWith('http') ? href : 'https://www.linkedin.com' + href,
					profileId: profileId ? profileId[1] : '',
					fullName: name,
					headline: headline,
					profileImage: img,
				});
			}
		});
		return connections;
	}`)
	if err != nil {
		return nil, fmt.Errorf("DOM extraction failed: %w", err)
	}

	var connections []SyncedConnection
	if arr, ok := result.([]interface{}); ok {
		for _, item := range arr {
			if obj, ok := item.(map[string]interface{}); ok {
				conn := SyncedConnection{
					ProfileURL:   getString(obj, "profileUrl"),
					ProfileID:    getString(obj, "profileId"),
					FullName:     getString(obj, "fullName"),
					Headline:     getString(obj, "headline"),
					ProfileImage: getString(obj, "profileImage"),
				}
				// Parse full name into first/last
				parts := strings.SplitN(conn.FullName, " ", 2)
				if len(parts) > 0 {
					conn.FirstName = parts[0]
				}
				if len(parts) > 1 {
					conn.LastName = parts[1]
				}
				connections = append(connections, conn)
			}
		}
	}

	return connections, nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// GetLinkedInConnectionCount
//
// Mirrors lib/linkedin-network-sync.ts → getLinkedInConnectionCount()
// Quick check of connection count without full sync.
// ═══════════════════════════════════════════════════════════════════════════════

func (ns *NetworkSyncService) GetLinkedInConnectionCount(liAt string, sessionCookies models.JSONB) (int, error) {
	browser, err := ns.bm.pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
		Headless: playwright.Bool(true),
		Args:     []string{"--no-sandbox", "--disable-setuid-sandbox"},
	})
	if err != nil {
		return 0, fmt.Errorf("failed to launch browser: %w", err)
	}
	defer browser.Close()

	ctx, err := browser.NewContext(playwright.BrowserNewContextOptions{
		Viewport: &playwright.Size{Width: 1280, Height: 800},
		UserAgent: playwright.String(
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
		),
	})
	if err != nil {
		return 0, fmt.Errorf("failed to create context: %w", err)
	}

	// Set cookies
	if sessionCookies != nil {
		pwCookies := SessionCookiesToPlaywright(sessionCookies)
		if len(pwCookies) > 0 {
			ctx.AddCookies(pwCookies)
		}
	} else if liAt != "" {
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
		return 0, err
	}

	if _, err := page.Goto("https://www.linkedin.com/mynetwork/invite-connect/connections/", playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateDomcontentloaded,
		Timeout:   playwright.Float(30000),
	}); err != nil {
		return 0, err
	}
	time.Sleep(3 * time.Second)

	// Try to extract count from heading "X Connections" or "X connections"
	result, err := page.Evaluate(`() => {
		const heading = document.querySelector('h1, .mn-connections__header');
		if (heading) {
			const m = heading.textContent.match(/(\d[\d,]*)/);
			if (m) return parseInt(m[1].replace(/,/g, ''), 10);
		}
		// Fallback: count profile links
		return document.querySelectorAll('a[data-view-name="connections-profile"], li.mn-connection-card').length;
	}`)
	if err != nil {
		return 0, fmt.Errorf("failed to extract count: %w", err)
	}

	count := 0
	if f, ok := result.(float64); ok {
		count = int(f)
	} else if raw, err := json.Marshal(result); err == nil {
		fmt.Sscanf(string(raw), "%d", &count)
	}

	return count, nil
}
