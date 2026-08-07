import { test, expect, type Page } from '@playwright/test';
import { E2E_VENDOR } from '../fixtures/vendor';
import { gotoStorefront, openCategory } from '../fixtures/helpers';

/**
 * FR2 column counts (plan T16), driven by --columns from formFactor:
 *   category grid: phone 2 · tablet-portrait 3 · landscape/kiosk 4
 *   product grid:  phone = list · tablet-portrait 3 · landscape/kiosk 4
 */
const CATEGORY_COLUMNS: Record<string, number> = {
  'phone-portrait': 2,
  'tablet-portrait': 3,
  'tablet-landscape': 4,
  'kiosk-landscape': 4,
};
const PRODUCT_COLUMNS: Record<string, number> = {
  'tablet-portrait': 3,
  'tablet-landscape': 4,
  'kiosk-landscape': 4,
};

async function columnCount(page: Page, selector: string): Promise<number> {
  return page.locator(selector).first().evaluate((el) => {
    return getComputedStyle(el)
      .gridTemplateColumns.split(' ')
      .filter(Boolean).length;
  });
}

test('category grid column count matches form factor', async ({
  page,
}, testInfo) => {
  await gotoStorefront(page);
  expect(await columnCount(page, '.category-grid')).toBe(
    CATEGORY_COLUMNS[testInfo.project.name]
  );
});

test('product grid column count matches form factor', async ({
  page,
}, testInfo) => {
  await gotoStorefront(page);
  await openCategory(page, E2E_VENDOR.categories.burgers);

  if (testInfo.project.name === 'phone-portrait') {
    await expect(page.locator('.product-list.mobile-layout')).toBeVisible();
    return;
  }
  expect(await columnCount(page, '.product-grid.desktop-layout')).toBe(
    PRODUCT_COLUMNS[testInfo.project.name]
  );
});
