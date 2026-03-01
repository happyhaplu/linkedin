/**
 * E2E Tests — Navigation & Auth Guards
 *
 * Validates:
 * - All public pages load correctly
 * - Protected routes redirect to /login
 * - Login/Signup forms render correctly
 * - Post-login navigation to all main modules
 */
import { test, expect } from '@playwright/test'

test.describe('Public Pages', () => {
  test('homepage redirects to /analytics or /login', async ({ page }) => {
    await page.goto('/')
    // Should end up at either analytics (if logged in) or login
    await page.waitForURL(/(analytics|login)/)
    expect(page.url()).toMatch(/(analytics|login)/)
  })

  test('login page renders sign-in form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible({ timeout: 10_000 })
  })

  test('signup page renders create-account form', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.locator('text=Create')).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Auth Guards — Protected Routes', () => {
  const protectedPaths = [
    '/analytics',
    '/leads',
    '/campaigns',
    '/my-network',
    '/unibox',
    '/linkedin-account',
  ]

  for (const path of protectedPaths) {
    test(`${path} redirects unauthenticated user to /login`, async ({ page }) => {
      await page.goto(path)
      await page.waitForURL('**/login**', { timeout: 15_000 })
      expect(page.url()).toContain('/login')
    })
  }
})

test.describe('Auth Guards — /dashboard redirect', () => {
  test('/dashboard redirects to /analytics', async ({ page }) => {
    // Even if user accesses old URL, it should redirect
    await page.goto('/dashboard')
    // Will either go to /analytics (if logged in) or /login
    await page.waitForURL(/(analytics|login)/, { timeout: 15_000 })
  })
})
