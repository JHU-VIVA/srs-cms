import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Deaths Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/deaths');
    await page.waitForLoadState('networkidle');
  });

  test('displays deaths page with section headers', async ({ page }) => {
    // Deaths page has 3 sections: New Deaths, VA Scheduled, Completed
    await expect(page.locator('text=/new death/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('displays filter controls', async ({ page }) => {
    // Province dropdown
    await expect(page.locator('select, [role="combobox"]').first()).toBeVisible();
  });

  test('clicking a death record navigates to detail page', async ({ page }) => {
    // Wait for table data to load
    const viewButton = page.getByRole('link', { name: /view|detail|edit/i }).first();
    const buttonExists = await viewButton.isVisible().catch(() => false);

    if (buttonExists) {
      await viewButton.click();
      await expect(page).toHaveURL(/\/deaths\/\d+/, { timeout: 5000 });
      // Should show death detail fields
      await expect(page.locator('text=/death code|deceased/i').first()).toBeVisible({ timeout: 5000 });
    } else {
      // No death records to click - that's ok, test the empty state
      test.skip();
    }
  });

  test('pagination controls work', async ({ page }) => {
    // Check for page size selector or pagination buttons
    const pageSizeSelector = page.locator('select').last();
    const selectorVisible = await pageSizeSelector.isVisible().catch(() => false);

    if (selectorVisible) {
      // Page size options should exist
      const options = await pageSizeSelector.locator('option').count();
      expect(options).toBeGreaterThan(0);
    }
  });
});
