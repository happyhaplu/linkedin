package automation

import (
	"time"

	"github.com/google/uuid"
)

// ──────────────────────────────────────────────────────────────────────────────
// Browser / Proxy Configuration
// ──────────────────────────────────────────────────────────────────────────────

// ProxyConfig holds proxy settings for browser contexts.
type ProxyConfig struct {
	Server   string `json:"server"`
	Username string `json:"username,omitempty"`
	Password string `json:"password,omitempty"`
}

// BrowserConfig holds the browser launch and context settings.
type BrowserConfig struct {
	Headless  bool         `json:"headless"`
	ProxyConf *ProxyConfig `json:"proxy,omitempty"`
	UserAgent string       `json:"user_agent,omitempty"`
	Viewport  *Viewport    `json:"viewport,omitempty"`
}

// Viewport defines browser viewport dimensions.
type Viewport struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}

// DefaultBrowserConfig returns sensible defaults for headless Chrome automation.
func DefaultBrowserConfig() BrowserConfig {
	return BrowserConfig{
		Headless:  true,
		UserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
		Viewport:  &Viewport{Width: 1920, Height: 1080},
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// Cookie Types
// ──────────────────────────────────────────────────────────────────────────────

// PlaywrightCookie represents a single cookie in Playwright format.
type PlaywrightCookie struct {
	Name     string  `json:"name"`
	Value    string  `json:"value"`
	Domain   string  `json:"domain"`
	Path     string  `json:"path"`
	HTTPOnly bool    `json:"httpOnly"`
	Secure   bool    `json:"secure"`
	SameSite string  `json:"sameSite"`
	Expires  float64 `json:"expires,omitempty"`
}

// ParsedCookies holds the result of parsing cookie input.
type ParsedCookies struct {
	LiAt       string            `json:"li_at"`
	CookiesObj map[string]string `json:"cookies_obj"`
}

// ──────────────────────────────────────────────────────────────────────────────
// Auth Result Types
// ──────────────────────────────────────────────────────────────────────────────

// CookieAuthResult is the result of a cookie-based login attempt.
type CookieAuthResult struct {
	Success     bool              `json:"success"`
	Error       string            `json:"error,omitempty"`
	Message     string            `json:"message,omitempty"`
	Cookies     map[string]string `json:"cookies,omitempty"`
	ProfileData *ProfileData      `json:"profileData,omitempty"`
}

// ProfileData holds LinkedIn profile information extracted after auth.
type ProfileData struct {
	Name             string `json:"name,omitempty"`
	ProfilePictureURL string `json:"profilePictureUrl,omitempty"`
	Headline         string `json:"headline,omitempty"`
	Location         string `json:"location,omitempty"`
	JobTitle         string `json:"jobTitle,omitempty"`
	Company          string `json:"company,omitempty"`
	ProfileURL       string `json:"profileUrl,omitempty"`
	ConnectionsCount int    `json:"connectionsCount,omitempty"`
	About            string `json:"about,omitempty"`
}

// ProxyLoginResult is the result of a credential-based login through a proxy.
type ProxyLoginResult struct {
	Success     bool              `json:"success"`
	Cookies     map[string]string `json:"cookies,omitempty"`
	ProfileData *ProfileData      `json:"profileData,omitempty"`
	Error       string            `json:"error,omitempty"`
	Message     string            `json:"message,omitempty"`
	Requires2FA bool              `json:"requires2FA,omitempty"`
	SessionID   string            `json:"sessionId,omitempty"`
}

// ──────────────────────────────────────────────────────────────────────────────
// Campaign Automation Types
// ──────────────────────────────────────────────────────────────────────────────

// AutomationResult is a generic result for any LinkedIn automation action.
type AutomationResult struct {
	Success      bool   `json:"success"`
	Action       string `json:"action"`
	AlreadyDone  bool   `json:"alreadyDone,omitempty"`
	ErrorMessage string `json:"errorMessage,omitempty"`
}

// ConnectionStatus represents the relationship status between two LinkedIn users.
type ConnectionStatus string

const (
	ConnectionStatusAccepted     ConnectionStatus = "accepted"
	ConnectionStatusPending      ConnectionStatus = "pending"
	ConnectionStatusNotConnected ConnectionStatus = "not_connected"
	ConnectionStatusError        ConnectionStatus = "error"
)

// ConnectionDegree represents the LinkedIn connection degree.
type ConnectionDegree string

const (
	ConnectionDegree1st ConnectionDegree = "1st"
	ConnectionDegree2nd ConnectionDegree = "2nd"
	ConnectionDegree3rd ConnectionDegree = "3rd"
)

// ──────────────────────────────────────────────────────────────────────────────
// Message Scraper Types
// ──────────────────────────────────────────────────────────────────────────────

// ScrapedConversation is a conversation extracted from the LinkedIn messaging page.
type ScrapedConversation struct {
	ThreadID        string `json:"threadId"`
	ParticipantName string `json:"participantName"`
	Headline        string `json:"headline,omitempty"`
	AvatarURL       string `json:"avatarUrl,omitempty"`
	Preview         string `json:"preview,omitempty"`
	IsUnread        bool   `json:"isUnread"`
}

// ScrapedMessage is a single message extracted from a LinkedIn conversation thread.
type ScrapedMessage struct {
	MessageID string    `json:"messageId"`
	Sender    string    `json:"sender"`
	Content   string    `json:"content"`
	Time      string    `json:"time,omitempty"`
	IsFromMe  bool      `json:"isFromMe"`
	SentAt    time.Time `json:"sentAt,omitempty"`
}

// MessageSyncResult holds stats from a single-account message sync run.
type MessageSyncResult struct {
	ConversationsSynced int `json:"conversationsSynced"`
	MessagesSynced      int `json:"messagesSynced"`
	NewMessages         int `json:"newMessages"`
}

// ──────────────────────────────────────────────────────────────────────────────
// Network Sync Types
// ──────────────────────────────────────────────────────────────────────────────

// SyncedConnection represents a single connection fetched from LinkedIn.
type SyncedConnection struct {
	ProfileID    string    `json:"profileId,omitempty"`
	ProfileURL   string    `json:"profileUrl,omitempty"`
	FirstName    string    `json:"firstName,omitempty"`
	LastName     string    `json:"lastName,omitempty"`
	FullName     string    `json:"fullName,omitempty"`
	Headline     string    `json:"headline,omitempty"`
	ProfileImage string    `json:"profileImage,omitempty"`
	Location     string    `json:"location,omitempty"`
	Company      string    `json:"company,omitempty"`
	Position     string    `json:"position,omitempty"`
	ConnectedAt  time.Time `json:"connectedAt,omitempty"`
}

// ──────────────────────────────────────────────────────────────────────────────
// Session Management Types
// ──────────────────────────────────────────────────────────────────────────────

// LoginSession represents a persistent browser session held in memory for 2FA flow.
type LoginSession struct {
	SessionID    string
	AccountID    uuid.UUID
	Email        string
	ProxyConf    *ProxyConfig
	CreatedAt    time.Time
	ExpiresAt    time.Time
	// The actual browser/page handles are stored in the BrowserManager
}

// InfiniteSessionInfo describes a long-running browser session.
type InfiniteSessionInfo struct {
	SessionID    string    `json:"sessionId"`
	AccountID    string    `json:"accountId"`
	Email        string    `json:"email"`
	LastActivity time.Time `json:"lastActivity"`
	KeepAlive    bool      `json:"keepAlive"`
}

// ──────────────────────────────────────────────────────────────────────────────
// Error Classification
// ──────────────────────────────────────────────────────────────────────────────

// IsTransientError returns true if the error message indicates a network/timeout
// issue that should NOT trigger account disconnection.
func IsTransientError(errMsg string) bool {
	transient := []string{
		"ERR_NETWORK",
		"ERR_CONNECTION",
		"TIMEOUT",
		"ECONNRESET",
		"ECONNREFUSED",
		"net::ERR_",
		"Target closed",
		"Session closed",
		"Browser has been closed",
		"Navigation timeout",
		"Page.goto: Timeout",
		"frame was detached",
		"context was destroyed",
	}
	for _, t := range transient {
		if containsInsensitive(errMsg, t) {
			return true
		}
	}
	return false
}

// IsAuthError returns true if the error indicates an authentication/session failure.
func IsAuthError(errMsg string) bool {
	auth := []string{
		"INVALID_SECRET_KEY",
		"cookie is invalid",
		"session expired",
		"authwall",
		"/login",
		"AUTH_FAILED",
	}
	for _, a := range auth {
		if containsInsensitive(errMsg, a) {
			return true
		}
	}
	return false
}

func containsInsensitive(s, substr string) bool {
	return len(s) >= len(substr) &&
		containsLower(toLower(s), toLower(substr))
}

func toLower(s string) string {
	b := make([]byte, len(s))
	for i := range s {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		b[i] = c
	}
	return string(b)
}

func containsLower(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
