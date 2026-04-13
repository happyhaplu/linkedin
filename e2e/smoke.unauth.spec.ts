import { test, expect } from '@playwright/test'

/**
 * Smoke tests — verify the app is reachable and key pages render.
 * These run without any auth state (unauthenticated project).
 *
 * Grouped in the "unauthenticated" project — no storageState needed.
 */

test.describe('Smoke — public pages', () => {
  test('health endpoint responds ok', async ({ request }) => {
    const resp = await request.get('http://localhost:4000/health')
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('reach-backend')
  })

  test('frontend root loads and redirects to /login for unauthenticated users', async ({ page }) => {
    await page.goto('/')
    // Should land on /login (router guard redirects to login when no session)
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('/login page renders Reach branding', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('h1')).toContainText('Reach')
  })

  test('/login page shows loading spinner (redirect in progress)', async ({ page }) => {
    await page.goto('/login')
    // The spinner or loading text should appear
    const spinner = page.locator('.animate-spin, [class*="spin"]')
    await expect(spinner).toBeVisible({ timeout: 5_000 })
  })

  test('/pricing page renders without auth', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.locator('h1')).toContainText(/plan/i)
  })

  test('/admin/login page renders', async ({ page }) => {
    await page.goto('/admin/login')
    await expect(page.locator('h1')).toContainText('Admin Panel')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('unknown route redirects to login', async ({ page }) => {
    await page.goto('/some/unknown/path')
    await expect(page).toHaveURL(/\/(login|pricing)/, { timeout: 8_000 })
  })
})

test.describe('Smoke — API contract (no session)', () => {
  test('GET /api/auth/me returns 401 without session', async ({ request }) => {
    const resp = await request.get('http://localhost:4000/api/auth/me')
    expect(resp.status()).toBe(401)
    const body = await resp.json()
    expect(body.error).toBeTruthy()
  })

  test('GET /api/linkedin-accounts returns 401 without session', async ({ request }) => {
    const resp = await request.get('http://localhost:4000/api/linkedin-accounts')
    expect(resp.status()).toBe(401)
  })

  test('GET /api/campaigns returns 401 without session', async ({ request }) => {
    const resp = await request.get('http://localhost:4000/api/campaigns')
    expect(resp.status()).toBe(401)
  })

  test('POST /admin/login with wrong credentials returns 401', async ({ request }) => {
    const resp = await request.post('http://localhost:4000/admin/login', {
      data: { email: 'wrong@example.com', password: 'wrongpassword' },
    })
    expect(resp.status()).toBe(401)
    const body = await resp.json()
    expect(body.error).toBeTruthy()
  })

  test('GET /admin/users without admin session returns 401', async ({ request }) => {
    const resp = await request.get('http://localhost:4000/admin/users')
    expect(resp.status()).toBe(401)
  })
})
