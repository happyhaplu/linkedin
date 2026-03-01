/**
 * Load / Stress Tests
 *
 * Tests system behaviour under concurrent load:
 * - Template engine throughput
 * - Encryption throughput
 * - Concurrent webhook delivery
 * - Memory stability under repeated operations
 */
import {
  replaceVariables,
  processSpintax,
  processTemplate,
} from '@/lib/template-engine'
import { hashPassword, encryptData, decryptData } from '@/lib/utils/encryption'

const heavyLead = {
  first_name: 'LoadTest',
  last_name: 'User',
  full_name: 'LoadTest User',
  company: 'StressCorp',
  position: 'CTO',
  headline: 'Chief Technology Officer at StressCorp',
  location: 'New York, NY',
  email: 'load@test.com',
  linkedin_url: 'https://linkedin.com/in/loadtest',
}

// ─── Template Engine Throughput ─────────────────────────────────────────────

describe('Template Engine — Load', () => {
  it('processes 10,000 templates in under 2 seconds', () => {
    const tpl = 'Hi {{firstName}}, I see you are {{position}} at {{company}}. {Let\'s connect!|Would love to chat!}'
    const start = performance.now()

    for (let i = 0; i < 10_000; i++) {
      processTemplate(tpl, heavyLead)
    }

    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(2000)
    console.log(`  10,000 templates processed in ${elapsed.toFixed(0)}ms`)
  })

  it('handles 1,000 concurrent variable replacements', () => {
    const templates = Array.from({ length: 1000 }, (_, i) =>
      `Hi {{firstName}}, message #${i} for {{company}}`
    )
    const start = performance.now()

    const results = templates.map((tpl) => replaceVariables(tpl, heavyLead))

    const elapsed = performance.now() - start
    expect(results).toHaveLength(1000)
    results.forEach((r, i) => {
      expect(r).toContain('LoadTest')
      expect(r).toContain(`message #${i}`)
    })
    expect(elapsed).toBeLessThan(1000)
    console.log(`  1,000 replacements in ${elapsed.toFixed(0)}ms`)
  })

  it('processes deeply nested spintax within limits', () => {
    // Generate template with many spintax groups
    const groups = Array.from({ length: 100 }, (_, i) => `{opt${i}a|opt${i}b|opt${i}c}`)
    const tpl = groups.join(' ')

    const start = performance.now()
    const result = processSpintax(tpl)
    const elapsed = performance.now() - start

    expect(result).not.toContain('{')
    expect(result).not.toContain('}')
    expect(elapsed).toBeLessThan(500)
  })
})

// ─── Encryption Throughput ──────────────────────────────────────────────────

describe('Encryption — Load', () => {
  it('encrypts/decrypts 10,000 strings in under 1 second', () => {
    const start = performance.now()

    for (let i = 0; i < 10_000; i++) {
      const enc = encryptData(`secret-${i}`)
      decryptData(enc)
    }

    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(1000)
    console.log(`  10,000 encrypt/decrypt in ${elapsed.toFixed(0)}ms`)
  })

  it('hashing 10 passwords completes in under 10 seconds', async () => {
    const start = performance.now()

    const promises = Array.from({ length: 10 }, (_, i) =>
      hashPassword(`password-${i}`)
    )
    const hashes = await Promise.all(promises)

    const elapsed = performance.now() - start
    expect(hashes).toHaveLength(10)
    expect(elapsed).toBeLessThan(10_000)
    console.log(`  10 password hashes in ${elapsed.toFixed(0)}ms`)
  })
})

// ─── Memory Stability ───────────────────────────────────────────────────────

describe('Memory Stability', () => {
  it('repeated template processing does not leak memory', () => {
    const baseline = process.memoryUsage().heapUsed

    for (let i = 0; i < 50_000; i++) {
      processTemplate('Hi {{firstName}} at {{company}}', heavyLead)
    }

    // Force GC if available
    if (global.gc) global.gc()

    const after = process.memoryUsage().heapUsed
    const growthMB = (after - baseline) / 1024 / 1024

    // Should not grow by more than 50MB after 50K operations
    expect(growthMB).toBeLessThan(50)
    console.log(`  Memory growth after 50K ops: ${growthMB.toFixed(2)}MB`)
  })
})
