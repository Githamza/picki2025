import { test, expect } from '@playwright/test';
import { E2E_VENDOR } from '../fixtures/vendor';
import { gotoStorefront, openCategory } from '../fixtures/helpers';

/**
 * FR2 shell behavior (plan T15):
 * - category rail: persistent on tablet-landscape/kiosk, absent otherwise
 * - horizontal category scroller: phone + tablet-portrait product grid
 */
const LANDSCAPE_PROJECTS = ['tablet-landscape', 'kiosk-landscape'];

test.describe('shell — category navigation per form factor', () => {
  test('sidenav rail only on landscape form factors', async ({
    page,
  }, testInfo) => {
    await gotoStorefront(page);
    const railVisible = await page
      .locator('mat-sidenav app-category-menu')
      .isVisible();
    expect(railVisible).toBe(LANDSCAPE_PROJECTS.includes(testInfo.project.name));
  });

  test('no persistent cart panel on any form factor', async ({ page }) => {
    // User decision 2026-08-08: the cart opens via the floating badge and
    // bottom sheet everywhere, kiosk included.
    await gotoStorefront(page);
    await expect(page.locator('app-cart-panel')).toHaveCount(0);
  });

  test('light theme rests on white, untinted surfaces', async ({ page }) => {
    // User decision 2026-08-09: neutral near-white surfaces; the rose
    // tint stays only on accents (primary buttons, prices, borders).
    await gotoStorefront(page);
    const colors = await page.evaluate(() => ({
      body: getComputedStyle(document.body).backgroundColor,
      card: getComputedStyle(
        document.querySelector('.category-card') as Element
      ).backgroundColor,
    }));
    expect(colors.body).toBe('rgb(255, 255, 255)');
    expect(colors.card).toBe('rgb(255, 255, 255)');
  });

  test('product cards carry no + button; the card itself is the control', async ({
    page,
  }) => {
    // User decision 2026-08-08: the add FAB duplicated the card tap and
    // took space. The card is the (keyboard-accessible) button.
    await gotoStorefront(page);
    await openCategory(page, E2E_VENDOR.categories.burgers);
    await expect(page.locator('.add-to-order-fab')).toHaveCount(0);
    await expect(page.locator('.product-action .add-button')).toHaveCount(0);
    const firstCard = page
      .locator('[role="button"][aria-label*="Burger Classique"]')
      .first();
    await expect(firstCard).toBeVisible();
  });

  test('add-to-cart bar keeps quantity and button on one row (phone)', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'phone-portrait',
      'phone-specific height concern'
    );
    await gotoStorefront(page);
    await openCategory(page, E2E_VENDOR.categories.burgers);
    await page.getByText(E2E_VENDOR.products.simple.name).first().click();

    const qty = await page.locator('.quantity-controls').boundingBox();
    const btn = await page.locator('.add-to-cart-button').boundingBox();
    expect(qty && btn).toBeTruthy();
    // Same row: vertical centers within half a control's height.
    const qtyCenter = qty!.y + qty!.height / 2;
    const btnCenter = btn!.y + btn!.height / 2;
    expect(Math.abs(qtyCenter - btnCenter)).toBeLessThan(24);
  });

  test('horizontal scroller on portrait form factors in product grid', async ({
    page,
  }, testInfo) => {
    await gotoStorefront(page);
    await openCategory(page, E2E_VENDOR.categories.burgers);
    const scroller = page.locator('app-horizontal-category-menu');
    const scrollerVisible = await scroller.isVisible();
    expect(scrollerVisible).toBe(
      !LANDSCAPE_PROJECTS.includes(testInfo.project.name)
    );

    if (scrollerVisible) {
      // Chips must stay on one scrollable line, never stack (review fix).
      const flexWrap = await scroller
        .locator('.mdc-evolution-chip-set__chips')
        .evaluate((el) => getComputedStyle(el).flexWrap);
      expect(flexWrap).toBe('nowrap');
    }
  });
});
