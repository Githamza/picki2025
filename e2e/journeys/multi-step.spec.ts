import { test, expect, type Page, type Locator } from '@playwright/test';
import { E2E_VENDOR } from '../fixtures/vendor';
import { gotoStorefront, openCategory } from '../fixtures/helpers';

/**
 * FR4d journeys (plan T24) against the seeded "Menu Burger":
 * required single-select (auto-advance), constrained multi-select
 * (min 1 / max 2, countdown), optional step, collapse-to-choice,
 * selection preserved on modify, disabled-CTA navigation, cart recap.
 */

function section(page: Page, name: string): Locator {
  return page.locator('app-step-section', { hasText: name });
}

function header(page: Page, name: string): Locator {
  return section(page, name).locator('.step-header');
}

async function openMenuProduct(page: Page): Promise<void> {
  await gotoStorefront(page);
  await openCategory(page, E2E_VENDOR.categories.burgers);
  await page.getByText(E2E_VENDOR.products.multiStep.name).first().click();
  await expect(page).toHaveURL(/\/product\//);
  await expect(section(page, 'Burger').first()).toBeVisible();
}

test.describe('multi-step product — scroll shell', () => {
  test('single-select auto-advances and collapses to the choice', async ({
    page,
  }) => {
    await openMenuProduct(page);

    // Step 1 active, steps named exactly once each.
    await expect(header(page, 'Burger').first()).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    await section(page, 'Burger').getByText('Classique', { exact: true }).click();

    // Auto-advance: Accompagnements becomes the active section...
    await expect(header(page, 'Accompagnements')).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    // ...and the Burger section collapsed to its choice with a modify affordance.
    const burgerHeader = header(page, 'Burger').first();
    await expect(burgerHeader).toHaveAttribute('aria-expanded', 'false');
    await expect(burgerHeader).toContainText('Classique');
    await expect(burgerHeader).toContainText('modifier');
  });

  test('multi-select enforces min/max with a countdown and price follows', async ({
    page,
  }) => {
    await openMenuProduct(page);
    await section(page, 'Burger').getByText('Classique', { exact: true }).click();

    const accompaniments = section(page, 'Accompagnements');
    await accompaniments.getByText('Frites', { exact: true }).click();
    // min satisfied (1), one more possible (max 2).
    await expect(accompaniments.locator('.selection-hint')).toContainText(
      'Encore 1 choix possible'
    );

    await accompaniments.getByText('Onion rings', { exact: true }).click();
    // Max reached → auto-advance to the optional Dessert step.
    await expect(header(page, 'Dessert')).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    // Price delta (+0,50 on onion rings) lands in the bar total: 12,50.
    await expect(page.locator('.add-to-cart-button')).toContainText('12,50');
  });

  test('modify reopens a step with the selection preserved', async ({
    page,
  }) => {
    await openMenuProduct(page);
    await section(page, 'Burger').getByText('Classique', { exact: true }).click();
    await expect(header(page, 'Accompagnements')).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    await header(page, 'Burger').first().click();
    await expect(header(page, 'Burger').first()).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    // Selection preserved on the reopened step.
    await expect(
      section(page, 'Burger')
        .locator('app-product-option-card', { hasText: 'Classique' })
        .locator('.option-card')
    ).toHaveClass(/selected/);
  });

  test('disabled add-to-cart navigates to the first incomplete step', async ({
    page,
  }) => {
    await openMenuProduct(page);
    await section(page, 'Burger').getByText('Classique', { exact: true }).click();
    await expect(header(page, 'Accompagnements')).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    // Wander off to the optional step, leaving Accompagnements incomplete.
    await header(page, 'Dessert').click();
    await expect(header(page, 'Dessert')).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    await page.locator('.add-to-cart-button').click();
    // No navigation; the blocking step is re-activated instead.
    await expect(page).toHaveURL(/\/product\//);
    await expect(header(page, 'Accompagnements')).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  test('quantity x2 adds two to the basket', async ({ page }) => {
    await openMenuProduct(page);
    await section(page, 'Burger').getByText('Classique', { exact: true }).click();
    const accompaniments = section(page, 'Accompagnements');
    await accompaniments.getByText('Frites', { exact: true }).click();
    await accompaniments.getByText('Salade', { exact: true }).click();
    await section(page, 'Dessert').getByText('Cookie', { exact: true }).click();

    // Bump quantity to 2 in the bar, then add.
    await page.locator('.quantity-button', { has: page.locator('mat-icon', { hasText: 'add' }) }).click();
    await expect(page.locator('.add-to-cart-button')).toContainText('27,00');
    await page.locator('.add-to-cart-button').click();

    // The badge counts 2 items.
    await expect(page).toHaveURL(/\/products/);
    await expect(page.locator('app-cart-badge')).toContainText('(2)');
  });

  test('completes, and the cart recaps the steps', async ({ page }) => {
    await openMenuProduct(page);
    await section(page, 'Burger').getByText('Classique', { exact: true }).click();
    const accompaniments = section(page, 'Accompagnements');
    await accompaniments.getByText('Frites', { exact: true }).click();
    await accompaniments.getByText('Salade', { exact: true }).click();

    // Choosing on the LAST step collapses it and reveals the comment area.
    await section(page, 'Dessert').getByText('Cookie', { exact: true }).click();
    await expect(header(page, 'Dessert')).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    await expect(page.locator('.comment-section')).toBeVisible();

    const addButton = page.locator('.add-to-cart-button');
    await expect(addButton).not.toHaveClass(/visually-disabled/);
    await addButton.click();

    // Back on the grid; the cart badge recaps via cart-item-steps-tree.
    await expect(page).toHaveURL(/\/products/);
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
