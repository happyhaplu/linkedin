import { test, expect } from '@playwright/test';

test('homepage loads and redirects appropriately', async ({ page }) => {
  await page.goto('/');

  // The homepage should load (it might redirect to login or dashboard)
  await expect(page).toHaveTitle(/Outcraftly/);
});

test('login page loads', async ({ page }) => {
  await page.goto('/login');

  // Check if login page loads
  await expect(page.locator('text=Sign in to your account')).toBeVisible();
});

test('signup page loads', async ({ page }) => {
  await page.goto('/signup');

  // Check if signup page loads
  await expect(page.locator('text=Create your account')).toBeVisible();
});

test('protected pages redirect to login when not authenticated', async ({ page }) => {
  // Test dashboard redirect
  await page.goto('/dashboard');
  await page.waitForURL('**/login**');
  await expect(page).toHaveURL(/\/login/);

  // Test my-network redirect
  await page.goto('/my-network');
  await page.waitForURL('**/login**');
  await expect(page).toHaveURL(/\/login/);
});

// Note: Full dashboard and My Network functionality tests require authentication
// These would need to be updated with proper authentication setup
// for now, we validate that the app structure and auth flow is correct