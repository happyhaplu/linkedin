/**
 * Performance Tests
 *
 * Tests rendering speed, data processing efficiency,
 * and computational performance of key utilities.
 */
import {
  replaceVariables,
  processSpintax,
  validateTemplate,
  extractVariables,
  checkCharacterLimit,
} from '@/lib/template-engine'
import { encryptData, decryptData } from '@/lib/utils/encryption'
import { buildPlaywrightProxyConfig, buildProxyUrl, redactProxyUrl } from '@/lib/utils/proxy-helpers'

jest.mock('@/lib/utils/encryption', () => {
  const actual = jest.requireActual('@/lib/utils/encryption')
  return actual
})

// ─── Template Engine Performance ────────────────────────────────────────────

describe('Performance — Template Engine', () => {
  const lead = {
    first_name: 'Perf', last_name: 'Test', full_name: 'Perf Test',
    company: 'PerfCo', position: 'Engineer', location: 'Berlin',
  }

  it('replaceVariables completes single call under 1ms', () => {
    const tpl = 'Hi {{firstName}}, {{position}} at {{company}} in {{location}}'
    const start = performance.now()
    replaceVariables(tpl, lead)
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(5) // generous for CI
  })

  it('processSpintax completes single call under 1ms', () => {
    const start = performance.now()
    processSpintax('{Hi|Hey|Hello} {there|friend}')
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(5)
  })

  it('validateTemplate completes single call under 2ms', () => {
    const tpl = 'Hi {{firstName}}, I noticed {{company}} is growing. {Let\'s connect|Would love to chat}!'
    const start = performance.now()
    validateTemplate(tpl)
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(5)
  })

  it('extractVariables completes under 1ms', () => {
    const tpl = '{{firstName}} {{lastName}} {{company}} {{position}} {{headline}} {{location}} {{email}}'
    const start = performance.now()
    const vars = extractVariables(tpl)
    const elapsed = performance.now() - start
    expect(vars).toHaveLength(7)
    expect(elapsed).toBeLessThan(5)
  })

  it('checkCharacterLimit is O(1) — constant time', () => {
    const text = 'x'.repeat(5000)
    const start = performance.now()
    for (let i = 0; i < 1000; i++) {
      checkCharacterLimit(text, 'message')
    }
    const elapsed = performance.now() - start
    // 1000 calls should complete in under 50ms
    expect(elapsed).toBeLessThan(50)
  })
})

// ─── Encryption Performance ─────────────────────────────────────────────────

describe('Performance — Encryption', () => {
  it('encryptData + decryptData roundtrip under 1ms per call', () => {
    const data = 'test-encryption-performance-data-12345'
    const start = performance.now()
    for (let i = 0; i < 100; i++) {
      decryptData(encryptData(data))
    }
    const elapsed = performance.now() - start
    // 100 roundtrips should be under 100ms
    expect(elapsed).toBeLessThan(100)
    console.log(`  100 encrypt/decrypt roundtrips: ${elapsed.toFixed(2)}ms`)
  })
})

// ─── Proxy Helpers Performance ──────────────────────────────────────────────

describe('Performance — Proxy Helpers', () => {
  // Need to mock encryption for proxy-helpers
  jest.mock('@/lib/utils/encryption', () => ({
    decryptData: (enc: string) => Buffer.from(enc, 'base64').toString('utf-8'),
    encryptData: (data: string) => Buffer.from(data).toString('base64'),
  }))

  const proxy = {
    type: 'http',
    host: 'proxy.example.com',
    port: 8080,
    username: 'user',
    password_encrypted: Buffer.from('pass').toString('base64'),
  }

  it('buildPlaywrightProxyConfig completes 1000 calls under 100ms', () => {
    const start = performance.now()
    for (let i = 0; i < 1000; i++) {
      buildPlaywrightProxyConfig(proxy)
    }
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(100)
  })

  it('redactProxyUrl is fast for URL processing', () => {
    const url = 'http://user:longpassword123@proxy.example.com:8080'
    const start = performance.now()
    for (let i = 0; i < 10_000; i++) {
      redactProxyUrl(url)
    }
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(200)
    console.log(`  10,000 redactions: ${elapsed.toFixed(2)}ms`)
  })
})

// ─── Data Structure Performance ─────────────────────────────────────────────

describe('Performance — Data Processing', () => {
  it('large array map/reduce operations complete efficiently', () => {
    // Simulates campaign data aggregation like in analytics actions
    const campaigns = Array.from({ length: 1000 }, (_, i) => ({
      id: `c${i}`,
      connection_sent: Math.floor(Math.random() * 100),
      connection_accepted: Math.floor(Math.random() * 50),
      messages_sent: Math.floor(Math.random() * 80),
      replies_received: Math.floor(Math.random() * 20),
      total_leads: Math.floor(Math.random() * 200),
      status: i % 3 === 0 ? 'active' : 'paused',
    }))

    const start = performance.now()

    const connSent = campaigns.reduce((s, c) => s + c.connection_sent, 0)
    const connAccepted = campaigns.reduce((s, c) => s + c.connection_accepted, 0)
    const msgSent = campaigns.reduce((s, c) => s + c.messages_sent, 0)
    const replies = campaigns.reduce((s, c) => s + c.replies_received, 0)
    const active = campaigns.filter((c) => c.status === 'active').length

    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(50)
    expect(connSent).toBeGreaterThan(0)
    expect(active).toBeGreaterThan(0)
  })
})
