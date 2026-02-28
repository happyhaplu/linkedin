/**
 * Proxy Helpers
 * Converts proxy record fields into formats that Playwright understands.
 *
 * Playwright supports proxies via the `proxy` option on browser.newContext():
 *   proxy: { server: 'http://host:port', username: 'user', password: 'pass' }
 *
 * This is MUCH better than --proxy-server Chromium arg because:
 *   1. --proxy-server doesn't support inline auth (user:pass@host)
 *   2. Context-level proxy handles HTTPS CONNECT properly
 *   3. Playwright routes auth headers automatically
 */

import { decryptData } from './encryption'

export interface ProxyRecord {
  type: string        // 'http' | 'https' | 'socks4' | 'socks5'
  host: string
  port: number
  username?: string | null
  password_encrypted?: string | null
}

/** Playwright-compatible proxy config for browser.newContext({ proxy: ... }) */
export interface PlaywrightProxyConfig {
  server: string       // e.g. "http://31.59.20.176:6754"
  username?: string    // e.g. "xfkfrbeb"
  password?: string    // e.g. "8jpnmtlggdcn" (decrypted)
}

/**
 * Build a Playwright proxy config from a proxy DB record.
 * Returns { server, username, password } for use with browser.newContext({ proxy }).
 */
export function buildPlaywrightProxyConfig(proxy: ProxyRecord): PlaywrightProxyConfig {
  const protocol = proxy.type || 'http'
  const config: PlaywrightProxyConfig = {
    server: `${protocol}://${proxy.host}:${proxy.port}`
  }

  if (proxy.username) {
    config.username = proxy.username
    if (proxy.password_encrypted) {
      try {
        config.password = decryptData(proxy.password_encrypted)
      } catch {
        console.warn('[buildPlaywrightProxyConfig] Could not decrypt proxy password')
      }
    }
  }

  return config
}

/**
 * Build a proxy URL string (for logging / non-Playwright use).
 * @returns e.g. "http://user:pass@proxy.example.com:1080"
 */
export function buildProxyUrl(proxy: ProxyRecord): string {
  const config = buildPlaywrightProxyConfig(proxy)
  let url = config.server
  if (config.username) {
    const protocol = proxy.type || 'http'
    const user = encodeURIComponent(config.username)
    const pass = config.password ? `:${encodeURIComponent(config.password)}` : ''
    url = `${protocol}://${user}${pass}@${proxy.host}:${proxy.port}`
  }
  return url
}

/**
 * Redact credentials from proxy URL for safe logging.
 */
export function redactProxyUrl(url: string): string {
  return url.replace(/\/\/[^@]+@/, '//***:***@')
}
