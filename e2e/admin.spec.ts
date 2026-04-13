import { test, expect } from '@playwright/test'

/**
 * Admin panel E2E tests.
 * Uses storageState saved by admin.setup.ts (reach-admin-session cookie).
 *
 * Tests: login, users list, plans list, create plan, assign plan.
 */

test.describe('Admin — navigation', () => {
  test('redirects to /admin/users after login', async ({ page }) => {
    // storageState already has admin session — just navigate
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/users/, { timeout: 8_000 })
  })

  test('/admin/users renders the users table', async ({ page }) => {
    await page.goto('/admin/users')
    // Heading
    await expect(page.locator('h1, h2').filter({ hasText: /user/i })).toBeVisible({ timeout: 8_000 })
  })

  test('/admin/plans renders the plans table', async ({ page }) => {
    await page.goto('/admin/plans')
    await expect(page.locator('h1, h2').filter({ hasText: /plan/i })).toBeVisible({ timeout: 8_000 })
  })

  test('admin nav links work', async ({ page }) => {
    await page.goto('/admin/users')
    // Click Plans link in sidebar / nav
    await page.click('a[href="/admin/plans"], a:has-text("Plans")')
    await expect(page).toHaveURL(/\/admin\/plans/, { timeout: 5_000 })
  })
})

test.describe('Admin — API (with admin session cookie)', () => {
  test('GET /admin/me returns admin email', async ({ request, context }) => {
    // Get cookies from the browser context (saved by setup)
    const cookies = await context.cookies('http://localhost:4000')
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

    const resp = await request.get('http://localhost:4000/admin/me', {
      headers: { Cookie: cookieHeader },
    })
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body.role).toBe('admin')
    expect(body.email).toBeTruthy()
  })

  test('GET /admin/users returns array of users', async ({ request, context }) => {
    const cookies = await context.cookies('http://localhost:4000')
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

    const resp = await request.get('http://localhost:4000/admin/users', {
      headers: { Cookie: cookieHeader },
    })
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(Array.isArray(body.users ?? body)).toBe(true)
  })

  test('GET /admin/plans returns array of plans', async ({ request, context }) => {
    const cookies = await context.cookies('http://localhost:4000')
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

    const resp = await request.get('http://localhost:4000/admin/plans', {
      headers: { Cookie: cookieHeader },
    })
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(Array.isArray(body.plans ?? body)).toBe(true)
  })

  test('POST /admin/plans creates a plan successfully', async ({ request, context }) => {
    const cookies = await context.cookies('http://localhost:4000')
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

    const resp = await request.post('http://localhost:4000/admin/plans', {
      headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
      data: {
        name: 'E2E-Test-Plan',
        type: 'custom',
        description: 'Created by playwright e2e test',
        max_linkedin_senders: 1,
        features: ['Test feature'],
        is_active: true,
      },
    })
    // 201 Created or 200 OK
    expect([200, 201]).toContain(resp.status())
    const body = await resp.json()
    const plan = body.plan ?? body
    expect(plan.name).toBe('E2E-Test-Plan')
    expect(plan.id).toBeTruthy()
  })
})
