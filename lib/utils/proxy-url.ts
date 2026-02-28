/**
 * Utility to build a proxy URL string from proxy record fields.
 * Used by cookie auth, campaign automation, and session validation.
 *
 * Output format: `protocol://username:password@host:port`
 *   e.g. `socks5://user:pass@proxy.example.com:1080`
 *   e.g. `http://proxy.example.com:8080`
 */

import { decryptData } from './encryption'

export interface ProxyRecord {
  type: string          // 'http' | 'https' | 'socks4' | 'socks5'
  host: string
  port: number
  username?: string | null
  password_encrypted?: string | null
}

/**
 * Build a proxy URL from a proxy DB record.
 * Decrypts the stored password (base64-encoded) for use in the URL.
 *
 * @returns URL like `socks5://user:pass@host:port` or `http://host:port`
 */
export function buildProxyUrl(proxy: ProxyRecord): string {
  let url = `${proxy.type}://`

  if (proxy.username && proxy.password_encrypted) {
    let password: string
    try {
      password = decryptData(proxy.password_encrypted)
    } catch {
      // If decryption fails (e.g. old bcrypt hash), use raw value as fallback
      password = proxy.password_encrypted
    }
    url += `${encodeURIComponent(proxy.username)}:${encodeURIComponent(password)}@`
  } else if (proxy.username) {
    url += `${encodeURIComponent(proxy.username)}@`
  }

  url += `${proxy.host}:${proxy.port}`
  return url
}

/**
 * Build a proxy URL from a proxy_id by fetching the proxy record.
 * Works with any Supabase client (server or service-role).
 */
export async function resolveProxyUrl(
  supabase: any,
  proxyId: string | null | undefined
): Promise<string | undefined> {
  if (!proxyId) return undefined

  const { data: proxy, error } = await supabase
    .from('proxies')
    .select('type, host, port, username, password_encrypted')
    .eq('id', proxyId)
    .single()

  if (error || !proxy) {
    console.warn(`[Proxy] Failed to resolve proxy ${proxyId}:`, error?.message || 'not found')
    return undefined
  }

  return buildProxyUrl(proxy)
}
