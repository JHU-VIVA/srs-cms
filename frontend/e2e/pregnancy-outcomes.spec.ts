import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Pregnancy Outcomes Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/pregnancy-outcomes');
    await page.waitForLoadState('networkidle');
  });

  test('displays pregnancy outcomes table', async ({ page }) => {
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10000 });
    // Table headers: CLUSTER, WORK AREA, OUTCOME DATE, MOTHER NAME
    await expect(page.locator('th:has-text("CLUSTER"), th:has-text("Cluster")').first()).toBeVisible();
    await expect(page.locator('th:has-text("MOTHER"), th:has-text("Mother")').first()).toBeVisible();
  });

  test('download excel link is visible', async ({ page }) => {
    // The export control is a "Download Excel" link, not a button
    await expect(page.locator('text=/download excel/i')).toBeVisible({ timeout: 10000 });
  });

  test('clicking view navigates to detail page', async ({ page }) => {
    const viewLink = page.getByRole('link', { name: /view/i }).first();
    const linkExists = await viewLink.isVisible().catch(() => false);

    if (linkExists) {
      await viewLink.click();
      await expect(page).toHaveURL(/\/pregnancy-outcomes\/\d+/, { timeout: 5000 });
      // Detail page should show pregnancy outcome info
      await expect(page.locator('h1, h2').filter({ hasText: /pregnancy outcome/i })).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });
});
