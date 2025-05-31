import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  PaymentService,
  PaymentProvider,
} from '../../services/payment.service';

@Component({
  selector: 'app-payment-admin',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule],
  template: `
    <div class="payment-admin">
      <mat-card>
        <mat-card-header>
          <mat-card-title>
            <mat-icon>payment</mat-icon>
            Administration des Paiements
          </mat-card-title>
          <mat-card-subtitle>
            Gérer les méthodes de paiement disponibles
          </mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <div class="current-provider">
            <h3>Fournisseur Actuel</h3>
            <div class="provider-info">
              <mat-icon [class]="getCurrentProviderClass()">
                {{ getCurrentProviderIcon() }}
              </mat-icon>
              <span class="provider-name">
                {{ paymentService.getCurrentStrategy().name }}
              </span>
              <span class="provider-status" [class]="getStatusClass()">
                {{ getProviderStatus() }}
              </span>
            </div>
          </div>

          <div class="provider-controls">
            <h3>Changer de Fournisseur</h3>
            <div class="provider-buttons">
              <button
                mat-raised-button
                [color]="
                  getCurrentProvider() === 'paygreen' ? 'primary' : 'basic'
                "
                [disabled]="!isProviderAvailable('paygreen')"
                (click)="switchProvider('paygreen')"
              >
                <mat-icon>account_balance</mat-icon>
                PayGreen
                <span
                  class="availability"
                  *ngIf="!isProviderAvailable('paygreen')"
                >
                  (Non configuré)
                </span>
              </button>

              <button
                mat-raised-button
                [color]="
                  getCurrentProvider() === 'stripe' ? 'primary' : 'basic'
                "
                [disabled]="!isProviderAvailable('stripe')"
                (click)="switchProvider('stripe')"
              >
                <mat-icon>credit_card</mat-icon>
                Stripe Connect
                <span
                  class="availability"
                  *ngIf="!isProviderAvailable('stripe')"
                >
                  (Non configuré)
                </span>
              </button>
            </div>
          </div>

          <div class="provider-status-list">
            <h3>État des Fournisseurs</h3>
            <div class="status-list">
              <div
                *ngFor="let strategy of getAvailableStrategies()"
                class="status-item"
              >
                <mat-icon [class]="strategy.provider + '-icon'">
                  {{
                    strategy.provider === 'stripe'
                      ? 'credit_card'
                      : 'account_balance'
                  }}
                </mat-icon>
                <span class="strategy-name">{{ strategy.name }}</span>
                <span class="strategy-status available">Disponible</span>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .payment-admin {
        max-width: 600px;
        margin: 20px auto;
        padding: 16px;
      }

      .current-provider {
        margin-bottom: 24px;
      }

      .provider-info {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: var(--mat-sys-surface-variant);
        border-radius: 8px;
      }

      .provider-name {
        font-size: 1.2rem;
        font-weight: 500;
      }

      .provider-status {
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 0.8rem;
        font-weight: 500;
      }

      .provider-status.available {
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
      }

      .provider-controls {
        margin-bottom: 24px;
      }

      .provider-buttons {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }

      .provider-buttons button {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 160px;
      }

      .availability {
        font-size: 0.8rem;
        opacity: 0.7;
      }

      .status-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .status-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px;
        border-radius: 4px;
        background: var(--mat-sys-surface-container);
      }

      .strategy-name {
        flex: 1;
      }

      .strategy-status.available {
        color: var(--mat-sys-primary);
        font-weight: 500;
      }

      .paygreen-icon {
        color: #4caf50;
      }

      .stripe-icon {
        color: #635bff;
      }

      h3 {
        margin: 0 0 12px 0;
        color: var(--mat-sys-on-surface);
      }
    `,
  ],
})
export class PaymentAdminComponent {
  readonly paymentService = inject(PaymentService);
  private snackBar = inject(MatSnackBar);

  getCurrentProvider(): PaymentProvider {
    return this.paymentService.getCurrentProvider();
  }

  getCurrentProviderIcon(): string {
    return this.getCurrentProvider() === 'stripe'
      ? 'credit_card'
      : 'account_balance';
  }

  getCurrentProviderClass(): string {
    return this.getCurrentProvider() + '-icon';
  }

  getProviderStatus(): string {
    return this.paymentService.getCurrentStrategy().isAvailable()
      ? 'Disponible'
      : 'Non configuré';
  }

  getStatusClass(): string {
    return this.paymentService.getCurrentStrategy().isAvailable()
      ? 'available'
      : 'unavailable';
  }

  isProviderAvailable(provider: PaymentProvider): boolean {
    return this.paymentService.isProviderAvailable(provider);
  }

  getAvailableStrategies() {
    return this.paymentService.getAvailableStrategies();
  }

  switchProvider(provider: PaymentProvider): void {
    try {
      this.paymentService.setPaymentProvider(provider);
      const strategy = this.paymentService.getCurrentStrategy();

      this.snackBar.open(
        `Fournisseur de paiement changé vers ${strategy.name}`,
        'Fermer',
        { duration: 3000 }
      );
    } catch (error) {
      console.error('Error switching payment provider:', error);
      this.snackBar.open(
        `Erreur lors du changement de fournisseur: ${error}`,
        'Fermer',
        { duration: 5000 }
      );
    }
  }
}
