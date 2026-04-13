import { test as setup, expect } from '@playwright/test'
import path from 'path'

/**
 * Admin login setup — runs once before the e2e project.
 * Saves the admin session cookie so all spec files can reuse it.
 *
 * To regenerate:  npx playwright test --project=setup
 */

const ADMIN_STATE = path.join(__dirname, '.auth/admin.json')

setup('admin login', async ({ page, request }) => {
  // Call the backend admin login API directly (faster than UI flow)
  const resp = await request.post('http://localhost:4000/admin/login', {
    data: {
      email: process.env.ADMIN_EMAIL || 'happy.outcraftly@zohomail.in',
      password: process.env.ADMIN_PASSWORD || 'System@123321',
    },
  })

  expect(resp.status()).toBe(200)
  const body = await resp.json()
  expect(body.ok).toBe(true)

  // Visit admin page so browser context receives the cookie
  await page.goto('/admin/login')
  await page.evaluate(
    ({ email, password }) => {
      // Pre-fill and submit the form to get the cookie set in the browser context
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement
      if (emailInput) emailInput.value = email
      if (passwordInput) passwordInput.value = password
    },
    {
      email: process.env.ADMIN_EMAIL || 'happy.outcraftly@zohomail.in',
      password: process.env.ADMIN_PASSWORD || 'System@123321',
    },
  )

  // Click submit and wait for navigation to /admin/users
  await page.click('button[type="submit"]')
  await page.waitForURL('**/admin/users', { timeout: 10_000 })

  // Save cookies + local storage for reuse
  await page.context().storageState({ path: ADMIN_STATE })
})
