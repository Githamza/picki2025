import { test, expect } from '@playwright/test';

/**
 * Kiosk mode (SPEC.md FR4, plan T30+): activation matrix and chrome.
 * Seeded vendor e2e-kiosk has kiosk_enabled = true AND online payments on.
 */
const KIOSK_PATH = '/vendor/e2e-kiosk';
const LANDSCAPE = ['tablet-landscape', 'kiosk-landscape'];

test.describe('kiosk mode — activation and chrome', () => {
  test('kiosk-enabled vendor on landscape gets kiosk chrome', async ({
    page,
  }, testInfo) => {
    await page.goto(KIOSK_PATH);
    await expect(page).toHaveURL(/promotional-banner/);
    await expect(
      page.getByRole('heading', { name: 'Menus' })
    ).toBeVisible();

    const landscape = LANDSCAPE.includes(testInfo.project.name);
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

    await page.goto(KIOSK_PATH);
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
});
