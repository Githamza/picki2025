import { test, expect } from '@playwright/test';
import { E2E_VENDOR } from '../fixtures/vendor';
import {
  gotoStorefront,
  openCategory,
  openProduct,
  addSimpleProductToCart,
  dismissUpsellIfOffered,
  openCartSheet,
  checkoutPayAtCounter,
} from '../fixtures/helpers';

/**
 * FR3 (plan T20): the key navigation moves carry view-transition names,
 * and the whole journey still completes under prefers-reduced-motion.
 */

async function expectVtName(
  page: import('@playwright/test').Page,
  selector: string,
  name: string
) {
  // The directive assigns the name in an effect() that flushes after the
  // element attaches — poll instead of a one-shot computed-style read.
  await expect
    .poll(() =>
      page
        .locator(selector)
        .first()
        .evaluate((el) =>
          getComputedStyle(el).getPropertyValue('view-transition-name').trim()
        )
    )
    .toBe(name);
}

test.describe('view transitions — named moves', () => {
  test('grid and category hero carry names', async ({ page }) => {
    await gotoStorefront(page);
    await openCategory(page, E2E_VENDOR.categories.burgers);

    await expectVtName(page, '.category-header .category-image', 'category-hero');
    // Grid container name differs by layout but must be present.
    const grid = page.locator('[appviewtransitionname="product-grid"]').first();
    await expect(grid).toBeAttached();
  });

  test('product hero and cart badge carry names through the add flow', async ({
    page,
  }) => {
    await gotoStorefront(page);
    await openCategory(page, E2E_VENDOR.categories.burgers);
    await openProduct(page, E2E_VENDOR.products.simple.name);
    await expectVtName(
      page,
      '.product-image-container .product-image',
      'product-hero'
    );

    await page.locator('.add-to-cart-button').click();
    // A convert offer defers the add (SPEC-UPSELL) — decline it so the
    // product lands in the cart before asserting the badge.
    await dismissUpsellIfOffered(page);
    // The badge is guaranteed visible once an item is in the cart.
    const badge = page.locator('app-cart-badge .cart-badge');
    await badge.waitFor({ state: 'visible' });
    await expectVtName(page, 'app-cart-badge .cart-badge', 'cart-badge');
  });
});

test.describe('view transitions — reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('full order journey completes with reduced motion', async ({ page }) => {
    await gotoStorefront(page);
    await openCategory(page, E2E_VENDOR.categories.burgers);
    await addSimpleProductToCart(page);
    await openCartSheet(page);
    await checkoutPayAtCounter(page);
  });
});
