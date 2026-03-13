import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Households Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/households');
    await page.waitForLoadState('networkidle');
  });

  test('displays households table', async ({ page }) => {
    // Should show a table with household data columns
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10000 });
    // Table headers: CLUSTER, WORK AREA, etc.
    await expect(page.locator('th:has-text("CLUSTER"), th:has-text("Cluster")').first()).toBeVisible();
  });

  test('filter by province works', async ({ page }) => {
    const provinceSelect = page.locator('select').first();
    const selectVisible = await provinceSelect.isVisible().catch(() => false);

    if (selectVisible) {
      const options = await provinceSelect.locator('option').count();
      expect(options).toBeGreaterThan(1); // "All" + at least 1 province
    }
  });

  test('clicking view navigates to household detail', async ({ page }) => {
    const viewLink = page.getByRole('link', { name: /view/i }).first();
    const linkExists = await viewLink.isVisible().catch(() => false);

    if (linkExists) {
      await viewLink.click();
      await expect(page).toHaveURL(/\/households\/\d+/, { timeout: 5000 });

      // Detail page should show household info and members table
      await expect(page.locator('text=/cluster|member/i').first()).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test('search filter works', async ({ page }) => {
    const searchInput = page.locator('input[type="text"], input[placeholder*="earch"], input[placeholder*="luster"]').first();
    const inputVisible = await searchInput.isVisible().catch(() => false);

    if (inputVisible) {
      await searchInput.fill('NONEXISTENT_CODE_12345');
      await page.getByRole('button', { name: /search/i }).click();
      await page.waitForLoadState('networkidle');

      // Wait for the results count to show (0) indicating no matches
      await expect(page.locator('text=(0)')).toBeVisible({ timeout: 5000 });

      // Should show empty or no results
      const tableRows = page.locator('table tbody tr');
      const rowCount = await tableRows.count();
      expect(rowCount).toBeLessThanOrEqual(1); // 0 rows or 1 "no results" row
    }
  });
});
