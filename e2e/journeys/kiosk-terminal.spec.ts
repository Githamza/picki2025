import { test, expect, type Page, type Route } from '@playwright/test';
import {
  blockPaymentProviders,
  checkoutPayAtCounter,
  openCartSheet,
  openProduct,
} from '../fixtures/helpers';
import { E2E_KIOSK_VENDOR_ID, E2E_TERMINAL } from '../fixtures/qonto';

/**
 * Qonto terminal on kiosk (SPEC-QONTO-TERMINAL.md T13).
 *
 * The vendor toggle is enabled per-page by rewriting the vendors REST
 * response — never by mutating the shared local db, which would race the
 * toggle-OFF kiosk journeys running in parallel workers. The qonto-terminal
 * edge function is stubbed at the network layer; the stub applies the same
 * db writes the real function performs (terminal_payment_id, initiated→todo,
 * cancelled) so the success screen and order assertions read real rows.
 *
 * Printing is native-only (Capacitor) and unreachable from the browser; the
 * print-after-authorization ordering is enforced by checkout.service (the
 * print line sits behind the authorized gate) and covered by unit specs.
 */

const KIOSK_PATH = '/vendor/e2e-kiosk';
const REST_URL = 'http://127.0.0.1:54321/rest/v1';
const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

async function patchOrder(orderId: string, patch: Record<string, unknown>) {
  const response = await fetch(`${REST_URL}/orders?id=eq.${orderId}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    throw new Error(`patchOrder failed: ${response.status}`);
  }
}

async function readOrder(orderId: string): Promise<any> {
  const response = await fetch(
    `${REST_URL}/orders?id=eq.${orderId}&select=status,terminal_payment_id`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  return (await response.json())[0];
}

/** Simulate the Capacitor wrapper — must run before app scripts load. */
async function simulateKioskDevice(page: Page) {
  await page.addInitScript(() => {
    (window as any).__KIOSK_DEVICE__ = true;
  });
}

/** Enable the terminal toggle for THIS page only (vendors response rewrite). */
async function enableTerminalForPage(page: Page) {
  await page.route(/\/rest\/v1\/vendors/, async (route) => {
    const response = await route.fetch();
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return route.fulfill({ response });
    }
    const patch = (row: any) => {
      if (row && row.id === E2E_KIOSK_VENDOR_ID) {
        row.kiosk_terminal_enabled = true;
        row.kiosk_terminal_id = E2E_TERMINAL.id;
        row.kiosk_terminal_label = E2E_TERMINAL.label;
      }
      return row;
    };
    const patched = Array.isArray(body) ? body.map(patch) : patch(body);
    await route.fulfill({ response, json: patched });
  });
}

interface TerminalStubState {
  createCalls: number;
  getCalls: number;
  cancelCalls: number;
  orderId: string | null;
}

/**
 * Stub the qonto-terminal edge function. `outcomes[i]` answers the i-th
 * get-payment poll (last entry repeats); AUTHORIZED/REFUSED also apply the
 * real function's db side effects.
 */
async function stubTerminal(
  page: Page,
  outcomes: Array<'PENDING' | 'AUTHORIZED' | 'REFUSED'>
): Promise<TerminalStubState> {
  const state: TerminalStubState = {
    createCalls: 0,
    getCalls: 0,
    cancelCalls: 0,
    orderId: null,
  };
  await page.route(/\/functions\/v1\/qonto-terminal/, async (route: Route) => {
    if (route.request().method() !== 'POST') {
      return route.fulfill({ status: 200, body: 'ok' });
    }
    const body = route.request().postDataJSON() as {
      action: string;
      orderId?: string;
    };
    if (body.action === 'create-payment') {
      state.createCalls += 1;
      state.orderId = body.orderId ?? null;
      const paymentId = `e2e-pay-${state.createCalls}`;
      await patchOrder(body.orderId!, { terminal_payment_id: paymentId });
      return route.fulfill({ json: { paymentId, amount: '0.00' } });
    }
    if (body.action === 'get-payment') {
      const outcome =
        outcomes[Math.min(state.getCalls, outcomes.length - 1)] ?? 'PENDING';
      state.getCalls += 1;
      if (outcome === 'AUTHORIZED') {
        await patchOrder(body.orderId!, {
          status: 'todo',
          pay_at_checkout: false,
          terminal_payment_method: 'cartebancaire',
          terminal_card_summary: '4242',
        });
      }
      return route.fulfill({
        json: {
          status: outcome,
          failureReason: outcome === 'REFUSED' ? 'card_declined' : null,
        },
      });
    }
    if (body.action === 'cancel-order') {
      state.cancelCalls += 1;
      await patchOrder(body.orderId!, { status: 'cancelled' });
      return route.fulfill({ json: { cancelled: true } });
    }
    return route.fulfill({ status: 400, body: '{}' });
  });
  return state;
}

async function enterKiosk(page: Page) {
  await page.goto(KIOSK_PATH);
  const attract = page.locator('app-attract-screen');
  await attract.waitFor({ state: 'visible', timeout: 10_000 });
  await attract.click();
  await expect(attract).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Menus' })).toBeVisible();
}

/** Cart → validate: stops right after the final submit so the terminal
 *  dialog can be observed mid-flight (checkoutPayAtCounter would await the
 *  success URL instead). Kiosk asks only for a phone on a keypad. */
async function submitKioskOrder(page: Page) {
  await page.getByRole('button', { name: /valider ma commande/i }).click();
  const dialog = page.getByRole('dialog');

  const takeAway = dialog.getByRole('button', { name: /emporter/i });
  const hasPreferenceStep = await takeAway
    .waitFor({ state: 'visible', timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  if (hasPreferenceStep) {
    await takeAway.click();
    const asap = dialog.getByText(/tout de suite/i);
    if (await asap.isVisible().catch(() => false)) {
      await asap.click();
    }
    await dialog.getByRole('button', { name: /confirmer/i }).click();
  }

  await dialog
    .getByRole('heading', { name: /votre numéro de téléphone/i })
    .waitFor({ state: 'visible', timeout: 4000 });
  for (const digit of '0612345678') {
    await dialog.getByRole('button', { name: digit, exact: true }).click();
  }
  await dialog.getByRole('button', { name: /valider la commande/i }).click();
}

async function addWrapAndOpenCart(page: Page) {
  await page.getByRole('heading', { name: 'Menus' }).click();
  await openProduct(page, 'Wrap Poulet');
  await page.locator('.add-to-cart-button').click();
  await expect(page.locator('app-cart-badge')).toContainText('(1)');
  await openCartSheet(page);
}

test.describe('kiosk × Qonto terminal', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'kiosk-landscape',
      'terminal journeys sampled on the kiosk project to bound runtime'
    );
    await simulateKioskDevice(page);
  });

  test('toggle OFF: checkout never calls qonto-terminal and keeps counter copy', async ({
    page,
  }) => {
    const leaked = await blockPaymentProviders(page);
    let qontoCalls = 0;
    await page.route(/\/functions\/v1\/qonto-terminal/, (route) => {
      qontoCalls += 1;
      return route.abort();
    });

    await enterKiosk(page);
    await addWrapAndOpenCart(page);
    await checkoutPayAtCounter(page);

    await expect(page.locator('.kiosk-confirmation')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Payez au comptoir', { exact: false })).toBeVisible();
    expect(qontoCalls, 'toggle OFF must never reach qonto-terminal').toBe(0);
    expect(leaked).toEqual([]);
  });

  test('authorized: waiting state, then paid confirmation', async ({ page }) => {
    const leaked = await blockPaymentProviders(page);
    await enableTerminalForPage(page);
    const stub = await stubTerminal(page, ['PENDING', 'PENDING', 'AUTHORIZED']);

    await enterKiosk(page);
    await addWrapAndOpenCart(page);
    await submitKioskOrder(page);

    // Full-screen waiting state while the (stubbed) terminal processes.
    await expect(
      page.getByText('Présentez votre carte sur le terminal')
    ).toBeVisible({ timeout: 10_000 });

    // Settles → order-number screen with the paid variant of the copy.
    await expect(page.locator('.kiosk-confirmation')).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.locator('.kiosk-confirmation-instruction')
    ).toContainText('Paiement accepté');

    expect(stub.createCalls).toBe(1);
    expect((await readOrder(stub.orderId!)).status).toBe('todo');
    expect(leaked).toEqual([]);
  });

  test('refused: error + Réessayer recovers to a paid order', async ({ page }) => {
    await enableTerminalForPage(page);
    // First attempt refuses on its first poll; the retry authorizes.
    const stub = await stubTerminal(page, ['REFUSED', 'AUTHORIZED']);

    await enterKiosk(page);
    await addWrapAndOpenCart(page);
    await submitKioskOrder(page);

    await expect(page.getByText('Paiement refusé')).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: /réessayer/i }).click();

    await expect(page.locator('.kiosk-confirmation')).toBeVisible({
      timeout: 15_000,
    });
    expect(stub.createCalls).toBe(2);
    expect((await readOrder(stub.orderId!)).status).toBe('todo');
  });

  test('timeout: error surface, Annuler cancels and keeps the cart', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as any).__KIOSK_TERMINAL_TIMEOUT_MS__ = 4000;
    });
    await enableTerminalForPage(page);
    const stub = await stubTerminal(page, ['PENDING']);

    await enterKiosk(page);
    await addWrapAndOpenCart(page);
    await submitKioskOrder(page);

    await expect(page.getByText('Le terminal ne répond pas')).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: /^annuler$/i }).click();

    // The dialog closes only after cancel-order resolved; then the cart is
    // back, contents intact, and the order ended cancelled.
    await expect(page.getByText('Le terminal ne répond pas')).toBeHidden();
    await expect(
      page.getByRole('button', { name: /valider ma commande/i })
    ).toBeVisible();
    await expect(page.locator('app-cart-badge')).toContainText('(1)');
    expect(stub.cancelCalls).toBe(1);
    await expect
      .poll(async () => (await readOrder(stub.orderId!)).status)
      .toBe('cancelled');
  });

  test('abandon after refusal: cart intact, order cancelled', async ({ page }) => {
    await enableTerminalForPage(page);
    const stub = await stubTerminal(page, ['REFUSED']);

    await enterKiosk(page);
    await addWrapAndOpenCart(page);
    await submitKioskOrder(page);

    await expect(page.getByText('Paiement refusé')).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: /^annuler$/i }).click();

    await expect(page.getByText('Paiement refusé')).toBeHidden();
    await expect(
      page.getByRole('button', { name: /valider ma commande/i })
    ).toBeVisible();
    await expect(page.locator('app-cart-badge')).toContainText('(1)');
    expect(stub.cancelCalls).toBe(1);
    await expect
      .poll(async () => (await readOrder(stub.orderId!)).status)
      .toBe('cancelled');
  });
});
