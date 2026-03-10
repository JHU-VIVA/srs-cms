import { test, expect } from '@playwright/test';

const USERNAME = 'admin';
const PASSWORD = 'admin';

test.describe('Authentication', () => {
  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows login form with username and password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="text"], input[name="username"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /login|sign in/i })).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="text"], input[name="username"]').fill('wronguser');
    await page.locator('input[type="password"]').fill('wrongpass');
    await page.getByRole('button', { name: /login|sign in/i }).click();

    // Should stay on login page and show error
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('text=/error|invalid|incorrect|failed/i')).toBeVisible({ timeout: 5000 });
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="text"], input[name="username"]').fill(USERNAME);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole('button', { name: /login|sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('logout returns to login page', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.locator('input[type="text"], input[name="username"]').fill(USERNAME);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole('button', { name: /login|sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Logout — the avatar button opens a dropdown or triggers logout directly
    const avatar = page.locator('.avatar, [class*="avatar"]').first();
    const avatarVisible = await avatar.isVisible().catch(() => false);
    if (avatarVisible) {
      await avatar.click();
    }
    // Look for logout in dropdown or page
    const logoutBtn = page.locator('text=/logout|sign out/i').first();
    await logoutBtn.click({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
