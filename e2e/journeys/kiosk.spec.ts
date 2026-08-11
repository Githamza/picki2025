import { test, expect } from '@playwright/test';
import { E2E_VENDOR } from '../fixtures/vendor';
import {
  blockPaymentProviders,
  checkoutPayAtCounter,
  openCartSheet,
  openProduct,
} from '../fixtures/helpers';

/**
 * Kiosk mode (SPEC.md FR4, plan T30+): activation matrix and chrome.
 * Seeded vendor e2e-kiosk has kiosk_enabled = true AND online payments on.
 *
 * Activation = vendor flag AND the Capacitor wrapper (the tablet APK).
 * E2e runs in a browser, so it simulates the wrapper via the
 * `__KIOSK_DEVICE__` hook. Orientation no longer matters; the session
 * journeys run on two projects only to bound suite runtime.
 */
const KIOSK_PATH = '/vendor/e2e-kiosk';
const KIOSK_PROJECTS = ['tablet-landscape', 'kiosk-landscape'];

/** Simulate the Capacitor wrapper — must run before app scripts load. */
async function simulateKioskDevice(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    (window as any).__KIOSK_DEVICE__ = true;
  });
}

/** Enter the kiosk storefront, tapping through the attract screen.
 *  The attract appears only after the vendor loads — wait for it. */
async function enterKiosk(page: import('@playwright/test').Page) {
  await simulateKioskDevice(page);
  await page.goto(KIOSK_PATH);
  const attract = page.locator('app-attract-screen');
  await attract.waitFor({ state: 'visible', timeout: 10_000 });
  await attract.click();
  await expect(attract).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Menus' })).toBeVisible();
}

test.describe('kiosk mode — activation and chrome', () => {
  test('kiosk-enabled vendor on a kiosk device gets kiosk chrome on any viewport', async ({
    page,
  }) => {
    await simulateKioskDevice(page);
    await page.goto(KIOSK_PATH);
    await expect(page).toHaveURL(/promotional-banner/);

    // FR4: the attract screen greets on load — every viewport, the
    // wrapper decides, not the orientation.
    await page
      .locator('app-attract-screen')
      .waitFor({ state: 'visible', timeout: 10_000 });
    await expect(page.getByText('Touchez pour commander')).toBeVisible();
    await page.locator('app-attract-screen').click();
    await expect(page.locator('app-attract-screen')).toBeHidden();

    // Activation is what's under test — the storefront grid itself is
    // laid out for tablet-and-up viewports, so don't assert it here.
    const kioskClass = await page.evaluate(() =>
      document.documentElement.classList.contains('kiosk-mode')
    );
    expect(kioskClass).toBe(true);

    // Cancel affordance only in kiosk mode; theme toggle never in kiosk mode.
    await expect(
      page.getByRole('button', { name: /annuler la commande/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /basculer le thème/i })
    ).toHaveCount(0);
  });

  test('browser (no wrapper) never gets kiosk chrome, even kiosk-enabled', async ({
    page,
  }) => {
    await page.goto(KIOSK_PATH);
    await expect(page).toHaveURL(/promotional-banner/);
    await expect(
      page.getByRole('heading', { name: 'Menus' })
    ).toBeVisible();
    await expect(page.locator('app-attract-screen')).toHaveCount(0);
    const kioskClass = await page.evaluate(() =>
      document.documentElement.classList.contains('kiosk-mode')
    );
    expect(kioskClass).toBe(false);
    await expect(
      page.getByRole('button', { name: /annuler la commande/i })
    ).toHaveCount(0);
  });

  test('non-kiosk vendor never gets kiosk chrome', async ({ page }) => {
    // Even on a kiosk device: the vendor flag still gates activation.
    await simulateKioskDevice(page);
    await page.goto('/vendor/e2e-cafe');
    await expect(page).toHaveURL(/promotional-banner/);
    const kioskClass = await page.evaluate(() =>
      document.documentElement.classList.contains('kiosk-mode')
    );
    expect(kioskClass).toBe(false);
    await expect(
      page.getByRole('button', { name: /annuler la commande/i })
    ).toHaveCount(0);
  });

  test('cancel order confirms, clears the cart, and stays in the shop', async ({
    page,
  }, testInfo) => {
    test.skip(
      !KIOSK_PROJECTS.includes(testInfo.project.name),
      'kiosk journeys sampled on two projects to bound runtime'
    );

    await enterKiosk(page);
    await page.getByRole('heading', { name: 'Menus' }).click();
    await openProduct(page, 'Wrap Poulet');
    await page.locator('.add-to-cart-button').click();

    // Item in the cart -> badge appears.
    await expect(page.locator('app-cart-badge')).toContainText('(1)');

    await page.getByRole('button', { name: /annuler la commande/i }).click();
    await page.getByRole('button', { name: /tout annuler/i }).click();

    // Cart cleared -> the badge (item-gated) disappears.
    await expect(page.locator('app-cart-badge .cart-badge')).toHaveCount(0);
    await expect(page).toHaveURL(/promotional-banner/);
  });

  test('idle with a full cart warns, then resets to the attract screen', async ({
    page,
  }, testInfo) => {
    test.skip(
      !KIOSK_PROJECTS.includes(testInfo.project.name),
      'kiosk journeys sampled on two projects to bound runtime'
    );

    // Shorten the SPEC timings (60s -> 2s idle, 20s -> 2s countdown).
    await page.addInitScript(() => {
      (window as any).__KIOSK_IDLE_MS__ = 4000;
      (window as any).__KIOSK_COUNTDOWN_MS__ = 2000;
    });

    await enterKiosk(page);
    await page.getByRole('heading', { name: 'Menus' }).click();
    await openProduct(page, 'Wrap Poulet');
    await page.locator('.add-to-cart-button').click();
    await expect(page.locator('app-cart-badge')).toContainText('(1)');

    // Idle: the countdown dialog appears, expires, session resets.
    await expect(page.getByText('Toujours là ?')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('app-attract-screen')).toBeVisible({
      timeout: 20_000,
    });

    // Next customer starts fresh (empty cart -> no badge).
    await page.locator('app-attract-screen').click();
    await expect(page.locator('app-cart-badge .cart-badge')).toHaveCount(0);
  });

  test('idle with an empty cart returns to attract silently', async ({
    page,
  }, testInfo) => {
    test.skip(
      !KIOSK_PROJECTS.includes(testInfo.project.name),
      'kiosk journeys sampled on two projects to bound runtime'
    );

    await page.addInitScript(() => {
      (window as any).__KIOSK_IDLE_MS__ = 1500;
    });

    await enterKiosk(page);
    await expect(page.locator('app-attract-screen')).toBeVisible({
      timeout: 8_000,
    });
    // No countdown dialog for an empty cart.
    await expect(page.getByText('Toujours là ?')).toHaveCount(0);
  });
});

