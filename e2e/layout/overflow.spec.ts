import { test, expect } from '@playwright/test';
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
test.describe('layout — storefront fills the viewport', () => {
  // T7: the old global `html, body { max-width: 1440px }` letterboxed
  // kiosk-sized screens. The storefront shell must span the full width.
  test('category grid spans the full viewport width', async ({ page }) => {
    await gotoStorefront(page);
    const widths = await page.evaluate(() => ({
      // clientWidth excludes the scrollbar, unlike window.innerWidth.
      viewport: document.documentElement.clientWidth,
      body: document.body.getBoundingClientRect().width,
    }));
    expect(widths.body).toBeGreaterThanOrEqual(widths.viewport - 1);
  });
});

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
