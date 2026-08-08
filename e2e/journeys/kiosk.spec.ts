import { test, expect } from '@playwright/test';
import { E2E_VENDOR } from '../fixtures/vendor';
import { blockPaymentProviders, checkoutPayAtCounter } from '../fixtures/helpers';

/**
 * Kiosk mode (SPEC.md FR4, plan T30+): activation matrix and chrome.
 * Seeded vendor e2e-kiosk has kiosk_enabled = true AND online payments on.
 */
const KIOSK_PATH = '/vendor/e2e-kiosk';
const LANDSCAPE = ['tablet-landscape', 'kiosk-landscape'];

/** Enter the kiosk storefront, tapping through the attract screen.
 *  The attract appears only after the vendor loads — wait for it. */
async function enterKiosk(page: import('@playwright/test').Page) {
  await page.goto(KIOSK_PATH);
  const attract = page.locator('app-attract-screen');
  await attract.waitFor({ state: 'visible', timeout: 10_000 });
  await attract.click();
  await expect(attract).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Menus' })).toBeVisible();
}

test.describe('kiosk mode — activation and chrome', () => {
  test('kiosk-enabled vendor on landscape gets kiosk chrome', async ({
    page,
  }, testInfo) => {
    await page.goto(KIOSK_PATH);
    await expect(page).toHaveURL(/promotional-banner/);
    const landscape = LANDSCAPE.includes(testInfo.project.name);

    // FR4: the attract screen greets on load in kiosk mode only.
    if (landscape) {
      await page
        .locator('app-attract-screen')
        .waitFor({ state: 'visible', timeout: 10_000 });
      await expect(
        page.getByText('Touchez pour commander')
      ).toBeVisible();
      await page.locator('app-attract-screen').click();
    } else {
      // Portrait: the attract screen must never appear.
      await expect(
        page.getByRole('heading', { name: 'Menus' })
      ).toBeVisible();
      await expect(page.locator('app-attract-screen')).toHaveCount(0);
    }
    await expect(
      page.getByRole('heading', { name: 'Menus' })
    ).toBeVisible();
    const kioskClass = await page.evaluate(() =>
      document.documentElement.classList.contains('kiosk-mode')
    );
    expect(kioskClass).toBe(landscape);

    // Cancel affordance only in kiosk mode; theme toggle never in kiosk mode.
    expect(
      await page.getByRole('button', { name: /annuler la commande/i }).isVisible()
    ).toBe(landscape);
    if (landscape) {
      await expect(
        page.getByRole('button', { name: /basculer le thème/i })
      ).toHaveCount(0);
    }
  });

  test('non-kiosk vendor never gets kiosk chrome', async ({ page }) => {
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
      !LANDSCAPE.includes(testInfo.project.name),
      'kiosk chrome is landscape-only'
    );

    await enterKiosk(page);
    await page.getByRole('heading', { name: 'Menus' }).click();
    await page.getByText('Wrap Poulet').first().click();
    await page.getByRole('button', { name: /ajouter/i }).click();

    // Item in the persistent panel
    await expect(page.locator('app-cart-panel')).toContainText('Wrap Poulet');

    await page.getByRole('button', { name: /annuler la commande/i }).click();
    await page.getByRole('button', { name: /tout annuler/i }).click();

    await expect(page.locator('app-cart-panel')).toContainText(
      'Votre panier est vide'
    );
    await expect(page).toHaveURL(/promotional-banner/);
  });

  test('idle with a full cart warns, then resets to the attract screen', async ({
    page,
  }, testInfo) => {
    test.skip(
      !LANDSCAPE.includes(testInfo.project.name),
      'kiosk chrome is landscape-only'
    );

    // Shorten the SPEC timings (60s -> 2s idle, 20s -> 2s countdown).
    await page.addInitScript(() => {
      (window as any).__KIOSK_IDLE_MS__ = 4000;
      (window as any).__KIOSK_COUNTDOWN_MS__ = 2000;
    });

    await enterKiosk(page);
    await page.getByRole('heading', { name: 'Menus' }).click();
    await page.getByText('Wrap Poulet').first().click();
    await page.getByRole('button', { name: /ajouter/i }).click();
    await expect(page.locator('app-cart-panel')).toContainText('Wrap Poulet');

    // Idle: the countdown dialog appears, expires, session resets.
    await expect(page.getByText('Toujours là ?')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('app-attract-screen')).toBeVisible({
      timeout: 10_000,
    });

    // Next customer starts fresh.
    await page.locator('app-attract-screen').click();
    await expect(page.locator('app-cart-panel')).toContainText(
      'Votre panier est vide'
    );
  });

  test('idle with an empty cart returns to attract silently', async ({
    page,
  }, testInfo) => {
    test.skip(
      !LANDSCAPE.includes(testInfo.project.name),
      'kiosk chrome is landscape-only'
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
      !LANDSCAPE.includes(testInfo.project.name),
      'kiosk mode is landscape-only'
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
    await page.getByText('Wrap Poulet').first().click();
    await page.getByRole('button', { name: /ajouter/i }).click();
    await expect(page.locator('app-cart-panel')).toContainText('Wrap Poulet');

    // The vendor has online payments ENABLED — kiosk must still go to
    // the counter branch and land on successPayment.
    await checkoutPayAtCounter(page);

    // Full-screen order-number confirmation.
    await expect(page.locator('.kiosk-confirmation')).toBeVisible();
    await expect(page.locator('.kiosk-order-number')).toHaveText(
      /\d{6}-\d{6}/
    );
    await expect(page.getByText('Payez au comptoir', { exact: false })).toBeVisible();

    expect(leaked, 'kiosk order must not call payment providers').toEqual([]);

    // Auto-return: attract screen greets the next customer, cart empty.
    await expect(page.locator('app-attract-screen')).toBeVisible({
      timeout: 10_000,
    });
    await page.locator('app-attract-screen').click();
    await expect(page.locator('app-cart-panel')).toContainText(
      'Votre panier est vide'
    );
  });
});
