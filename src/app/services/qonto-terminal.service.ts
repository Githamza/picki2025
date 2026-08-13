import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { SupabaseService } from './supabase.service';

export type TerminalPaymentState =
  | { phase: 'pushing' }
  | { phase: 'waiting-card'; paymentId: string }
  | { phase: 'authorized'; paymentId: string }
  | { phase: 'refused'; paymentId: string | null; failureReason: string | null }
  | { phase: 'timeout'; paymentId: string | null };

const POLL_FAST_MS = 1_000;
const POLL_FAST_COUNT = 10;
const POLL_SLOW_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 120_000; // Qonto's own offline-terminal guidance

/**
 * Kiosk-side driver for the qonto-terminal edge function
 * (SPEC-QONTO-TERMINAL.md T10). Pushes the payment, then polls the outcome:
 * 1s cadence for ten polls, 2s after that, hard stop at 120s
 * (`window.__KIOSK_TERMINAL_TIMEOUT_MS__` overrides it, same pattern as the
 * kiosk idle hooks). The outcome always comes from the server — AUTHORIZED
 * here means the edge function has already flipped the order to `todo`.
 */
@Injectable({ providedIn: 'root' })
export class QontoTerminalService {
  private readonly supabase = inject(SupabaseService);

  startPayment(orderId: string): Observable<TerminalPaymentState> {
    return new Observable<TerminalPaymentState>((subscriber) => {
      let stopped = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const timeoutMs =
        (window as any).__KIOSK_TERMINAL_TIMEOUT_MS__ ?? DEFAULT_TIMEOUT_MS;
      const startedAt = Date.now();

      const run = async () => {
        subscriber.next({ phase: 'pushing' });

        let paymentId: string;
        try {
          const created = await this.invoke<{ paymentId: string }>({
            action: 'create-payment',
            orderId,
          });
          paymentId = created.paymentId;
        } catch (error) {
          console.error('Terminal create-payment failed:', error);
          if (stopped) return;
          subscriber.next({ phase: 'refused', paymentId: null, failureReason: null });
          subscriber.complete();
          return;
        }
        if (stopped) return;
        subscriber.next({ phase: 'waiting-card', paymentId });

        let polls = 0;
        const poll = async () => {
          if (stopped) return;
          if (Date.now() - startedAt >= timeoutMs) {
            subscriber.next({ phase: 'timeout', paymentId });
            subscriber.complete();
            return;
          }
          polls += 1;
          try {
            const result = await this.invoke<{
              status: 'PENDING' | 'AUTHORIZED' | 'REFUSED';
              failureReason?: string | null;
            }>({ action: 'get-payment', orderId, paymentId });
            if (stopped) return;
            if (result.status === 'AUTHORIZED') {
              subscriber.next({ phase: 'authorized', paymentId });
              subscriber.complete();
              return;
            }
            if (result.status === 'REFUSED') {
              subscriber.next({
                phase: 'refused',
                paymentId,
                failureReason: result.failureReason ?? null,
              });
              subscriber.complete();
              return;
            }
          } catch (error) {
            // Transient poll failure: keep polling until the hard timeout.
            console.error('Terminal get-payment poll failed:', error);
          }
          schedule();
        };

        const schedule = () => {
          if (stopped) return;
          timer = setTimeout(
            () => void poll(),
            polls < POLL_FAST_COUNT ? POLL_FAST_MS : POLL_SLOW_MS
          );
        };

        schedule();
      };

      void run();

      return () => {
        stopped = true;
        if (timer !== undefined) clearTimeout(timer);
      };
    });
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.invoke({ action: 'cancel-order', orderId });
  }

  private async invoke<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.supabase
      .getClient()
      .functions.invoke<T>('qonto-terminal', { body });
    if (error) {
      throw new Error(error.message || String(error));
    }
    if (!data) {
      throw new Error('qonto-terminal returned no data');
    }
    return data;
  }
}
