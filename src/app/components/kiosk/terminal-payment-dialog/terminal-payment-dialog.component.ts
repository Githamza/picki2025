import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';

import {
  QontoTerminalService,
  TerminalPaymentState,
} from '../../../services/qonto-terminal.service';

export interface TerminalPaymentDialogData {
  orderId: string;
  /** Order total, already formatted with two decimals ("12.50"). */
  amount: string;
}

export interface TerminalPaymentDialogResult {
  outcome: 'authorized' | 'cancelled';
}

/**
 * Full-screen kiosk payment surface (SPEC-QONTO-TERMINAL.md T11). Opened
 * with disableClose — while it is up, the kiosk idle timer is re-armed by
 * the open-dialog check, so a customer mid-payment is never idle-reset.
 * Failure and timeout share one error surface: Réessayer pushes a fresh
 * payment on the same order; Annuler cancels the order (cart preserved).
 */
@Component({
  selector: 'app-terminal-payment-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (view()) {
      @case ('waiting') {
        <div class="terminal-state" aria-live="polite">
          <mat-spinner diameter="64"></mat-spinner>
          <h2>Présentez votre carte sur le terminal</h2>
          <p class="terminal-amount">{{ displayAmount() }}</p>
          <p class="terminal-hint">Suivez les instructions sur le terminal de paiement.</p>
        </div>
      }
      @case ('error') {
        <div class="terminal-state" aria-live="assertive">
          <mat-icon class="error-icon" aria-hidden="true">credit_card_off</mat-icon>
          <h2>{{ errorTitle() }}</h2>
          <p class="terminal-hint">{{ errorHint() }}</p>
          <div class="terminal-actions">
            <button mat-flat-button color="primary" class="kiosk-action" (click)="retry()">
              <mat-icon aria-hidden="true">refresh</mat-icon>
              Réessayer
            </button>
            <button
              mat-stroked-button
              class="kiosk-action"
              [disabled]="isCancelling()"
              (click)="cancel()"
            >
              Annuler
            </button>
          </div>
        </div>
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: min(560px, 90vw);
      }

      .terminal-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        padding: 48px 32px;
        text-align: center;
      }

      h2 {
        font: var(--mat-sys-headline-medium);
        margin: 0;
      }

      .terminal-amount {
        font: var(--mat-sys-display-small);
        margin: 0;
        color: var(--mat-sys-primary);
      }

      .terminal-hint {
        font: var(--mat-sys-body-large);
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
      }

      .error-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: var(--mat-sys-error);
      }

      .terminal-actions {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        justify-content: center;
      }

      /* FR4 kiosk sizing: ≥64px touch targets. */
      .kiosk-action {
        min-height: 64px;
        min-width: 200px;
        font: var(--mat-sys-title-medium);
      }
    `,
  ],
})
export class TerminalPaymentDialogComponent implements OnInit, OnDestroy {
  private readonly terminalService = inject(QontoTerminalService);
  private readonly dialogRef =
    inject<MatDialogRef<TerminalPaymentDialogComponent, TerminalPaymentDialogResult>>(
      MatDialogRef
    );
  private readonly data = inject<TerminalPaymentDialogData>(MAT_DIALOG_DATA);

  protected readonly view = signal<'waiting' | 'error'>('waiting');
  protected readonly isCancelling = signal(false);
  private lastState: TerminalPaymentState | null = null;
  private subscription: Subscription | null = null;

  ngOnInit() {
    this.start();
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  protected displayAmount(): string {
    return `${this.data.amount.replace('.', ',')} €`;
  }

  protected errorTitle(): string {
    return this.lastState?.phase === 'timeout'
      ? 'Le terminal ne répond pas'
      : 'Paiement refusé';
  }

  protected errorHint(): string {
    if (this.lastState?.phase === 'timeout') {
      return 'Vérifiez que le terminal est allumé, puis réessayez.';
    }
    return 'Votre carte a été refusée. Réessayez ou utilisez une autre carte.';
  }

  protected retry() {
    this.start();
  }

  protected async cancel() {
    this.isCancelling.set(true);
    try {
      await this.terminalService.cancelOrder(this.data.orderId);
    } catch (error) {
      // The order stays 'initiated' and never prints — safe to let the
      // customer leave; staff can clean it up from the dashboard.
      console.error('Terminal cancel-order failed:', error);
    }
    this.dialogRef.close({ outcome: 'cancelled' });
  }

  private start() {
    this.subscription?.unsubscribe();
    this.view.set('waiting');
    this.subscription = this.terminalService
      .startPayment(this.data.orderId)
      .subscribe((state) => {
        this.lastState = state;
        switch (state.phase) {
          case 'authorized':
            this.dialogRef.close({ outcome: 'authorized' });
            break;
          case 'refused':
          case 'timeout':
            this.view.set('error');
            break;
          default:
            this.view.set('waiting');
        }
      });
  }
}
