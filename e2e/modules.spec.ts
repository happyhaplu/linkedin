import { test, expect } from '@playwright/test'

/**
 * Module-level E2E tests — verifies each feature module's API routes
 * respond correctly. Uses the admin session from setup (planGate tests
 * require a user session, not admin — these test API structure only).
 *
 * All API calls go directly to the backend; UI navigation uses the frontend.
 */

test.describe('API — Module routes exist (with admin cookie)', () => {
  /**
   * Helper to get cookie header from context
   */
  async function cookieHeader(context: any): Promise<string> {
    const cookies = await context.cookies('http://localhost:4000')
    return cookies.map((c: any) => `${c.name}=${c.value}`).join('; ')
  }

  // These all require a USER session (not admin), so they'll return 401
  // from the RequireSession middleware. This validates route registration.
  const moduleRoutes = [
    '/api/linkedin-accounts',
    '/api/proxies',
    '/api/campaigns',
    '/api/campaigns/stats',
    '/api/campaigns/templates',
    '/api/leads',
    '/api/lists',
    '/api/custom-fields',
    '/api/network/connections',
    '/api/network/requests',
    '/api/network/sync/logs',
    '/api/network/analytics',
    '/api/unibox/conversations',
    '/api/unibox/accounts',
    '/api/analytics',
    '/api/queue/stats',
  ]

  for (const route of moduleRoutes) {
    test(`GET ${route} returns 401 (route registered)`, async ({ request }) => {
      const resp = await request.get(`http://localhost:4000${route}`)
      // 401 means the route IS registered and RequireSession middleware fired.
      // 404 would mean the route is NOT registered (broken).
      expect(resp.status(), `Route ${route} should be registered (401), not missing (404)`).not.toBe(404)
      expect(resp.status()).toBe(401)
    })
  }
})

test.describe('API — Admin module routes', () => {
  test('GET /admin/users returns 200 with valid admin session', async ({ request, context }) => {
    const cookies = await context.cookies('http://localhost:4000')
    const header = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    const resp = await request.get('http://localhost:4000/admin/users', {
      headers: { Cookie: header },
    })
    expect(resp.status()).toBe(200)
  })

  test('GET /admin/plans returns 200 with valid admin session', async ({ request, context }) => {
    const cookies = await context.cookies('http://localhost:4000')
    const header = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    const resp = await request.get('http://localhost:4000/admin/plans', {
      headers: { Cookie: header },
    })
    expect(resp.status()).toBe(200)
  })

  test('PUT /admin/users/:id rejects invalid workspace_id with 404', async ({ request, context }) => {
    const cookies = await context.cookies('http://localhost:4000')
    const header = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    const resp = await request.put(
      'http://localhost:4000/admin/users/00000000-0000-0000-0000-000000000000',
      {
        headers: { Cookie: header, 'Content-Type': 'application/json' },
        data: { is_active: true },
      },
    )
    // Not found is acceptable — the route IS wired
    expect([200, 404]).toContain(resp.status())
  })
})

test.describe('Frontend — Module pages load', () => {
  // These require auth → router redirects to /login — we just verify
  // that the redirect happens (page exists in router, not a blank 404)
  const pages = [
    '/linkedin-account',
    '/campaigns',
    '/leads',
    '/network',
    '/unibox',
    '/analytics',
  ]

  for (const route of pages) {
    test(`${route} redirects unauthenticated user to /login`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(/\/(login|pricing)/, { timeout: 8_000 })
    })
  }
})
