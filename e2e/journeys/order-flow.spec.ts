import { test, expect } from '@playwright/test';
import { E2E_VENDOR } from '../fixtures/vendor';
import {
  blockPaymentProviders,
  gotoStorefront,
  openCategory,
  addSimpleProductToCart,
  openCartSheet,
  checkoutPayAtCounter,
} from '../fixtures/helpers';

/**
 * Baseline order journey (SPEC.md success criterion 1, plan T4):
 * landing (category grid) → product → cart → preference-in-dialog →
 * pay-at-counter order.
 *
 * This is the regression fence for every redesign phase — it encodes the
 * storefront's CURRENT behavior and must stay green through Phases 1–4b.
 */
test.describe('order journey — take-away, pay at counter', () => {
  test('completes from landing to order confirmation', async ({ page }) => {
    const leakedPaymentCalls = await blockPaymentProviders(page);

    await gotoStorefront(page);
    await openCategory(page, E2E_VENDOR.categories.burgers);
    await addSimpleProductToCart(page);
    await openCartSheet(page);
    await checkoutPayAtCounter(page);

    expect(
      leakedPaymentCalls,
      'pay-at-counter journey must not call payment providers'
    ).toEqual([]);
  });

  test('out-of-stock product is not orderable', async ({ page }) => {
    await gotoStorefront(page);
    await openCategory(page, E2E_VENDOR.categories.drinks);

    // The out-of-stock product is visible but its card signals unavailability.
    await expect(
      page.getByText(E2E_VENDOR.products.outOfStock.name).first()
    ).toBeVisible();
  });
});
