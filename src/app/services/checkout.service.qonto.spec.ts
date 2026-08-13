import { kioskPaymentPlan } from './checkout.service';

/**
 * Kiosk × terminal-toggle truth table (SPEC-QONTO-TERMINAL.md T12).
 * The toggle-OFF kiosk path must stay byte-for-byte the current behavior:
 * pay-at-counter, order created as 'todo'. Terminal ON gates the order on
 * an 'initiated' status until the edge function settles it.
 */
describe('kioskPaymentPlan', () => {
  it('kiosk OFF + online payments ON → online flow, terminal irrelevant', () => {
    expect(
      kioskPaymentPlan({
        kioskActive: false,
        onlinePaymentsEnabled: true,
        kioskTerminalEnabled: true, // must be ignored off-kiosk
      })
    ).toEqual({
      payAtCheckout: false,
      useTerminal: false,
      orderStatus: 'initiated',
      dbPayAtCheckout: false,
    });
  });

  it('kiosk OFF + online payments OFF → pay at counter, todo', () => {
    expect(
      kioskPaymentPlan({
        kioskActive: false,
        onlinePaymentsEnabled: false,
        kioskTerminalEnabled: false,
      })
    ).toEqual({
      payAtCheckout: true,
      useTerminal: false,
      orderStatus: 'todo',
      dbPayAtCheckout: true,
    });
  });

  it('kiosk ON + terminal OFF → the unchanged FR4a flow (todo + counter)', () => {
    expect(
      kioskPaymentPlan({
        kioskActive: true,
        onlinePaymentsEnabled: true,
        kioskTerminalEnabled: false,
      })
    ).toEqual({
      payAtCheckout: true,
      useTerminal: false,
      orderStatus: 'todo',
      dbPayAtCheckout: true,
    });
  });

  it('kiosk ON + terminal ON → gated on the terminal (initiated)', () => {
    expect(
      kioskPaymentPlan({
        kioskActive: true,
        onlinePaymentsEnabled: false,
        kioskTerminalEnabled: true,
      })
    ).toEqual({
      payAtCheckout: true,
      useTerminal: true,
      orderStatus: 'initiated',
      dbPayAtCheckout: false,
    });
  });
});
