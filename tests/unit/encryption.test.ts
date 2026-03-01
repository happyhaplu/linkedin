/**
 * Unit Tests — Encryption utilities
 *
 * Covers: hashPassword, verifyPassword, encryptData, decryptData
 */
import {
  hashPassword,
  verifyPassword,
  encryptData,
  decryptData,
} from '@/lib/utils/encryption'

// ─── hashPassword / verifyPassword ──────────────────────────────────────────

describe('hashPassword & verifyPassword', () => {
  it('hashed password verifies correctly', async () => {
    const hash = await hashPassword('secret123')
    const match = await verifyPassword('secret123', hash)
    expect(match).toBe(true)
  })

  it('wrong password does not verify', async () => {
    const hash = await hashPassword('secret123')
    const match = await verifyPassword('wrong', hash)
    expect(match).toBe(false)
  })

  it('hash is not the plaintext password', async () => {
    const hash = await hashPassword('mypassword')
    expect(hash).not.toBe('mypassword')
    expect(hash.length).toBeGreaterThan(20)
  })

  it('different calls produce different hashes (salted)', async () => {
    const h1 = await hashPassword('same')
    const h2 = await hashPassword('same')
    expect(h1).not.toBe(h2) // bcrypt salts are random
  })

  it('empty string can be hashed and verified', async () => {
    const hash = await hashPassword('')
    expect(await verifyPassword('', hash)).toBe(true)
    expect(await verifyPassword('notempty', hash)).toBe(false)
  })
})

// ─── encryptData / decryptData ──────────────────────────────────────────────

describe('encryptData & decryptData', () => {
  it('round-trips correctly', () => {
    const data = 'sensitive-api-key-12345'
    const encrypted = encryptData(data)
    const decrypted = decryptData(encrypted)
    expect(decrypted).toBe(data)
  })

  it('encrypted value differs from plaintext', () => {
    const data = 'mysecret'
    const encrypted = encryptData(data)
    expect(encrypted).not.toBe(data)
  })

  it('handles empty string', () => {
    const encrypted = encryptData('')
    expect(decryptData(encrypted)).toBe('')
  })

  it('handles unicode characters', () => {
    const data = '密码🔐'
    expect(decryptData(encryptData(data))).toBe(data)
  })

  it('handles long strings', () => {
    const data = 'x'.repeat(10_000)
    expect(decryptData(encryptData(data))).toBe(data)
  })

  it('produces valid base64 output', () => {
    const encrypted = encryptData('test')
    // base64 only contains [A-Za-z0-9+/=]
    expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/)
  })
})
