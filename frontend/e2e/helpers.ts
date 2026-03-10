import { Page, expect } from '@playwright/test';

export const USERNAME = 'admin';
export const PASSWORD = 'admin';

export async function login(page: Page) {
  await page.goto('/login');
  await page.locator('input[type="text"], input[name="username"]').fill(USERNAME);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: /login|sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
}
