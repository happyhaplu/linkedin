package auth

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/reach/backend/internal/config"
)

// ── Types ───────────────────────────────────────────────────────────────────

// VerifyResponse is what Accounts returns from POST /api/v1/products/verify.
type VerifyResponse struct {
	Valid       bool   `json:"valid"`
	UserID      string `json:"user_id"`
	Email       string `json:"email"`
	WorkspaceID string `json:"workspace_id"`
	Subscribed  bool   `json:"subscribed"`
}

// CheckResponse is what Accounts returns from GET /api/v1/products/reach/check.
type CheckResponse struct {
	Active   bool   `json:"active"`
	Status   string `json:"status,omitempty"`
	PlanName string `json:"plan_name,omitempty"`
}

var httpClient = &http.Client{Timeout: 10 * time.Second}

// ── API Functions ───────────────────────────────────────────────────────────

// VerifyToken calls Accounts POST /api/v1/products/verify to validate a
// launch token. This is the ONLY way tokens are verified — no local JWT
// parsing, no shared secret. Accounts validates its own tokens server-side.
func VerifyToken(cfg *config.Config, launchToken string) (*VerifyResponse, error) {
	url := fmt.Sprintf("%s/api/v1/products/verify", cfg.AccountsAPIURL)

	body, _ := json.Marshal(map[string]string{"token": launchToken})
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("build verify request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", cfg.AccountsAPIKey)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("accounts verify call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("accounts verify returned %d: %s", resp.StatusCode, string(respBody))
	}

	var result VerifyResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode verify response: %w", err)
	}

	if !result.Valid {
		return nil, fmt.Errorf("token not valid")
	}
	return &result, nil
}

// CheckSubscription calls Accounts GET /api/v1/products/reach/check
// to re-validate that the user's subscription is still active.
// The accountsToken is the raw launch token stored in the DB session.
func CheckSubscription(cfg *config.Config, accountsToken string) (*CheckResponse, error) {
	url := fmt.Sprintf("%s/api/v1/products/reach/check", cfg.AccountsAPIURL)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("build check request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accountsToken)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("accounts check call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("accounts check returned %d: %s", resp.StatusCode, string(body))
	}

	var result CheckResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode check response: %w", err)
	}
	return &result, nil
}

// ── URL Helpers ─────────────────────────────────────────────────────────────

// LoginURL builds the Accounts login URL for the Reach product.
func LoginURL(cfg *config.Config, nextPath string) string {
	callbackURL := fmt.Sprintf("%s/callback", cfg.FrontendURL)
	return fmt.Sprintf("%s/products/reach/launch?redirect_uri=%s",
		cfg.AccountsURL,
		callbackURL,
	)
}

// SignOutURL returns the Accounts sign-out page with a redirect back to Reach.
func SignOutURL(cfg *config.Config) string {
	return fmt.Sprintf("%s/logout?redirect_uri=%s/login", cfg.AccountsURL, cfg.FrontendURL)
}

// BillingURL returns the Accounts billing page.
func BillingURL(cfg *config.Config) string {
	return cfg.AccountsURL + "/billing"
}

func init() {
	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)
}
