import { test, expect, type Page } from '@playwright/test';
import { E2E_VENDOR } from '../fixtures/vendor';
import {
  blockPaymentProviders,
  gotoStorefront,
  openCategory,
  openProduct,
  openCartSheet,
  checkoutPayAtCounter,
} from '../fixtures/helpers';

/**
 * Upsell journeys (SPEC-UPSELL.md, plan T11).
 *
 * E2E Cafe has typed categories (Boissons=boisson, Desserts=dessert) and a
 * product-linked option ('Burger maison' -> Burger Classique) inside Menu
 * Burger, so both tiers fire. The kiosk vendor keeps untyped categories and
 * component-only options — the zero-upsell-UI fence.
 */

async function openSimpleProduct(page: Page): Promise<void> {
  await gotoStorefront(page);
  await openCategory(page, E2E_VENDOR.categories.burgers);
  await openProduct(page, E2E_VENDOR.products.simple.name);
}

async function addAndExpectUpsell(page: Page, title: RegExp): Promise<void> {
  await page.locator('.add-to-cart-button').click();
  await expect(page).toHaveURL(/\/upsell/, { timeout: 10_000 });
  await expect(page.getByText(title)).toBeVisible();
}

test.describe('upsell — product page strip', () => {
  test('simple product pages show "Pour accompagner" with pool items', async ({
    page,
  }) => {
    await openSimpleProduct(page);
    await expect(page.getByText('Pour accompagner')).toBeVisible();
    await expect(
      page.getByText(E2E_VENDOR.products.drink.name).first()
    ).toBeVisible();
  });

  test('menu (multi-step) pages never show the strip', async ({ page }) => {
    await gotoStorefront(page);
    await openCategory(page, E2E_VENDOR.categories.burgers);
    await openProduct(page, E2E_VENDOR.products.multiStep.name);
    await expect(page.getByText('Pour accompagner')).toHaveCount(0);
  });
});

test.describe('upsell — post-add journeys', () => {
  test('convert offer → decline → pool offer → accept drink → silent third add → checkout', async ({
    page,
  }) => {
    const leakedPaymentCalls = await blockPaymentProviders(page);

    // 1st add: the burger lives inside Menu Burger → convert tier.
    await openSimpleProduct(page);
    await addAndExpectUpsell(page, /Et si vous en faisiez un menu/);
    await expect(
      page.getByText(E2E_VENDOR.products.multiStep.name)
    ).toBeVisible();
    await page.getByRole('button', { name: /non merci/i }).click();
    await expect(page).toHaveURL(/\/categories/);

    // 2nd add: convert tier consumed, no drink in the cart → pool tier.
    await openCategory(page, E2E_VENDOR.categories.burgers);
    await openProduct(page, E2E_VENDOR.products.simple.name);
    await addAndExpectUpsell(page, /Une petite soif/);
    await page
      .locator('.accessory-card', { hasText: E2E_VENDOR.products.drink.name })
      .getByRole('button')
      .click();
    // Adding a suggestion flips the CTA to "Continuer".
    await page.getByRole('button', { name: /continuer/i }).click();
    await expect(page).toHaveURL(/\/categories/);

    // 3rd add: both tiers consumed this session → straight to categories.
    await openCategory(page, E2E_VENDOR.categories.burgers);
    await openProduct(page, E2E_VENDOR.products.simple.name);
    await page.locator('.add-to-cart-button').click();
    await expect(page).toHaveURL(/\/categories/);

    // The suggested drink is a normal cart line; checkout completes.
    await openCartSheet(page);
    await expect(
      page.getByText(E2E_VENDOR.products.drink.name).first()
    ).toBeVisible();
    await checkoutPayAtCounter(page);

    expect(
      leakedPaymentCalls,
      'upsell journey must not call payment providers'
    ).toEqual([]);
  });

  test('accepting convert enters the menu flow with the burger preselected', async ({
    page,
  }) => {
    await openSimpleProduct(page);
    await addAndExpectUpsell(page, /Et si vous en faisiez un menu/);
    await page.getByRole('button', { name: /choisir le menu/i }).click();

    // Menu flow, step 1, with the product-linked option already selected.
    await expect(page).toHaveURL(/\/product\//);
    await expect(page.locator('.focus-title')).toHaveText('Burger');
    await expect(
      page
        .locator('app-product-option-card', {
          hasText: E2E_VENDOR.menuContainedOption,
        })
        .locator('.option-card')
    ).toHaveClass(/selected/, { timeout: 10_000 });
  });

  test('menu add without a drink triggers the pool tier (never convert)', async ({
    page,
  }) => {
    await gotoStorefront(page);
    await openCategory(page, E2E_VENDOR.categories.burgers);
    await openProduct(page, E2E_VENDOR.products.multiStep.name);

    // Walk the three steps (single → constrained multi at max → optional).
    await page.getByText('Classique', { exact: true }).click();
    await page.getByText('Frites', { exact: true }).click();
    await page.getByText('Onion rings', { exact: true }).click();
    await page.getByText('Cookie', { exact: true }).click();
    await page.locator('.add-to-cart-button').click();

    await expect(page).toHaveURL(/\/upsell/, { timeout: 10_000 });
    await expect(page.getByText(/Une petite soif/)).toBeVisible();
    await expect(page.getByText(/Et si vous en faisiez un menu/)).toHaveCount(0);
  });
});

test.describe('upsell — untyped vendor sees zero upsell UI', () => {
  const KIOSK_PATH = '/vendor/e2e-kiosk';

  test('no strip, no post-add detour', async ({ page }) => {
    // Plain browser: kiosk mode needs the Capacitor wrapper, so the
    // kiosk-enabled vendor renders the normal storefront (no attract).
    await page.goto(KIOSK_PATH);
    await expect(page.getByRole('heading', { name: 'Menus' })).toBeVisible();
    await page.getByRole('heading', { name: 'Menus' }).click();
    await openProduct(page, 'Wrap Poulet');

    await expect(page.getByText('Pour accompagner')).toHaveCount(0);
    await page.locator('.add-to-cart-button').click();
    await expect(page).toHaveURL(/\/categories/);
    await expect(page).not.toHaveURL(/\/upsell/);
  });
});
