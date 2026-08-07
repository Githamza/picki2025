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

  test('persistent cart panel on landscape; floating badge on portrait', async ({
    page,
  }, testInfo) => {
    await gotoStorefront(page);
    const landscape = LANDSCAPE_PROJECTS.includes(testInfo.project.name);

    // FR6/FR7: landscape gets the always-visible cart panel.
    expect(await page.locator('app-cart-panel').isVisible()).toBe(landscape);
    // The floating badge never coexists with the panel (its portrait
    // appearance-with-items is covered by the transitions journey).
    if (landscape) {
      expect(await page.locator('app-cart-badge').count()).toBe(0);
    }
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
