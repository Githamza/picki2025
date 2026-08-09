import { expect, type Page } from '@playwright/test';
import { E2E_VENDOR } from './vendor';

/**
 * Journey helpers shared by journey and layout specs.
 *
 * Note on the real flow (discovered against the running app):
 * diningPreferenceGuard always allows navigation — landing goes straight
 * to the category grid, and the dining preference is collected inside the
 * checkout dialog (needsPreferenceStep) unless the customer visited the
 * welcome screen first. Helpers follow that real flow.
 *
 * Selectors prefer user-visible text/roles; tighten as FR8 (a11y) lands.
 */

/** Block payment-provider origins; return a collector of leaked URLs. */
export async function blockPaymentProviders(page: Page): Promise<string[]> {
  const leaked: string[] = [];
  await page.route(/stripe\.com|paygreen\.fr/, (route) => {
    leaked.push(route.request().url());
    return route.abort();
  });
  return leaked;
}

/** Land on the storefront → redirected to the category grid. */
export async function gotoStorefront(page: Page): Promise<void> {
  await page.goto(E2E_VENDOR.storefrontPath);
  await expect(page).toHaveURL(/promotional-banner/);
  await expect(
    page.getByRole('heading', { name: E2E_VENDOR.categories.burgers })
  ).toBeVisible();
}

/** Open the welcome screen (dining preference) directly. */
export async function gotoWelcomeScreen(page: Page): Promise<void> {
  await page.goto(`${E2E_VENDOR.storefrontPath}/dining-preference`);
  // level: 1 — the seeded banner renders its title as a second (h3) heading
  // with the same text once the async banner fetch lands.
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: new RegExp(`Bienvenue chez ${E2E_VENDOR.businessName}`),
    })
  ).toBeVisible();
}

/** Category grid → a category's product grid. */
export async function openCategory(page: Page, category: string): Promise<void> {
  await page.getByRole('heading', { name: category }).click();
  await expect(page).toHaveURL(/\/products/);
}

/** Open a product from the grid. Clicks can be swallowed by an active
 *  view transition under load — retry click+URL as one unit. */
export async function openProduct(page: Page, name: string): Promise<void> {
  await expect(async () => {
    await page.getByText(name).first().click({ timeout: 2000 });
    await expect(page).toHaveURL(/\/product\//, { timeout: 2000 });
  }).toPass({ timeout: 15_000 });
}

/** Product grid → product page → add to cart. Since SPEC-UPSELL the add can
 *  detour through the /upsell page (convert or pool tier, at most once per
 *  tier per session) — decline it so journeys land back on the grid. */
export async function addSimpleProductToCart(page: Page): Promise<void> {
  await openProduct(page, E2E_VENDOR.products.simple.name);
  await page.locator('.add-to-cart-button').click();
  await dismissUpsellIfOffered(page);
}

/** Decline the post-add upsell page when it appears; no-op otherwise. */
export async function dismissUpsellIfOffered(page: Page): Promise<void> {
  await page.waitForURL(/\/(upsell|products)/, { timeout: 10_000 });
  if (page.url().includes('/upsell')) {
    await page.getByRole('button', { name: /non merci/i }).click();
    await expect(page).toHaveURL(/\/products/);
  }
}

/** Open the cart bottom sheet via the floating badge (every form factor —
 *  user decision 2026-08-08: no persistent panel). */
export async function openCartSheet(page: Page): Promise<void> {
  await page.locator('app-cart-badge button').click();
  await expect(
    page.getByRole('button', { name: /valider ma commande/i })
  ).toBeVisible();
}

/**
 * Checkout through the pay-at-counter branch.
 * The dialog first asks for the dining preference (take-away / asap),
 * then the customer details; both steps confirm with "Confirmer".
 */
export async function checkoutPayAtCounter(page: Page): Promise<void> {
  await page.getByRole('button', { name: /valider ma commande/i }).click();

  const dialog = page.getByRole('dialog');

  // Step 1 — dining preference (skipped if already chosen this session).
  // waitFor with timeout instead of isVisible(): the dialog renders async
  // and an instant visibility probe races it (surfaced by reduced-motion).
  const takeAway = dialog.getByRole('button', { name: /emporter/i });
  const hasPreferenceStep = await takeAway
    .waitFor({ state: 'visible', timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  if (hasPreferenceStep) {
    await takeAway.click();
    // asap ("Tout de suite") is selectable 24/7 with the seeded hours.
    const asap = dialog.getByText(/tout de suite/i);
    if (await asap.isVisible().catch(() => false)) {
      await asap.click();
    }
    await dialog.getByRole('button', { name: /confirmer/i }).click();
  }

  // Step 2 — customer details.
  await expect(
    dialog.getByRole('heading', { name: /informations de commande/i })
  ).toBeVisible();
  await dialog.getByLabel(/^nom/i).fill(E2E_VENDOR.customer.nom);
  await dialog.getByLabel(/prenom/i).fill(E2E_VENDOR.customer.prenom);
  await dialog.getByLabel(/email/i).fill(E2E_VENDOR.customer.email);
  await dialog.getByLabel(/telephone/i).fill(E2E_VENDOR.customer.phone);

  // Labels must not carry a literal asterisk — Material's required
  // marker provides it (the "Nom **" defect).
  const starredLabels = await dialog
    .locator('mat-label')
    .filter({ hasText: '*' })
    .count();
  expect(starredLabels, 'labels must not hard-code asterisks').toBe(0);

  // Pay-at-counter vendors (and kiosks) submit with honest copy — no
  // "paiement" button when no payment screen follows.
  await dialog.getByRole('button', { name: /valider la commande/i }).click();

  await expect(page).toHaveURL(/successPayment/, { timeout: 15_000 });
}

/** Assert the page shell has no horizontal overflow at the current viewport. */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(overflow, 'horizontal overflow (px)').toBeLessThanOrEqual(0);
}
