import { test, expect, type Page, type Locator } from '@playwright/test';
import { E2E_VENDOR } from '../fixtures/vendor';
import {
  gotoStorefront,
  openCategory,
  openProduct,
  dismissUpsellIfOffered,
} from '../fixtures/helpers';

/**
 * FR4d journeys — focus shell (user decision 2026-08-09): every step is
 * its own page with a centered title; after the last step a review page
 * lists the collapsed choices for editing. Auto-advance never re-opens
 * already-chosen steps.
 */

function section(page: Page, name: string): Locator {
  return page.locator('app-step-section', { hasText: name });
}

function reviewHeader(page: Page, name: string): Locator {
  return section(page, name).locator('.step-header');
}

async function expectFocusPage(page: Page, title: string, progress: string) {
  await expect(page.locator('.focus-title')).toHaveText(title);
  await expect(page.getByText(progress)).toBeVisible();
  // One step only — nothing from other steps on screen.
  expect(await page.locator('app-step-section').count()).toBe(1);
}

async function openMenuProduct(page: Page): Promise<void> {
  await gotoStorefront(page);
  await openCategory(page, E2E_VENDOR.categories.burgers);
  await openProduct(page, E2E_VENDOR.products.multiStep.name);
  await expectFocusPage(page, 'Burger', 'Étape 1 sur 3');
}

/** Complete all three steps, landing on the review page. */
async function completeAllSteps(page: Page): Promise<void> {
  await page.getByText('Classique', { exact: true }).click();
  await expectFocusPage(page, 'Accompagnements', 'Étape 2 sur 3');
  await page.getByText('Frites', { exact: true }).click();
  await page.getByText('Salade', { exact: true }).click();
  await expectFocusPage(page, 'Dessert', 'Étape 3 sur 3');
  await page.getByText('Cookie', { exact: true }).click();
  // Review page: product title, all steps collapsed.
  await expect(page.locator('.focus-title')).toHaveText(
    E2E_VENDOR.products.multiStep.name
  );
}

test.describe('multi-step product — focus shell', () => {
  test('one step per page; single-select auto-advances', async ({ page }) => {
    await openMenuProduct(page);
    await page.getByText('Classique', { exact: true }).click();
    await expectFocusPage(page, 'Accompagnements', 'Étape 2 sur 3');
  });

  test('multi-select: countdown, Continuer under max, auto-advance at max', async ({
    page,
  }) => {
    await openMenuProduct(page);
    await page.getByText('Classique', { exact: true }).click();

    await page.getByText('Frites', { exact: true }).click();
    // min satisfied (1 of max 2): countdown + explicit Continuer.
    await expect(page.locator('.selection-hint')).toContainText(
      'Encore 1 choix possible'
    );
    await expect(
      page.getByRole('button', { name: 'Continuer' })
    ).toBeVisible();

    await page.getByText('Onion rings', { exact: true }).click();
    // Max reached → auto-advance to the optional Dessert page.
    await expectFocusPage(page, 'Dessert', 'Étape 3 sur 3');

    // Price delta (+0,50) lands in the bar total: 12,50.
    await expect(page.locator('.add-to-cart-button')).toContainText('12,50');
  });

  test('Retour returns one page with the selection preserved', async ({
    page,
  }) => {
    await openMenuProduct(page);
    await page.getByText('Classique', { exact: true }).click();
    await expectFocusPage(page, 'Accompagnements', 'Étape 2 sur 3');

    await page.getByRole('button', { name: /retour/i }).click();
    await expectFocusPage(page, 'Burger', 'Étape 1 sur 3');
    await expect(
      page
        .locator('app-product-option-card', { hasText: 'Classique' })
        .locator('.option-card')
    ).toHaveClass(/selected/);
  });

  test('review page: edit a step without re-walking the flow', async ({
    page,
  }) => {
    await openMenuProduct(page);
    await completeAllSteps(page);
    await page.waitForTimeout(500);

    // The review page shows every collapsed choice with a modify affordance.
    await expect(reviewHeader(page, 'Burger')).toContainText('Classique');
    await expect(reviewHeader(page, 'Burger')).toContainText('modifier');
    await expect(page.locator('.comment-section')).toBeVisible();

    // Edit Burger → its focus page, selection preserved.
    await reviewHeader(page, 'Burger').click();
    await expectFocusPage(page, 'Burger', 'Étape 1 sur 3');

    // Change the choice → straight back to the review page (no re-walk).
    await page.getByText('Double steak', { exact: true }).click();
    await page.waitForTimeout(800);
    await expect(page.locator('.focus-title')).toHaveText(
      E2E_VENDOR.products.multiStep.name
    );
    await expect(reviewHeader(page, 'Burger')).toContainText('Double steak');
    await expect(page.locator('.add-to-cart-button')).not.toHaveClass(
      /visually-disabled/
    );
  });

  test('disabled add-to-cart keeps the customer on the blocking step', async ({
    page,
  }) => {
    await openMenuProduct(page);
    await page.getByText('Classique', { exact: true }).click();
    await expectFocusPage(page, 'Accompagnements', 'Étape 2 sur 3');

    // Nothing selected on a required step: the bar tap must not navigate
    // away — the blocking step stays (or becomes) the focus page.
    await page.locator('.add-to-cart-button').click();
    await expect(page).toHaveURL(/\/product\//);
    await expectFocusPage(page, 'Accompagnements', 'Étape 2 sur 3');
  });

  test('quantity x2 adds two to the basket', async ({ page }) => {
    await openMenuProduct(page);
    await completeAllSteps(page);

    await page
      .locator('.quantity-button', {
        has: page.locator('mat-icon', { hasText: 'add' }),
      })
      .click();
    await expect(page.locator('.add-to-cart-button')).toContainText('27,00');
    await page.locator('.add-to-cart-button').click();

    // The menu has no drink → SPEC-UPSELL pool tier may detour; decline it.
    await dismissUpsellIfOffered(page);
    await expect(page).toHaveURL(/\/categories/);
    await expect(page.locator('app-cart-badge')).toContainText('(2)');
  });

  test('completes, and the cart recaps the steps', async ({ page }) => {
    await openMenuProduct(page);
    await completeAllSteps(page);
    await expect(page.locator('.comment-section')).toBeVisible();

    const addButton = page.locator('.add-to-cart-button');
    await expect(addButton).not.toHaveClass(/visually-disabled/);
    await addButton.click();

    // The menu has no drink → SPEC-UPSELL pool tier may detour; decline it.
    await dismissUpsellIfOffered(page);
    await expect(page).toHaveURL(/\/categories/);
    await page.locator('app-cart-badge button').click();
    const sheet = page.getByRole('dialog');
    const itemTitle = sheet.getByText(E2E_VENDOR.products.multiStep.name).first();
    await expect(itemTitle).toBeVisible();
    // The steps recap sits in a collapsed expansion panel — open it.
    await itemTitle.click();
    await expect(sheet.getByText('Classique').first()).toBeVisible();
    await expect(sheet.getByText('Frites').first()).toBeVisible();
    await expect(sheet.getByText('Cookie').first()).toBeVisible();
  });
});
