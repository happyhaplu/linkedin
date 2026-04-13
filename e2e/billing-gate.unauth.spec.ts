import { test, expect } from '@playwright/test'

/**
 * Billing gate E2E tests.
 *
 * These run in the unauthenticated project (no stored session).
 * They test API responses directly, not the UI (since we can't do
 * a full OAuth flow in E2E without mocking accounts.gour.io).
 */

test.describe('Billing gate — API contract', () => {
  test('/api/auth/me returns 401 without session (never 402)', async ({ request }) => {
    const resp = await request.get('http://localhost:4000/api/auth/me')
    expect(resp.status()).toBe(401)
    // Must NOT be 402 — this was the regression bug
    expect(resp.status()).not.toBe(402)
  })

  test('/api/billing/checkout returns 401 without session (not 402)', async ({ request }) => {
    const resp = await request.post('http://localhost:4000/api/billing/checkout', {
      data: { price_id: 'price_test_123' },
    })
    // Session-only endpoint → 401
    expect(resp.status()).toBe(401)
  })

  test('/api/linkedin-accounts returns 401 without session', async ({ request }) => {
    const resp = await request.get('http://localhost:4000/api/linkedin-accounts')
    expect(resp.status()).toBe(401)
    expect(resp.status()).not.toBe(402)
  })

  test('all module endpoints return 401 (not 402) without session', async ({ request }) => {
    const endpoints = [
      { method: 'GET', path: '/api/campaigns' },
      { method: 'GET', path: '/api/leads' },
      { method: 'GET', path: '/api/lists' },
      { method: 'GET', path: '/api/network/connections' },
      { method: 'GET', path: '/api/unibox/conversations' },
      { method: 'GET', path: '/api/analytics' },
      { method: 'GET', path: '/api/proxies' },
      { method: 'GET', path: '/api/queue/stats' },
    ]

    for (const ep of endpoints) {
      const resp = await request.get(`http://localhost:4000${ep.path}`)
      expect(resp.status(), `${ep.method} ${ep.path} should be 401 without session`).toBe(401)
      expect(resp.status(), `${ep.method} ${ep.path} must NOT be 402 without session`).not.toBe(402)
    }
  })
})

test.describe('Billing gate — UI redirect', () => {
  test('/pricing page is accessible without auth', async ({ page }) => {
    await page.goto('/pricing')
    // Should render, not redirect to /login
    await expect(page.locator('h1')).toContainText(/plan/i, { timeout: 8_000 })
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('/pricing page shows Stripe pricing section', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.locator('text=Subscription Plans')).toBeVisible({ timeout: 8_000 })
  })

  test('/pricing page shows custom/enterprise section', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.locator('text=Enterprise, text=Custom, text=custom')).toBeVisible({ timeout: 8_000 })
  })
})
