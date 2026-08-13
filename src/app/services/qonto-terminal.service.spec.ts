import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import {
  QontoTerminalService,
  TerminalPaymentState,
} from './qonto-terminal.service';
import { SupabaseService } from './supabase.service';

describe('QontoTerminalService', () => {
  let service: QontoTerminalService;
  let invokeSpy: jasmine.Spy;
  let getPaymentResponses: Array<{ status: string; failureReason?: string | null }>;
  let getPaymentCalls: number;

  beforeEach(() => {
    getPaymentCalls = 0;
    getPaymentResponses = [];
    invokeSpy = jasmine.createSpy('invoke').and.callFake(
      (_name: string, options: { body: { action: string } }) => {
        if (options.body.action === 'create-payment') {
          return Promise.resolve({ data: { paymentId: 'p1', amount: '12.50' }, error: null });
        }
        if (options.body.action === 'get-payment') {
          const index = Math.min(getPaymentCalls, getPaymentResponses.length - 1);
          getPaymentCalls += 1;
          return Promise.resolve({ data: getPaymentResponses[index], error: null });
        }
        return Promise.resolve({ data: { cancelled: true }, error: null });
      }
    );
    TestBed.configureTestingModule({
      providers: [
        QontoTerminalService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ functions: { invoke: invokeSpy } }) },
        },
      ],
    });
    service = TestBed.inject(QontoTerminalService);
    delete (window as any).__KIOSK_TERMINAL_TIMEOUT_MS__;
  });

  afterEach(() => {
    delete (window as any).__KIOSK_TERMINAL_TIMEOUT_MS__;
  });

  function collect(states: TerminalPaymentState[], done: { value: boolean }) {
    return service.startPayment('order-1').subscribe({
      next: (state) => states.push(state),
      complete: () => (done.value = true),
    });
  }

  it('emits pushing → waiting-card → authorized and completes', fakeAsync(() => {
    getPaymentResponses = [
      { status: 'PENDING' },
      { status: 'PENDING' },
      { status: 'AUTHORIZED' },
    ];
    const states: TerminalPaymentState[] = [];
    const done = { value: false };
    collect(states, done);

    tick(0);
    expect(states[0]).toEqual({ phase: 'pushing' });
    expect(states[1]).toEqual({ phase: 'waiting-card', paymentId: 'p1' });

    tick(3000);
    expect(states[states.length - 1]).toEqual({ phase: 'authorized', paymentId: 'p1' });
    expect(done.value).toBeTrue();
  }));

  it('emits refused with the failure reason', fakeAsync(() => {
    getPaymentResponses = [
      { status: 'PENDING' },
      { status: 'REFUSED', failureReason: 'card_declined' },
    ];
    const states: TerminalPaymentState[] = [];
    const done = { value: false };
    collect(states, done);

    tick(2100);
    expect(states[states.length - 1]).toEqual({
      phase: 'refused',
      paymentId: 'p1',
      failureReason: 'card_declined',
    });
    expect(done.value).toBeTrue();
  }));

  it('polls at 1s then backs off to 2s after ten polls', fakeAsync(() => {
    getPaymentResponses = [{ status: 'PENDING' }];
    const states: TerminalPaymentState[] = [];
    const done = { value: false };
    const subscription = collect(states, done);

    tick(0);
    tick(10_000); // polls 1..10 at 1s cadence
    expect(getPaymentCalls).toBe(10);

    tick(2000); // poll 11 arrives 2s later
    expect(getPaymentCalls).toBe(11);
    tick(2000);
    expect(getPaymentCalls).toBe(12);

    subscription.unsubscribe();
  }));

  it('times out through the overridable window hook', fakeAsync(() => {
    (window as any).__KIOSK_TERMINAL_TIMEOUT_MS__ = 5000;
    getPaymentResponses = [{ status: 'PENDING' }];
    const states: TerminalPaymentState[] = [];
    const done = { value: false };
    collect(states, done);

    tick(0);
    tick(5100);
    expect(states[states.length - 1]).toEqual({ phase: 'timeout', paymentId: 'p1' });
    expect(done.value).toBeTrue();
  }));

  it('stops polling on unsubscribe', fakeAsync(() => {
    getPaymentResponses = [{ status: 'PENDING' }];
    const states: TerminalPaymentState[] = [];
    const done = { value: false };
    const subscription = collect(states, done);

    tick(0);
    tick(3000);
    const callsAtUnsubscribe = getPaymentCalls;
    subscription.unsubscribe();

    tick(10_000);
    expect(getPaymentCalls).toBe(callsAtUnsubscribe);
    expect(done.value).toBeFalse();
  }));

  it('surfaces a create-payment failure as a generic refusal', fakeAsync(() => {
    invokeSpy.and.resolveTo({ data: null, error: { message: 'down' } });
    const states: TerminalPaymentState[] = [];
    const done = { value: false };
    collect(states, done);

    tick(0);
    const last = states[states.length - 1] as Extract<
      TerminalPaymentState,
      { phase: 'refused' }
    >;
    expect(last.phase).toBe('refused');
    expect(last.failureReason).toBeNull();
    expect(done.value).toBeTrue();
  }));

  it('cancelOrder invokes the edge action', async () => {
    await service.cancelOrder('order-1');
    expect(invokeSpy).toHaveBeenCalledWith('qonto-terminal', {
      body: { action: 'cancel-order', orderId: 'order-1' },
    });
  });
});
