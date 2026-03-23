package service

import (
	"fmt"
	"net/url"
	"regexp"

	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"github.com/reach/backend/internal/repository"
)

// ── Validation ──────────────────────────────────────────────────────────────

// ProxyConfigValidation holds the result of proxy configuration validation.
type ProxyConfigValidation struct {
	Valid bool   `json:"valid"`
	Error string `json:"error,omitempty"`
}

var (
	ipRegex     = regexp.MustCompile(`^(\d{1,3}\.){3}\d{1,3}$`)
	domainRegex = regexp.MustCompile(`(?i)^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$`)
)

// ValidateProxyConfig validates a proxy host (IP or domain) and port range.
// Matches the TS validateProxyConfig from lib/utils/proxy-tester.ts.
func ValidateProxyConfig(host string, port int) ProxyConfigValidation {
	if !ipRegex.MatchString(host) && !domainRegex.MatchString(host) {
		return ProxyConfigValidation{Valid: false, Error: "Invalid host format"}
	}
	if port < 1 || port > 65535 {
		return ProxyConfigValidation{Valid: false, Error: "Port must be between 1 and 65535"}
	}
	return ProxyConfigValidation{Valid: true}
}

// ── Playwright Proxy Config ─────────────────────────────────────────────────

// PlaywrightProxyConfig is the Playwright-compatible proxy configuration used
// by browser.NewContext({ proxy: ... }).
type PlaywrightProxyConfig struct {
	Server   string `json:"server"`             // e.g. "http://31.59.20.176:6754"
	Username string `json:"username,omitempty"`  // e.g. "xfkfrbeb"
	Password string `json:"password,omitempty"`  // e.g. "8jpnmtlggdcn" (decrypted)
}

// BuildPlaywrightProxyConfig builds a Playwright-compatible proxy config from
// a Proxy DB record.  Decrypts the stored password.
// Matches TS buildPlaywrightProxyConfig from lib/utils/proxy-helpers.ts.
func BuildPlaywrightProxyConfig(proxy *models.Proxy) PlaywrightProxyConfig {
	protocol := string(proxy.Type)
	if protocol == "" {
		protocol = "http"
	}

	cfg := PlaywrightProxyConfig{
		Server: fmt.Sprintf("%s://%s:%d", protocol, proxy.Host, proxy.Port),
	}

	if proxy.Username != nil && *proxy.Username != "" {
		cfg.Username = *proxy.Username
		if proxy.PasswordEncrypted != nil && *proxy.PasswordEncrypted != "" {
			plain, err := DecryptData(*proxy.PasswordEncrypted)
			if err == nil {
				cfg.Password = plain
			}
		}
	}

	return cfg
}

// ── Proxy URL builders ──────────────────────────────────────────────────────

// BuildProxyUrl builds a proxy URL string from a Proxy DB record.
// Output: "protocol://user:pass@host:port" or "protocol://host:port".
// Matches TS buildProxyUrl from lib/utils/proxy-url.ts.
func BuildProxyUrl(proxy *models.Proxy) string {
	protocol := string(proxy.Type)
	if protocol == "" {
		protocol = "http"
	}

	u := fmt.Sprintf("%s://", protocol)

	if proxy.Username != nil && *proxy.Username != "" && proxy.PasswordEncrypted != nil && *proxy.PasswordEncrypted != "" {
		password := *proxy.PasswordEncrypted // fallback to raw value
		plain, err := DecryptData(*proxy.PasswordEncrypted)
		if err == nil {
			password = plain
		}
		u += fmt.Sprintf("%s:%s@", url.QueryEscape(*proxy.Username), url.QueryEscape(password))
	} else if proxy.Username != nil && *proxy.Username != "" {
		u += fmt.Sprintf("%s@", url.QueryEscape(*proxy.Username))
	}

	u += fmt.Sprintf("%s:%d", proxy.Host, proxy.Port)
	return u
}

// ResolveProxyUrl fetches a proxy by ID from the database and returns the
// full proxy URL string.  Returns empty string if proxy is not found.
// Matches TS resolveProxyUrl from lib/utils/proxy-url.ts.
func ResolveProxyUrl(repo *repository.ProxyRepository, proxyID uuid.UUID) string {
	proxy, err := repo.FindByID(proxyID)
	if err != nil || proxy == nil {
		return ""
	}
	return BuildProxyUrl(proxy)
}

// RedactProxyUrl masks credentials in a proxy URL for safe logging.
// "http://user:pass@host:port" → "http://***:***@host:port"
// Matches TS redactProxyUrl from lib/utils/proxy-helpers.ts.
func RedactProxyUrl(proxyUrl string) string {
	return regexp.MustCompile(`//[^@]+@`).ReplaceAllString(proxyUrl, "//***:***@")
}

// ── Proxy URL from proxy-helpers.ts (alternate) ─────────────────────────────

// BuildProxyUrlFromConfig builds a proxy URL from a PlaywrightProxyConfig and
// the original proxy record.  Matches TS buildProxyUrl from proxy-helpers.ts.
func BuildProxyUrlFromConfig(cfg PlaywrightProxyConfig, proxy *models.Proxy) string {
	if cfg.Username == "" {
		return cfg.Server
	}
	protocol := string(proxy.Type)
	if protocol == "" {
		protocol = "http"
	}
	user := url.QueryEscape(cfg.Username)
	pass := ""
	if cfg.Password != "" {
		pass = ":" + url.QueryEscape(cfg.Password)
	}
	return fmt.Sprintf("%s://%s%s@%s:%d", protocol, user, pass, proxy.Host, proxy.Port)
}

// ── Convenience: Resolve for automation ─────────────────────────────────────

// ResolvePlaywrightProxy fetches a proxy by ID and returns its Playwright
// config.  Returns nil if the proxy doesn't exist.
func ResolvePlaywrightProxy(repo *repository.ProxyRepository, proxyID uuid.UUID) *PlaywrightProxyConfig {
	proxy, err := repo.FindByID(proxyID)
	if err != nil || proxy == nil {
		return nil
	}
	cfg := BuildPlaywrightProxyConfig(proxy)
	return &cfg
}

// ── Masking helper for proxy structs ────────────────────────────────────────

// MaskProxy returns a copy of the Proxy with the password field redacted.
// Useful for including proxy data in API responses without leaking credentials.
func MaskProxy(proxy *models.Proxy) models.Proxy {
	masked := *proxy
	masked.PasswordEncrypted = nil
	return masked
}

// MaskProxies returns a slice of masked proxies.
func MaskProxies(proxies []models.Proxy) []models.Proxy {
	out := make([]models.Proxy, len(proxies))
	for i, p := range proxies {
		out[i] = MaskProxy(&p)
	}
	return out
}
