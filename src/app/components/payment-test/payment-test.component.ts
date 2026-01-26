import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { PaymentService } from '../../services/payment.service';
import { PaymentRequest } from '../../services/payment-strategy.interface';
import { VendorService } from '../../services/vendor.service';
import { VendorNavigationService } from '../../services/vendor-navigation.service';
import { VendorCurrencyPipe } from '../../shared/pipes/vendor-currency.pipe';
import {
  UserInfoDialogComponent,
  UserInfo,
} from '../user-info-dialog/user-info-dialog.component';

@Component({
  selector: 'app-payment-test',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    VendorCurrencyPipe,
  ],
  template: `
    <div class="payment-test">
      <mat-card>
        <mat-card-header>
          <mat-card-title>
            <mat-icon>shopping_cart</mat-icon>
            Test de Paiement
          </mat-card-title>
          <mat-card-subtitle>
            Tester le flux de paiement avec {{ getCurrentProviderName() }}
          </mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <div class="test-order">
            <h3>Commande Test</h3>
            <div class="order-items">
              <div class="item">
                <span>Pizza Margherita</span>
                <span>2x {{ 12.5 | vendorCurrency }} = {{ 25 | vendorCurrency }}</span>
              </div>
              <div class="item">
                <span>Coca Cola</span>
                <span>1x {{ 2.5 | vendorCurrency }} = {{ 2.5 | vendorCurrency }}</span>
              </div>
              <div class="total">
                <strong>Total: {{ 27.5 | vendorCurrency }}</strong>
              </div>
            </div>
          </div>

          <div class="current-provider">
            <h3>Fournisseur Actuel</h3>
            <div class="provider-info">
              <mat-icon [class]="getCurrentProviderClass()">
                {{ getCurrentProviderIcon() }}
              </mat-icon>
              <span>{{ getCurrentProviderName() }}</span>
            </div>
          </div>

          <div class="test-actions">
            <button
              mat-raised-button
              color="primary"
              (click)="testPayment()"
              [disabled]="isProcessing"
            >
              <mat-icon>payment</mat-icon>
              {{ isProcessing ? 'Traitement...' : 'Tester le Paiement' }}
            </button>

            <button
              mat-stroked-button
              color="accent"
              (click)="switchProvider()"
              [disabled]="isProcessing"
            >
              <mat-icon>swap_horiz</mat-icon>
              Changer de Fournisseur
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .payment-test {
        max-width: 500px;
        margin: 20px auto;
        padding: 16px;
      }

      .test-order {
        margin-bottom: 24px;
      }

      .order-items {
        background: var(--mat-sys-surface-variant);
        border-radius: 8px;
        padding: 16px;
      }

      .item {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
      }

      .total {
        border-top: 1px solid var(--mat-sys-outline);
        padding-top: 8px;
        margin-top: 8px;
        text-align: right;
      }

      .current-provider {
        margin-bottom: 24px;
      }

      .provider-info {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
        border-radius: 8px;
      }

      .test-actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }

      .test-actions button {
        flex: 1;
        min-width: 160px;
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
export class PaymentTestComponent {
  private paymentService = inject(PaymentService);
  private vendorService = inject(VendorService);
  private vendorNavigation = inject(VendorNavigationService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  isProcessing = false;

  getCurrentProviderName(): string {
    return this.paymentService.getCurrentStrategy().name;
  }

  getCurrentProviderIcon(): string {
    return this.paymentService.getCurrentProvider() === 'stripe'
      ? 'credit_card'
      : 'account_balance';
  }

  getCurrentProviderClass(): string {
    return this.paymentService.getCurrentProvider() + '-icon';
  }

  testPayment(): void {
    // Open user info dialog first
    const dialogRef = this.dialog.open(UserInfoDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      disableClose: true,
      autoFocus: true,
    });

    dialogRef.afterClosed().subscribe((userInfo: UserInfo) => {
      if (userInfo) {
        // User provided info, proceed with payment test
        this.processTestPayment(userInfo);
      }
      // If userInfo is null/undefined, user cancelled the dialog
    });
  }

  private processTestPayment(userInfo: UserInfo): void {
    this.isProcessing = true;

    // Build return URLs with vendor context
    const baseUrl = window.location.origin;
    const returnUrl = `${baseUrl}${this.vendorNavigation.getVendorUrl(
      'successPayment'
    )}`;
    const cancelUrl = `${baseUrl}${this.vendorNavigation.getVendorUrl(
      'failedPayment'
    )}`;

    const testPaymentRequest: PaymentRequest = {
      amount: 27.5,
      currency: this.vendorService.getCurrentCurrency(),
      buyer: {
        email: userInfo.email,
        firstName: userInfo.prenom,
        lastName: userInfo.nom,
        phone: userInfo.phone,
      },
      items: [
        {
          name: 'Pizza Margherita',
          quantity: 2,
          price: 12.5,
        },
        {
          name: 'Coca Cola',
          quantity: 1,
          price: 2.5,
        },
      ],
      returnUrl,
      cancelUrl,
      metadata: {
        testOrder: true,
        source: 'payment-test-component',
        userInfo: {
          nom: userInfo.nom,
          prenom: userInfo.prenom,
          email: userInfo.email,
          phone: userInfo.phone,
        },
      },
      // Add vendorId for Stripe Connect testing
      // vendorId: 'acct_test_vendor_id',
    };

    const currentProvider = this.paymentService.getCurrentProvider();
    console.log(`Testing payment with ${currentProvider}...`);

    this.paymentService.createPayment(testPaymentRequest).subscribe({
      next: (response) => {
        console.log('Payment test successful:', response);
        this.isProcessing = false;

        if (response.url) {
          // Show success message and redirect option
          this.snackBar.open(
            `Paiement créé avec ${response.provider}! Redirection...`,
            'Fermer',
            { duration: 3000 }
          );

          // Redirect to payment page
          setTimeout(() => {
            window.location.href = response.url!;
          }, 1000);
        } else {
          this.snackBar.open(
            `Paiement créé avec ${response.provider}! ID: ${response.id}`,
            'Fermer',
            { duration: 5000 }
          );
        }
      },
      error: (error) => {
        console.error('Payment test failed:', error);
        this.isProcessing = false;
        this.snackBar.open(
          `Erreur lors du test de paiement avec ${currentProvider}: ${
            error.message || error
          }`,
          'Fermer',
          { duration: 5000 }
        );
      },
    });
  }

  switchProvider(): void {
    const currentProvider = this.paymentService.getCurrentProvider();
    const newProvider = currentProvider === 'paygreen' ? 'stripe' : 'paygreen';

    try {
      this.paymentService.setPaymentProvider(newProvider);
      this.snackBar.open(
        `Fournisseur changé vers ${this.getCurrentProviderName()}`,
        'Fermer',
        { duration: 3000 }
      );
    } catch (error) {
      console.error('Error switching provider:', error);
      this.snackBar.open(`Erreur lors du changement: ${error}`, 'Fermer', {
        duration: 5000,
      });
    }
  }
}
