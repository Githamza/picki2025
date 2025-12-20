import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { VendorNavigationService } from '../../services/vendor-navigation.service';

@Component({
  selector: 'app-payment-failed',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="payment-container">
      <mat-card class="payment-card">
        <mat-card-content>
          <div class="error-icon">
            <mat-icon class="error-icon-svg">error</mat-icon>
          </div>
          <h1>Paiement échoué</h1>
          <p class="error-message">
            Nous n'avons pas pu traiter votre paiement.
          </p>
          <p class="error-info">
            Veuillez vérifier vos informations de paiement et réessayer.
          </p>
          <div class="action-buttons">
            <button mat-raised-button color="primary" (click)="retryPayment()">
              <mat-icon>refresh</mat-icon>
              Réessayer le paiement
            </button>
            <button mat-stroked-button (click)="goHome()">
              <mat-icon>home</mat-icon>
              Retour à l'accueil
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .payment-container {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background-color: #f5f5f5;
      }

      .payment-card {
        max-width: 500px;
        width: 100%;
        text-align: center;
        padding: 40px 20px;
      }

      .error-icon {
        margin-bottom: 30px;
      }

      .error-icon-svg {
        font-size: 80px;
        height: 80px;
        width: 80px;
        color: #f44336;
      }

      h1 {
        color: #f44336;
        margin-bottom: 20px;
        font-size: 28px;
      }

      .error-message {
        font-size: 18px;
        color: #666;
        margin-bottom: 10px;
      }

      .error-info {
        font-size: 16px;
        color: #888;
        margin-bottom: 30px;
      }

      .action-buttons {
        display: flex;
        gap: 15px;
        justify-content: center;
        flex-wrap: wrap;
      }

      @media (max-width: 480px) {
        .payment-card {
          padding: 30px 15px;
        }

        h1 {
          font-size: 24px;
        }

        .error-icon-svg {
          font-size: 60px;
          height: 60px;
          width: 60px;
        }

        .action-buttons {
          flex-direction: column;
          width: 100%;

          button {
            width: 100%;
          }
        }
      }
    `,
  ],
})
export class PaymentFailedComponent {
  private router = inject(Router);
  private vendorNavigation = inject(VendorNavigationService);

  retryPayment() {
    // Navigate back to cart to retry payment
    this.vendorNavigation.navigateWithVendor('cartdetails');
  }

  goHome() {
    this.vendorNavigation.navigateWithVendor(['promotional-banner', 'products']);
  }
}
