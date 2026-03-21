package auth

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/reach/backend/internal/config"
)

// AccountsUser is the user payload extracted from the Accounts launch token.
type AccountsUser struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name,omitempty"`
}

// SubscriptionStatus describes the subscription state.
type SubscriptionStatus struct {
	Active    bool   `json:"active"`
	Plan      string `json:"plan,omitempty"`
	Trial     bool   `json:"trial,omitempty"`
	ExpiresAt string `json:"expires_at,omitempty"`
}

// LaunchTokenResult holds the data extracted from a verified Accounts launch token.
type LaunchTokenResult struct {
	User         AccountsUser
	Subscription SubscriptionStatus
	WorkspaceID  string
	Role         string
}

// CheckResponse is the response from Accounts /api/v1/products/reach/check.
type CheckResponse struct {
	Active   bool   `json:"active"`
	Status   string `json:"status,omitempty"`
	PlanName string `json:"plan_name,omitempty"`
}

// ReachClaims are the JWT claims Reach puts into its own session cookie.
type ReachClaims struct {
	jwt.RegisteredClaims
	Email       string `json:"email"`
	Name        string `json:"name,omitempty"`
	Subscribed  bool   `json:"subscribed"`
	Plan        string `json:"plan,omitempty"`
	WorkspaceID string `json:"workspace_id,omitempty"`
}

var httpClient = &http.Client{Timeout: 10 * time.Second}

// VerifyLaunchToken verifies an Accounts launch token locally using the shared
// JWT_SECRET (HS256). The token contains: sub, email, workspace_id, role, iss, aud.
// No HTTP call to Accounts needed.
func VerifyLaunchToken(cfg *config.Config, tokenStr string) (*LaunchTokenResult, error) {
	if cfg.JWTSecret == "" {
		return nil, errors.New("JWT_SECRET is not configured")
	}

	// Try with current issuer first, fall back to legacy issuer
	// (deployed Accounts may not have been redeployed with new domain yet)
	issuers := []string{"accounts.gour.io", "accounts.outcraftly.com"}
	var token *jwt.Token
	var lastErr error

	for _, issuer := range issuers {
		token, lastErr = jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			return []byte(cfg.JWTSecret), nil
		},
			jwt.WithIssuer(issuer),
			jwt.WithAudience("reach"),
		)
		if lastErr == nil && token.Valid {
			break
		}
	}
	if lastErr != nil {
		return nil, fmt.Errorf("invalid launch token: %w", lastErr)
	}
	if !token.Valid {
		return nil, errors.New("token is not valid")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("invalid token claims")
	}

	sub, _ := claims["sub"].(string)
	email, _ := claims["email"].(string)
	workspaceID, _ := claims["workspace_id"].(string)
	role, _ := claims["role"].(string)

	if sub == "" || email == "" {
		return nil, errors.New("token missing sub or email")
	}

	return &LaunchTokenResult{
		User: AccountsUser{
			ID:    sub,
			Email: email,
		},
		Subscription: SubscriptionStatus{
			Active: true, // Accounts only issues launch tokens for active subscriptions
		},
		WorkspaceID: workspaceID,
		Role:        role,
	}, nil
}

// CheckSubscription calls Accounts GET /api/v1/products/reach/check
// to re-validate that the user subscription is still active.
func CheckSubscription(cfg *config.Config, token string) (*CheckResponse, error) {
	url := fmt.Sprintf("%s/api/v1/products/reach/check", cfg.AccountsAPIURL)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("accounts check call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("accounts returned %d: %s", resp.StatusCode, string(body))
	}

	var result CheckResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode check response: %w", err)
	}
	return &result, nil
}

// SignSessionJWT creates a Reach session token (HS256) from verified Accounts data.
func SignSessionJWT(cfg *config.Config, user AccountsUser, sub SubscriptionStatus, workspaceID string) (string, error) {
	if cfg.JWTSecret == "" {
		return "", errors.New("JWT_SECRET is not configured")
	}

	now := time.Now()
	claims := ReachClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(cfg.SessionMaxAge)),
			Issuer:    "reach",
		},
		Email:       user.Email,
		Name:        user.Name,
		Subscribed:  sub.Active,
		Plan:        sub.Plan,
		WorkspaceID: workspaceID,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.JWTSecret))
}

// VerifySessionJWT parses and validates a Reach session JWT.
func VerifySessionJWT(cfg *config.Config, raw string) (*ReachClaims, error) {
	if cfg.JWTSecret == "" {
		return nil, errors.New("JWT_SECRET is not configured")
	}

	token, err := jwt.ParseWithClaims(raw, &ReachClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(cfg.JWTSecret), nil
	})
	if err != nil {
		return nil, fmt.Errorf("parse jwt: %w", err)
	}

	claims, ok := token.Claims.(*ReachClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

// LoginURL builds the Accounts login URL. Uses the product launch path so
// Accounts validates the subscription and signs a launch JWT.
func LoginURL(cfg *config.Config, nextPath string) string {
	// Plain callback URL — no query params.
	// Accounts appends "?token=<jwt>" literally, so any existing "?"
	// in the redirect_uri creates a double-? and the token is lost.
	callbackURL := fmt.Sprintf("%s/auth/callback", cfg.AppURL)
	return fmt.Sprintf("%s/products/reach/launch?redirect_uri=%s",
		cfg.AccountsURL,
		callbackURL,
	)
}

// BillingURL returns the Accounts billing page.
func BillingURL(cfg *config.Config) string {
	return cfg.AccountsURL + "/billing"
}

// SignOutURL returns the Accounts sign-out page with a redirect back to Reach login.
func SignOutURL(cfg *config.Config) string {
	return fmt.Sprintf("%s/logout?redirect_uri=%s/login", cfg.AccountsURL, cfg.FrontendURL)
}

func init() {
	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)
}
