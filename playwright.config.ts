import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E configuration for Reach.
 *
 * Uses the SYSTEM-INSTALLED Google Chrome (/usr/bin/google-chrome).
 * No browsers are downloaded — run `playwright install` only if you
 * want to test with Playwright's bundled Chromium on CI.
 *
 * Usage:
 *   npx playwright test                  # run all e2e tests
 *   npx playwright test --ui             # interactive UI
 *   npx playwright test e2e/smoke.spec.ts
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,       // sequential — easier to debug auth state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 30_000,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: 'http://localhost:3000',
    // Use system Chrome — no download required
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    // All tests share cookies (session persists across spec files if needed)
    storageState: undefined,
  },

  projects: [
    // ── Setup project: logs in and saves auth state ─────────────────────
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },

    // ── Main e2e suite using saved auth state ────────────────────────────
    {
      name: 'e2e',
      testMatch: /.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        // Reuse the admin session saved by admin.setup.ts
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
    },

    // ── Unauthenticated tests (no saved state) ───────────────────────────
    {
      name: 'unauthenticated',
      testMatch: /.*\.unauth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],

  // Start both servers before running tests
  webServer: [
    {
      command: 'cd backend && ./bin/reach-server',
      url: 'http://localhost:4000/health',
      reuseExistingServer: true,
      timeout: 15_000,
    },
    {
      command: 'cd frontend && npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
})
