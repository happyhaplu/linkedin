/**
 * Unit Tests — Proxy URL builder
 *
 * Covers: buildProxyUrl (from proxy-url.ts), resolveProxyUrl
 */
import { buildProxyUrl } from '@/lib/utils/proxy-url'

jest.mock('@/lib/utils/encryption', () => ({
  decryptData: (enc: string) => Buffer.from(enc, 'base64').toString('utf-8'),
}))

const encPass = (plain: string) => Buffer.from(plain).toString('base64')

// ─── buildProxyUrl (proxy-url.ts version) ───────────────────────────────────

describe('buildProxyUrl (proxy-url.ts)', () => {
  it('builds http proxy URL with auth', () => {
    const url = buildProxyUrl({
      type: 'http',
      host: 'proxy.example.com',
      port: 8080,
      username: 'user',
      password_encrypted: encPass('pass'),
    })
    expect(url).toBe('http://user:pass@proxy.example.com:8080')
  })

  it('builds socks5 proxy URL', () => {
    const url = buildProxyUrl({
      type: 'socks5',
      host: '10.0.0.1',
      port: 1080,
      username: 'admin',
      password_encrypted: encPass('s3cret'),
    })
    expect(url).toBe('socks5://admin:s3cret@10.0.0.1:1080')
  })

  it('builds URL without credentials', () => {
    const url = buildProxyUrl({
      type: 'http',
      host: 'open-proxy.com',
      port: 3128,
    })
    expect(url).toBe('http://open-proxy.com:3128')
  })

  it('handles username without password', () => {
    const url = buildProxyUrl({
      type: 'http',
      host: 'proxy.com',
      port: 8080,
      username: 'onlyuser',
    })
    expect(url).toContain('onlyuser@')
    expect(url).not.toContain(':@')
  })

  it('URL-encodes special characters in username/password', () => {
    const url = buildProxyUrl({
      type: 'http',
      host: 'proxy.com',
      port: 8080,
      username: 'user@domain',
      password_encrypted: encPass('p@ss word'),
    })
    expect(url).toContain(encodeURIComponent('user@domain'))
    expect(url).toContain(encodeURIComponent('p@ss word'))
  })
})
