import { test } from '@playwright/test';
import { E2E_VENDOR } from '../fixtures/vendor';
import {
  gotoStorefront,
  gotoWelcomeScreen,
  openCategory,
  expectNoHorizontalOverflow,
} from '../fixtures/helpers';

/**
 * Baseline layout fence (plan T5): no journey screen may overflow
 * horizontally at any viewport project. Encodes today's behavior as the
 * floor; Phase 3 extends this file with column-count and no-shell-scroll
 * assertions (T16/T17).
 */
test.describe('layout — no horizontal overflow', () => {
  test('welcome screen', async ({ page }) => {
    await gotoWelcomeScreen(page);
    await expectNoHorizontalOverflow(page);
  });

  test('category grid (landing)', async ({ page }) => {
    await gotoStorefront(page);
    await expectNoHorizontalOverflow(page);
  });

  test('product grid', async ({ page }) => {
    await gotoStorefront(page);
    await openCategory(page, E2E_VENDOR.categories.burgers);
    await expectNoHorizontalOverflow(page);
  });

  test('product page', async ({ page }) => {
    await gotoStorefront(page);
    await openCategory(page, E2E_VENDOR.categories.burgers);
    await page.getByText(E2E_VENDOR.products.simple.name).first().click();
    await expectNoHorizontalOverflow(page);
  });
});
