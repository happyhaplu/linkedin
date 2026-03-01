/**
 * Unit Tests — Proxy Helpers
 *
 * Covers: buildPlaywrightProxyConfig, buildProxyUrl, redactProxyUrl
 */
import {
  buildPlaywrightProxyConfig,
  buildProxyUrl,
  redactProxyUrl,
} from '@/lib/utils/proxy-helpers'

// Mock encryption module
jest.mock('@/lib/utils/encryption', () => ({
  decryptData: (enc: string) => Buffer.from(enc, 'base64').toString('utf-8'),
}))

// ─── Test Data ──────────────────────────────────────────────────────────────

const httpProxy = {
  type: 'http',
  host: '31.59.20.176',
  port: 6754,
  username: 'xfkfrbeb',
  password_encrypted: Buffer.from('8jpnmtlggdcn').toString('base64'),
}

const socks5Proxy = {
  type: 'socks5',
  host: 'proxy.example.com',
  port: 1080,
  username: 'user',
  password_encrypted: Buffer.from('pass').toString('base64'),
}

const noAuthProxy = {
  type: 'http',
  host: 'open-proxy.example.com',
  port: 8080,
}

const usernameOnlyProxy = {
  type: 'http',
  host: 'proxy.example.com',
  port: 3128,
  username: 'justuser',
}

// ─── buildPlaywrightProxyConfig ─────────────────────────────────────────────

describe('buildPlaywrightProxyConfig', () => {
  it('builds correct server URL', () => {
    const config = buildPlaywrightProxyConfig(httpProxy)
    expect(config.server).toBe('http://31.59.20.176:6754')
  })

  it('includes username and decrypted password', () => {
    const config = buildPlaywrightProxyConfig(httpProxy)
    expect(config.username).toBe('xfkfrbeb')
    expect(config.password).toBe('8jpnmtlggdcn')
  })

  it('handles socks5 protocol', () => {
    const config = buildPlaywrightProxyConfig(socks5Proxy)
    expect(config.server).toBe('socks5://proxy.example.com:1080')
    expect(config.username).toBe('user')
    expect(config.password).toBe('pass')
  })

  it('omits auth for proxy without credentials', () => {
    const config = buildPlaywrightProxyConfig(noAuthProxy)
    expect(config.server).toBe('http://open-proxy.example.com:8080')
    expect(config.username).toBeUndefined()
    expect(config.password).toBeUndefined()
  })

  it('handles username-only proxy', () => {
    const config = buildPlaywrightProxyConfig(usernameOnlyProxy)
    expect(config.username).toBe('justuser')
    expect(config.password).toBeUndefined()
  })

  it('defaults protocol to http when type is empty', () => {
    const config = buildPlaywrightProxyConfig({ type: '', host: 'h', port: 1 })
    expect(config.server).toMatch(/^http:\/\//)
  })
})

// ─── buildProxyUrl ──────────────────────────────────────────────────────────

describe('buildProxyUrl', () => {
  it('builds full URL with credentials', () => {
    const url = buildProxyUrl(httpProxy)
    expect(url).toContain('http://')
    expect(url).toContain('xfkfrbeb')
    expect(url).toContain('31.59.20.176:6754')
  })

  it('builds URL without credentials', () => {
    const url = buildProxyUrl(noAuthProxy)
    expect(url).toBe('http://open-proxy.example.com:8080')
    expect(url).not.toContain('@')
  })

  it('returns correct socks5 URL', () => {
    const url = buildProxyUrl(socks5Proxy)
    expect(url).toMatch(/^socks5:\/\//)
    expect(url).toContain('proxy.example.com:1080')
  })
})

// ─── redactProxyUrl ─────────────────────────────────────────────────────────

describe('redactProxyUrl', () => {
  it('masks credentials in URL', () => {
    const url = 'http://user:pass@proxy.com:8080'
    const redacted = redactProxyUrl(url)
    expect(redacted).toBe('http://***:***@proxy.com:8080')
    expect(redacted).not.toContain('user')
    expect(redacted).not.toContain('pass')
  })

  it('masks socks5 URL credentials', () => {
    const url = 'socks5://admin:secret123@10.0.0.1:1080'
    const redacted = redactProxyUrl(url)
    expect(redacted).toBe('socks5://***:***@10.0.0.1:1080')
  })

  it('leaves URL without credentials unchanged', () => {
    const url = 'http://proxy.com:8080'
    expect(redactProxyUrl(url)).toBe('http://proxy.com:8080')
  })
})
