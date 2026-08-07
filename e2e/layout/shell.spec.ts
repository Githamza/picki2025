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

  test('horizontal scroller on portrait form factors in product grid', async ({
    page,
  }, testInfo) => {
    await gotoStorefront(page);
    await openCategory(page, E2E_VENDOR.categories.burgers);
    const scrollerVisible = await page
      .locator('app-horizontal-category-menu')
      .isVisible();
    expect(scrollerVisible).toBe(
      !LANDSCAPE_PROJECTS.includes(testInfo.project.name)
    );
  });
});
