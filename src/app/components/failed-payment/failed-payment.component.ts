import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { VendorNavigationService } from '../../services/vendor-navigation.service';

@Component({
  selector: 'app-failed-payment',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="failed-payment">
      <mat-card class="failed-card">
        <mat-card-header>
          <div mat-card-avatar class="failed-avatar">
            <mat-icon>error</mat-icon>
          </div>
          <mat-card-title>Paiement échoué</mat-card-title>
          <mat-card-subtitle
            >Votre commande n'a pas pu être traitée</mat-card-subtitle
          >
        </mat-card-header>

        <mat-card-content>
          <div class="failed-content">
            <div class="failed-message">
              <mat-icon class="large-icon">payment_failed</mat-icon>
              <h3>Oops ! Un problème est survenu</h3>
              <p>
                Votre paiement n'a pas pu être traité. Aucun montant n'a été
                débité de votre compte.
              </p>
            </div>

            <div class="error-details" *ngIf="errorInfo">
              <h4>Détails de l'erreur</h4>
              <div class="detail-row" *ngIf="errorInfo.errorCode">
                <span class="label">Code d'erreur :</span>
                <span class="value">{{ errorInfo.errorCode }}</span>
              </div>
              <div class="detail-row" *ngIf="errorInfo.errorMessage">
                <span class="label">Message :</span>
                <span class="value">{{ errorInfo.errorMessage }}</span>
              </div>
              <div class="detail-row" *ngIf="errorInfo.paymentId">
                <span class="label">ID de transaction :</span>
                <span class="value">{{ errorInfo.paymentId }}</span>
              </div>
              <div class="detail-row" *ngIf="errorInfo.provider">
                <span class="label">Fournisseur :</span>
                <span class="value">{{ errorInfo.provider }}</span>
              </div>
            </div>

            <div class="help-info">
              <h4>Que faire maintenant ?</h4>
              <ul>
                <li>
                  <mat-icon>credit_card</mat-icon>
                  Vérifiez les informations de votre carte bancaire
                </li>
                <li>
                  <mat-icon>account_balance</mat-icon>
                  Assurez-vous d'avoir suffisamment de fonds
                </li>
                <li>
                  <mat-icon>refresh</mat-icon>
                  Essayez à nouveau dans quelques minutes
                </li>
                <li>
                  <mat-icon>support_agent</mat-icon>
                  Contactez notre support si le problème persiste
                </li>
              </ul>
            </div>

            <div class="common-reasons">
              <h4>Raisons courantes d'échec</h4>
              <div class="reason-list">
                <div class="reason-item">
                  <mat-icon>block</mat-icon>
                  <span>Carte expirée ou bloquée</span>
                </div>
                <div class="reason-item">
                  <mat-icon>money_off</mat-icon>
                  <span>Fonds insuffisants</span>
                </div>
                <div class="reason-item">
                  <mat-icon>security</mat-icon>
                  <span>Vérification de sécurité échouée</span>
                </div>
                <div class="reason-item">
                  <mat-icon>network_check</mat-icon>
                  <span>Problème de connexion</span>
                </div>
              </div>
            </div>
          </div>
        </mat-card-content>

        <mat-card-actions align="end">
          <button mat-button (click)="goToMenu()">
            <mat-icon>restaurant_menu</mat-icon>
            Retour au menu
          </button>
          <button mat-button (click)="contactSupport()">
            <mat-icon>support_agent</mat-icon>
            Contacter le support
          </button>
          <button mat-raised-button color="primary" (click)="retryPayment()">
            <mat-icon>refresh</mat-icon>
            Réessayer
          </button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .failed-payment {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 80vh;
        padding: 20px;
        background: linear-gradient(135deg, #ffeaea 0%, #fff0f0 100%);
      }

      .failed-card {
        max-width: 600px;
        width: 100%;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      }

      .failed-avatar {
        background: #f44336;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .failed-content {
        text-align: center;
      }

      .failed-message {
        margin-bottom: 32px;
      }

      .large-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #f44336;
        margin-bottom: 16px;
      }

      .failed-message h3 {
        color: #d32f2f;
        margin: 16px 0 8px 0;
      }

      .failed-message p {
        color: var(--mat-sys-on-surface-variant);
        margin-bottom: 0;
      }

      .error-details {
        background: var(--mat-sys-error-container);
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 24px;
        text-align: left;
      }

      .error-details h4 {
        margin: 0 0 16px 0;
        color: var(--mat-sys-on-error-container);
      }

      .detail-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        padding: 4px 0;
      }

      .detail-row:last-child {
        margin-bottom: 0;
      }

      .label {
        font-weight: 500;
        color: var(--mat-sys-on-error-container);
        opacity: 0.8;
      }

      .value {
        font-weight: 600;
        color: var(--mat-sys-on-error-container);
      }

      .help-info {
        text-align: left;
        background: var(--mat-sys-surface-variant);
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 24px;
      }

      .help-info h4 {
        margin: 0 0 16px 0;
        color: var(--mat-sys-on-surface);
      }

      .help-info ul {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .help-info li {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
        color: var(--mat-sys-on-surface-variant);
      }

      .help-info li:last-child {
        margin-bottom: 0;
      }

      .help-info mat-icon {
        color: var(--mat-sys-primary);
      }

      .common-reasons {
        text-align: left;
        background: var(--mat-sys-secondary-container);
        border-radius: 8px;
        padding: 20px;
      }

      .common-reasons h4 {
        margin: 0 0 16px 0;
        color: var(--mat-sys-on-secondary-container);
      }

      .reason-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
      }

      .reason-item {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--mat-sys-on-secondary-container);
        font-size: 0.9rem;
      }

      .reason-item mat-icon {
        color: var(--mat-sys-secondary);
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      mat-card-actions button {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      @media (max-width: 600px) {
        .failed-payment {
          padding: 16px;
        }

        .detail-row {
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }

        .reason-list {
          grid-template-columns: 1fr;
        }

        mat-card-actions {
          flex-direction: column;
          align-items: stretch;
        }

        mat-card-actions button {
          width: 100%;
          justify-content: center;
        }
      }
    `,
  ],
})
export class FailedPaymentComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private vendorNavigation = inject(VendorNavigationService);

  errorInfo: any = null;

  ngOnInit() {
    // Extract error information from URL parameters
    this.route.queryParams.subscribe((params) => {
      this.errorInfo = {
        errorCode: params['error_code'] || params['error'],
        errorMessage: params['error_message'] || params['message'],
        paymentId: params['payment_id'] || params['session_id'] || params['id'],
        provider: params['provider'] || 'PayGreen',
        orderId: params['order_id'],
        // Add more parameters as needed based on what PayGreen returns
      };

      console.log('Payment failure info:', this.errorInfo);
    });
  }

  retryPayment(): void {
    // Navigate back to cart to retry payment
    this.vendorNavigation.navigateWithVendor('cartdetails');
  }

  goToMenu(): void {
    this.vendorNavigation.navigateWithVendor('products');
  }

  contactSupport(): void {
    // You can implement this to open a support chat, email, or phone
    // For now, we'll just show an alert
    alert(
      'Support: Contactez-nous au 01 23 45 67 89 ou support@restaurant.com'
    );
  }
}