test.describe('kiosk checkout — forced pay at counter (FR4a)', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      !KIOSK_PROJECTS.includes(testInfo.project.name),
      'kiosk journeys sampled on two projects to bound runtime'
    );
  });

  test('kiosk order never reaches a payment provider and shows the number screen', async ({
    page,
  }) => {
    // Shorten the confirmation auto-return (12s -> 4s).
    await page.addInitScript(() => {
      (window as any).__KIOSK_CONFIRM_MS__ = 4000;
    });
    const leaked = await blockPaymentProviders(page);

    await enterKiosk(page);
    await page.getByRole('heading', { name: 'Menus' }).click();
    await openProduct(page, 'Wrap Poulet');
    await page.locator('.add-to-cart-button').click();
    await expect(page.locator('app-cart-badge')).toContainText('(1)');
    await openCartSheet(page);

    // The vendor has online payments ENABLED — kiosk must still go to
    // the counter branch and land on successPayment.
    await checkoutPayAtCounter(page);

    // Full-screen order-number confirmation (order fetch can be slow
    // under parallel load).
    await expect(page.locator('.kiosk-confirmation')).toBeVisible({
      timeout: 15_000,
    });
    // Customer-facing short number (3 digits) + full reference in small
    // print (FR4: the customer reads 3 digits out at the counter).
    await expect(page.locator('.kiosk-order-number')).toHaveText(/^\d{3}$/);
    await expect(page.locator('.kiosk-order-number-full')).toHaveText(
      /\d{6}-\d{6}/
    );
    await expect(page.getByText('Payez au comptoir', { exact: false })).toBeVisible();

    expect(leaked, 'kiosk order must not call payment providers').toEqual([]);

    // Auto-return: attract screen greets the next customer, cart empty.
    await expect(page.locator('app-attract-screen')).toBeVisible({
      timeout: 10_000,
    });
    await page.locator('app-attract-screen').click();
    await expect(page.locator('app-cart-badge .cart-badge')).toHaveCount(0);
  });
});

test.describe('kiosk combo builder — one step per screen (FR4b)', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      !KIOSK_PROJECTS.includes(testInfo.project.name),
      'kiosk journeys sampled on two projects to bound runtime'
    );
  });

  test('menu walks step-by-step with progress, recap, and Passer', async ({
    page,
  }) => {
    await enterKiosk(page);
    await page.getByRole('heading', { name: 'Menus' }).click();
    await openProduct(page, 'Menu Kiosk');

    // One step per screen with progress.
    await expect(page.getByText('Étape 1 sur 3')).toBeVisible();
    expect(await page.locator('app-step-section').count()).toBe(1);

    // Choose the plat -> auto-advance to the next focus page.
    await page.getByText('Wrap', { exact: true }).click();
    await expect(page.getByText('Étape 2 sur 3')).toBeVisible();

    // Choose the boisson -> step 3 (optional) offers Passer.
    await page.getByText('Soda', { exact: true }).click();
    await expect(page.getByText('Étape 3 sur 3')).toBeVisible();
    await page.getByRole('button', { name: /passer cette étape/i }).click();

    // Complete: bar enabled with the priced total (11 + 0,50 soda).
    const addButton = page.locator('.add-to-cart-button');
    await expect(addButton).not.toHaveClass(/visually-disabled/);
    await expect(addButton).toContainText('11,50');
    await addButton.click();
    await expect(page.locator('app-cart-badge')).toContainText('(1)');
  });

  test('Retour preserves the previous selection', async ({ page }) => {
    await enterKiosk(page);
    await page.getByRole('heading', { name: 'Menus' }).click();
    await openProduct(page, 'Menu Kiosk');

    await page.getByText('Wrap', { exact: true }).click();
    await expect(page.getByText('Étape 2 sur 3')).toBeVisible();

    await page.getByRole('button', { name: /retour/i }).click();
    await expect(page.getByText('Étape 1 sur 3')).toBeVisible();
    await expect(
      page
        .locator('app-product-option-card', { hasText: 'Wrap' })
        .first()
        .locator('.option-card')
    ).toHaveClass(/selected/);
  });
});
