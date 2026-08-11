import { Component, OnInit, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Store } from '@ngrx/store';
import { AppState } from '../../store/models/app.state';
import { clearCart } from '../../store/actions/cart.actions';
import { OrdersService } from '../../services/orders.service';
import { Order } from '../../models/order.model';
import { DiningPreferenceService } from '../../services/dining-preference.service';
import { PaygreenConfigService } from '../../services/paygreen-config.service';
import { interval, Subscription } from 'rxjs';
import { VendorNavigationService } from '../../services/vendor-navigation.service';
import { VendorService } from '../../services/vendor.service';
import { KioskModeService } from '../../services/kiosk-mode.service';
import { EmailService } from '../../services/email.service';
import { MapLocationViewerComponent } from '../../shared/components/map-location-viewer/map-location-viewer.component';
import { VendorCurrencyPipe } from '../../shared/pipes/vendor-currency.pipe';
import { shortOrderNumber } from '../../shared/utils/order-number.util';

@Component({
  selector: 'app-payment-success',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MapLocationViewerComponent,
    VendorCurrencyPipe,
  ],
  template: `
    <!-- FR4a: kiosk full-screen confirmation — giant order number,
         pay-at-counter instruction, auto-return to the attract screen. -->
    @if (kioskMode.active() && orderDetails?.payAtCheckout) {
      <div class="kiosk-confirmation">
        <mat-icon class="kiosk-confirmation-icon">receipt_long</mat-icon>
        <p class="kiosk-confirmation-label">Votre numéro de commande</p>
        <p class="kiosk-order-number">{{ shortNumber(orderDetails?.orderNumber) }}</p>
        <p class="kiosk-order-number-full">Réf. {{ orderDetails?.orderNumber }}</p>
        <p class="kiosk-confirmation-instruction">
          Payez au comptoir en donnant ce numéro.
        </p>
        <button mat-flat-button color="primary" (click)="finishKioskOrder()">
          Terminer
        </button>
        <p class="kiosk-return-hint">
          Retour à l'accueil dans {{ kioskReturnSeconds() }} s
        </p>
      </div>
    }
    <div class="payment-container">
      <mat-card class="payment-card">
        <mat-card-content>
          <div *ngIf="!isProcessing; else processing">
            <!-- Show warning if payment details error -->
            <div *ngIf="paymentDetailsError" class="global-error-banner">
              <mat-icon>error</mat-icon>
              <div class="error-text">
                <h3>Impossible de récupérer les informations de paiement</h3>
                <p>
                  Une erreur s'est produite lors de la récupération des détails de votre paiement.
                  <span *ngIf="orderDetails">
                    Votre commande <strong>#{{ orderDetails.orderNumber }}</strong> a été enregistrée.
                  </span>
                  <span *ngIf="!orderDetails">
                    Veuillez vérifier votre email de confirmation ou contacter le restaurant directement.
                  </span>
                </p>
              </div>
            </div>

            <!-- Only show success indicators if no payment error -->
            <div *ngIf="!paymentDetailsError">
              <div class="success-icon">
                <mat-icon class="success-icon-svg">{{
                  orderDetails?.payAtCheckout ? 'receipt_long' : 'check_circle'
                }}</mat-icon>
              </div>
              <h1>
                {{
                  orderDetails?.payAtCheckout
                    ? 'Commande enregistrée !'
                    : 'Paiement réussi !'
                }}
              </h1>
              <p class="success-message">
                {{
                  orderDetails?.payAtCheckout
                    ? 'Paiement à effectuer au retrait / à la caisse.'
                    : 'Votre commande a été confirmée avec succès.'
                }}
              </p>
              <!-- Order Information -->
              <div class="order-details" *ngIf="orderDetails">
                <div class="order-header">
                  <h2>Détails de la commande</h2>
                  <div class="order-meta">
                    <p class="order-info order-number">
                      <strong>Nº:</strong> {{ orderDetails.orderNumber }}
                    </p>
                    <p class="order-info">
                      {{ getOrderTypeText(orderDetails.orderType) }}
                    </p>
                    <p class="order-info" *ngIf="orderDetails.timing">
                      {{ getTimingText(orderDetails.timing) }}
                    </p>
                    <p class="order-info" *ngIf="orderDetails.scheduledTime">
                      <strong>Heure prévue:</strong>
                      {{ orderDetails.scheduledTime | date : 'short' : 'fr-FR' }}
                    </p>
                    <h1
                      class="status-badge"
                      [ngClass]="'status-' + orderDetails.status"
                    >
                      {{ getStatusText(orderDetails.status) }}
                    </h1>
                    <p class="refuse-reason-inline" *ngIf="orderDetails.status === 'refused' && orderDetails.refuse_reason">
                      <strong>Motif:</strong> {{ orderDetails.refuse_reason }}
                    </p>
                  </div>
                </div>
  
                <!-- Delivery Information -->
                <div
                  class="delivery-info"
                  *ngIf="orderDetails?.orderType === 'delivery' && deliveryInfo"
                >
                  <h3>Informations de livraison</h3>
                  <div *ngIf="hasDropoffCoords()" class="dropoff-map">
                    <app-map-location-viewer
                      [coordinates]="getDropoffCoords()!"
                    ></app-map-location-viewer>
                  </div>
                  <p *ngIf="deliveryInfo?.dropoff_line1">
                    <strong>Adresse:</strong>
                    {{ deliveryInfo.dropoff_line1 }},
                    {{ deliveryInfo.dropoff_postal_code }}
                    {{ deliveryInfo.dropoff_city }}
                  </p>
                  <p>
                    <strong>Statut:</strong>
                    {{ getDeliveryStatusText(deliveryInfo?.status) }}
                  </p>
                  <p *ngIf="etaRemainingMinutes !== undefined">
                    <strong>Arrivée estimée:</strong>
                    dans {{ etaRemainingMinutes }} min
                  </p>
                  <div
                    *ngIf="deliveryInfo?.tracking_url"
                    class="tracking-section"
                  >
                    <p>
                      <a
                        mat-button
                        [href]="deliveryInfo.tracking_url"
                        rel="noopener"
                        target="_blank"
                        >Ouvrir le suivi dans un nouvel onglet</a
                      >
                    </p>
                    <div
                      class="tracking-iframe-container"
                      *ngIf="
                        getSafeTrackingUrl() &&
                        !deliveryInfo?.tracking_url?.includes('uber.com')
                      "
                    >
                      <iframe
                        [src]="getSafeTrackingUrl()"
                        class="tracking-iframe"
                        frameborder="0"
                        allowfullscreen
                        referrerpolicy="no-referrer-when-downgrade"
                        sandbox="allow-scripts allow-same-origin allow-forms"
                        loading="lazy"
                        title="Suivi de livraison"
                      >
                      </iframe>
                    </div>
                  </div>
                </div>
  
                <!-- Customer Information -->
                <div class="customer-info" *ngIf="orderDetails.customer">
                  <h3>Informations client</h3>
                  <p>
                    <strong>Nom:</strong> {{ orderDetails.customer.firstName }}
                    {{ orderDetails.customer.lastName }}
                  </p>
                  <p><strong>Email:</strong> {{ orderDetails.customer.email }}</p>
                  <p *ngIf="orderDetails.customer.phone">
                    <strong>Téléphone:</strong> {{ orderDetails.customer.phone }}
                  </p>
                </div>
  
                <!-- Order Items -->
                <div class="order-items">
                  <h3>Articles commandés</h3>
                  <div class="items-list">
                    <div class="item" *ngFor="let item of orderDetails.items">
                      <div class="item-info">
                        <span class="item-name">{{ item.productName }}</span>
                        <span class="item-quantity">x{{ item.quantity }}</span>
                      </div>
                      <div class="item-price">
                        {{
                          item.price * item.quantity | vendorCurrency
                        }}
                      </div>
                    </div>
                  </div>
  
                  <div class="total">
                    <strong
                      >Total:
                      {{
                        orderDetails.totalAmount | vendorCurrency
                      }}</strong
                    >
                  </div>
                </div>
  
                <!-- Payment Information -->
                <div
                  class="payment-info"
                  *ngIf="
                    paymentDetails &&
                    !paymentDetailsError &&
                    !orderDetails?.payAtCheckout
                  "
                >
                  <h3>Informations de paiement</h3>
                  <p><strong>Méthode:</strong> {{ getPaymentMethodText() }}</p>
                  <p>
                    <strong>Montant:</strong>
                    {{
                      paymentDetails.amount
                        | vendorCurrency : 'symbol' : '1.2-2' : paymentDetails.currency
                    }}
                  </p>
                  <p><strong>Statut:</strong> {{ paymentDetails.status }}</p>
                  <p *ngIf="paymentDetails.platforms?.length">
                    <strong>Plateforme:</strong> {{ paymentDetails.platforms[0] }}
                  </p>
                </div>
  
                <!-- Notes -->
                <div class="order-notes" *ngIf="orderDetails.notes">
                  <h3>Notes</h3>
                  <p>{{ orderDetails.notes }}</p>
                </div>
  
                <!-- Refuse Reason -->
                <div class="refuse-reason" *ngIf="orderDetails.status === 'refused' && orderDetails.refuse_reason">
                  <h3>Motif de refus</h3>
                  <p>{{ orderDetails.refuse_reason }}</p>
                </div>
              </div>
            </div>


            <!-- Fallback order number display -->
            @if(paymentDetails && orderNumber && !orderDetails) {

              <p class="order-info" >
                Numéro de commande: <strong>{{ orderNumber }}</strong>
                
              </p>
              <p class="order-info">
                Un email de confirmation vous a été envoyé.
              </p>
            }


            <div class="action-buttons">
              <button
                mat-raised-button
                color="primary"
                (click)="navigateHome()"
              >
                <mat-icon>home</mat-icon>
                Retour à l'accueil
              </button>
            </div>
          </div>
          <ng-template #processing>
            <div class="processing-container">
              <mat-spinner diameter="60"></mat-spinner>
              <p class="processing-message">Traitement de votre commande...</p>
            </div>
          </ng-template>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .kiosk-confirmation {
        position: fixed;
        inset: 0;
        z-index: 1500;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        background: var(--mat-sys-surface);
        text-align: center;
        padding: 32px;
      }
      .kiosk-confirmation-icon {
        font-size: 72px;
        width: 72px;
        height: 72px;
        color: var(--mat-sys-primary);
      }
      .kiosk-confirmation-label {
        margin: 0;
        font: var(--mat-sys-headline-small);
        color: var(--mat-sys-on-surface-variant);
      }
      .kiosk-order-number {
        margin: 0;
        font: var(--mat-sys-display-large);
        font-weight: 700;
        letter-spacing: 2px;
        color: var(--mat-sys-primary);
      }
      .kiosk-order-number-full {
        margin: 0;
        font: var(--mat-sys-body-medium);
        color: var(--mat-sys-on-surface-variant);
      }
      .kiosk-confirmation-instruction {
        margin: 0;
        font: var(--mat-sys-headline-small);
        color: var(--mat-sys-on-surface);
      }
      .kiosk-return-hint {
        margin: 8px 0 0 0;
        font: var(--mat-sys-body-medium);
        color: var(--mat-sys-on-surface-variant);
      }

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

      .global-error-banner {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        padding: 20px;
        margin-bottom: 30px;
        background-color: #ffebee;
        border: 1px solid #ef5350;
        border-radius: 8px;
        text-align: left;

        mat-icon {
          color: #d32f2f;
          font-size: 32px;
          width: 32px;
          height: 32px;
          flex-shrink: 0;
        }

        .error-text {
          flex: 1;

          h3 {
            margin: 0 0 8px 0;
            color: #c62828;
            font-size: 18px;
            font-weight: 600;
          }

          p {
            margin: 0;
            color: #555;
            font-size: 14px;
            line-height: 1.5;
          }
        }
      }

      .success-icon {
        margin-bottom: 30px;
      }

      .success-icon-svg {
        font-size: 80px;
        height: 80px;
        width: 80px;
        color: #4caf50;
      }

      h1 {
        color: #4caf50;
        margin-bottom: 20px;
        font-size: 28px;
      }

      .success-message {
        font-size: 18px;
        color: #666;
        margin-bottom: 30px;
      }

      .order-details {
        text-align: left;
        margin: 30px 0;
        padding: 20px;
        background-color: #f9f9f9;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
      }

      .order-header h2 {
        color: #333;
        margin: 0 0 20px 0;
        font-size: 22px;
        text-align: center;
      }

      .order-meta {
        display: grid;
        gap: 10px;
        margin-bottom: 20px;
        justify-items: center;
      }

      .customer-info,
      .order-items,
      .payment-info,
      .delivery-info,
      .order-notes {
        margin: 20px 0;
        padding: 15px;
        background-color: #fff;
        border-radius: 6px;
        border-left: 4px solid #4caf50;
      }

      .refuse-reason {
        margin: 20px 0;
        padding: 15px;
        background-color: #ffebee;
        border-radius: 6px;
        border-left: 4px solid #f44336;
      }

      .customer-info h3,
      .order-items h3,
      .payment-info h3,
      .delivery-info h3,
      .order-notes h3,
      .refuse-reason h3 {
        color: #333;
        margin: 0 0 15px 0;
        font-size: 18px;
      }

      .refuse-reason h3 {
        color: #c62828;
      }

      .refuse-reason p {
        margin: 8px 0;
        color: #c62828;
        font-weight: 500;
      }

      .items-list {
        margin-bottom: 15px;
      }

      .item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 0;
        border-bottom: 1px solid #eee;
      }

      .item:last-child {
        border-bottom: none;
      }

      .item-info {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .item-name {
        font-weight: 500;
        color: #333;
      }

      .item-quantity {
        background-color: #e8f5e8;
        color: #2e7d32;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 500;
      }

      .item-price {
        font-weight: 600;
        color: #4caf50;
      }

      .total {
        text-align: right;
        padding-top: 15px;
        border-top: 2px solid #4caf50;
        font-size: 18px;
        color: #2e7d32;
      }

      .status-badge {
        padding: 4px 12px;
        border-radius: 16px;
        font-weight: 500;
        text-transform: uppercase;
        align-self: center;
        text-align: center;
      }

      .status-initiated {
        background-color: #fff3e0;
        color: #f57c00;
      }
      .status-paid {
        background-color: #e8f5e8;
        color: #2e7d32;
      }
      .status-refused {
        background-color: #ffebee;
        color: #c62828;
      }
      .status-todo {
        background-color: #e8f5e8;
        color: #2e7d32;
      }
      .status-ongoing {
        background-color: #e3f2fd;
        color: #1976d2;
      }
      .status-done {
        background-color: #f3e5f5;
        color: #7b1fa2;
      }
      .status-picked {
        background-color: #e0f2f1;
        color: #00695c;
      }
      .status-cancelled {
        background-color: #ffebee;
        color: #c62828;
      }

      .refuse-reason-inline {
        margin: 8px 0 0 0;
        padding: 8px 12px;
        background-color: #ffebee;
        border-radius: 6px;
        color: #c62828;
        font-size: 14px;
        text-align: center;
      }

      .order-info {
        font-size: 16px;
        font-weight: bold;
        color: #666;
        margin-bottom: 10px;
        text-align: center;
      }

      .order-number {
        font-size: 32px;
        font-weight: bold;
      }

      .customer-info p,
      .payment-info p,
      .order-notes p {
        margin: 8px 0;
        color: #555;
      }

      .tracking-section {
        margin-top: 15px;
      }

      .tracking-iframe-container {
        margin-top: 15px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
        background-color: #fff;
        min-height: 400px;
        position: relative;
      }

      .tracking-iframe {
        width: 100%;
        height: 400px;
        border: none;
        display: block;
      }

      .dropoff-map {
        margin: 12px 0 16px 0;
      }

      .action-buttons {
        display: flex;
        gap: 15px;
        justify-content: center;
        flex-wrap: wrap;
        margin-top: 30px;
      }

      .processing-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        padding: 40px;
      }

      .processing-message {
        font-size: 18px;
        color: #666;
      }

      @media (max-width: 768px) {
        .payment-card {
          max-width: 100%;
          padding: 20px 15px;
        }

        .order-meta {
          grid-template-columns: 1fr;
        }

        .order-details {
          padding: 15px;
        }

        .tracking-iframe-container {
          min-height: 350px;
        }

        .tracking-iframe {
          height: 350px;
        }
      }

      @media (max-width: 480px) {
        .payment-card {
          padding: 30px 15px;
        }

        h1 {
          font-size: 24px;
        }

        .success-icon-svg {
          font-size: 60px;
          height: 60px;
          width: 60px;
        }

        .item {
          flex-direction: column;
          align-items: flex-start;
          gap: 5px;
        }

        .item-info {
          width: 100%;
          justify-content: space-between;
        }

        .tracking-iframe-container {
          min-height: 300px;
        }

        .tracking-iframe {
          height: 300px;
        }
      }
    `,
  ],
})
export class PaymentSuccessComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private store = inject(Store<AppState>);
  private ordersService = inject(OrdersService);
  private diningPreferenceService = inject(DiningPreferenceService);
  private paygreenConfig = inject(PaygreenConfigService);
  private vendorNavigation = inject(VendorNavigationService);
  private vendorService = inject(VendorService);
  protected kioskMode = inject(KioskModeService);

  // FR4a: kiosk confirmation auto-returns to the attract screen.
  readonly kioskReturnSeconds = signal(0);
  private kioskReturnTimer?: ReturnType<typeof setInterval>;
  private emailService = inject(EmailService);
  private sanitizer = inject(DomSanitizer);

  isProcessing = true;
  orderNumber?: string;
  orderDetails?: Order;
  paymentDetails?: any;
  paymentDetailsError = false;
  // Delivery display state
  deliveryInfo?: any;
  etaRemainingMinutes?: number;

  // Auto-refresh subscription
  private autoRefreshSubscription?: Subscription;
  private deliveryRefreshActive = false;
  private orderId?: string;

  hasDropoffCoords(): boolean {
    const lat = Number((this.deliveryInfo as any)?.dropoff_lat);
    const lng = Number((this.deliveryInfo as any)?.dropoff_lng);
    return isFinite(lat) && isFinite(lng);
  }

  getDropoffCoords(): { lat: number; lng: number } | null {
    if (!this.hasDropoffCoords()) return null;
    return {
      lat: Number((this.deliveryInfo as any)?.dropoff_lat),
      lng: Number((this.deliveryInfo as any)?.dropoff_lng),
    };
  }

  ngOnInit() {
    // Check if we have an orderId in the URL (coming from tracking link)
    const orderId = this.route.snapshot.queryParamMap.get('orderId');

    if (orderId) {
      // User is accessing via tracking link
      this.loadOrderFromTrackingLink(orderId);
    } else {
      // Normal payment success flow
      this.processSuccessfulPayment();
    }
  }

  ngOnDestroy() {
    // Clean up the auto-refresh subscription
    if (this.autoRefreshSubscription) {
      this.autoRefreshSubscription.unsubscribe();
    }
    if (this.kioskReturnTimer) {
      clearInterval(this.kioskReturnTimer);
    }
  }

  /** FR4a: countdown then end the kiosk session (attract screen returns). */
  private startKioskAutoReturn(): void {
    if (!this.kioskMode.active() || this.kioskReturnTimer) {
      return;
    }
    const totalMs =
      Number((window as any).__KIOSK_CONFIRM_MS__) > 0
        ? Number((window as any).__KIOSK_CONFIRM_MS__)
        : 12_000;
    this.kioskReturnSeconds.set(Math.ceil(totalMs / 1000));
    this.kioskReturnTimer = setInterval(() => {
      const next = this.kioskReturnSeconds() - 1;
      this.kioskReturnSeconds.set(next);
      if (next <= 0) {
        this.finishKioskOrder();
      }
    }, 1000);
  }

  shortNumber(orderNumber?: string): string {
    return orderNumber ? shortOrderNumber(orderNumber) : '';
  }

  finishKioskOrder(): void {
    if (this.kioskReturnTimer) {
      clearInterval(this.kioskReturnTimer);
      this.kioskReturnTimer = undefined;
    }
    this.kioskMode.endSession();
    this.vendorNavigation.navigateWithVendor('promotional-banner');
  }

  private startOrderStatusRefresh() {
    if (!this.orderId) {
      console.log('No order ID available for status refresh');
      return;
    }

    // Start auto-refresh with 10-second interval
    this.autoRefreshSubscription = interval(10000).subscribe(() => {
      console.log('Auto-refreshing order status...');
      // Refreshes the order and, when active, the delivery info in one call
      this.refreshOrderStatus();
    });
  }

  private async refreshOrderStatus() {
    if (!this.orderId) return;

    try {
      // One status call returns both the order and its delivery row
      const { order: updatedOrder, delivery } =
        await this.ordersService.getOrderStatusPublic(this.orderId);

      if (delivery && this.deliveryRefreshActive) {
        this.deliveryInfo = delivery;
        this.updateEtaRemaining();
        const st = String(delivery.status || '').toLowerCase();
        if (st === 'delivered' || st === 'cancelled') {
          this.deliveryRefreshActive = false;
        }
      }

      if (updatedOrder) {
        console.log('Order status updated:', updatedOrder.status);
        this.orderDetails = updatedOrder;

        // If order has been picked up or refused, stop refreshing
        if (
          updatedOrder.status === 'picked' ||
          updatedOrder.status === 'refused'
        ) {
          console.log('Order completed/refused, stopping auto-refresh');
          if (this.autoRefreshSubscription) {
            this.autoRefreshSubscription.unsubscribe();
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing order status:', error);
      // Continue refreshing even if there's an error
    }
  }

  private async loadDeliveryInfo(orderId: string) {
    try {
      const { delivery } = await this.ordersService.getOrderStatusPublic(
        orderId
      );
      this.deliveryInfo = delivery || undefined;
      this.updateEtaRemaining();
      // Enable delivery refresh loop when we have delivery data
      this.deliveryRefreshActive = !!delivery;
    } catch (e) {
      console.error('Failed to load delivery info:', e);
    }
  }

  private updateEtaRemaining() {
    const eta = Number(this.deliveryInfo?.eta_minutes);
    const updatedAtIso = this.deliveryInfo?.updated_at as string | undefined;
    if (!isFinite(eta) || eta <= 0 || !updatedAtIso) {
      this.etaRemainingMinutes = undefined;
      return;
    }
    const updatedAt = new Date(updatedAtIso);
    const elapsedMs = Date.now() - updatedAt.getTime();
    const elapsedMin = Math.floor(elapsedMs / 60000);
    const remaining = Math.max(0, eta - elapsedMin);
    this.etaRemainingMinutes = remaining;
  }

  private async processSuccessfulPayment() {
    try {
      // Get payment IDs from URL
      const poId = this.route.snapshot.queryParamMap.get('po_id'); // PayGreen
      const sessionId = this.route.snapshot.queryParamMap.get('session_id'); // Stripe
      const status = this.route.snapshot.queryParamMap.get('status');

      console.log(
        'Payment callback - PayGreen ID:',
        poId,
        'Stripe Session:',
        sessionId,
        'Status:',
        status
      );

      // Server-side confirmation: the confirm-payment edge function verifies
      // the payment with the provider, flips the order to 'paid', records the
      // payment row, advances the delivery status and claims the confirmation
      // email flag. The order tables carry no anon RLS policies anymore, so
      // none of this can be done from the browser.
      let result: Awaited<
        ReturnType<OrdersService['confirmPayment']>
      > = null;

      if (poId) {
        // PayGreen redirects back with ?status=
        if (status !== 'authorized' && status !== 'succeeded') {
          console.error('PayGreen payment was not successful:', status);
          this.paymentDetailsError = true;
          return;
        }

        const currentVendor = this.vendorService.getCurrentVendor();
        if (!currentVendor) {
          console.error('No vendor available for PayGreen payment details');
          throw new Error('Vendor context missing for payment verification');
        }

        result = await this.ordersService.confirmPayment({
          provider: 'paygreen',
          poId,
          vendorId: currentVendor.id,
          apiUrl: this.paygreenConfig.getApiUrl(),
          isSandbox: this.paygreenConfig.useSandboxCredentials(),
        });
      } else if (sessionId) {
        result = await this.ordersService.confirmPayment({
          provider: 'stripe',
          sessionId,
        });
      }

      if (!result?.order) {
        console.error('Payment confirmation failed');
        this.paymentDetailsError = true;
        return;
      }

      const order = result.order;
      this.orderId = order.id;
      this.orderDetails = order;
      this.orderNumber = order.orderNumber;
      this.startKioskAutoReturn();
      this.paymentDetails = result.payment;

      // Send confirmation email; the server already claimed the sent flag,
      // so a reloaded success page will not send a duplicate.
      await this.sendConfirmationEmail(order, result.emailAlreadySent);

      // Clear the cart after successful order confirmation
      this.store.dispatch(clearCart());

      // Clear dining preference
      this.diningPreferenceService.resetPreference();

      // Start auto-refresh after successfully loading order
      this.startOrderStatusRefresh();

      // If delivery order, show delivery info
      if (order.orderType === 'delivery') {
        if (result.delivery) {
          this.deliveryInfo = result.delivery;
          this.updateEtaRemaining();
          this.deliveryRefreshActive = true;
        } else {
          await this.loadDeliveryInfo(order.id);
        }
      }
    } catch (error) {
      console.error('Error processing payment success:', error);
      this.paymentDetailsError = true;
    } finally {
      this.isProcessing = false;
    }
  }

  navigateHome() {
    this.vendorNavigation.navigateWithVendor(['promotional-banner', 'products']);
  }

  getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      initiated: 'En attente de validation',
      paid: 'Payée',
      refused: 'Refusée',
      todo: 'Confirmée',
      'in-progress': 'En préparation',
      ongoing: 'En préparation',
      ready: 'Prête',
      done: 'Prête',
      completed: 'Terminée',
      picked: 'Récupérée',
      cancelled: 'Annulée',
    };
    return statusMap[status] || status;
  }

  getOrderTypeText(orderType: string): string {
    const typeMap: { [key: string]: string } = {
      'eat-in': 'Sur place',
      'take-away': 'À emporter',
      delivery: 'Livraison',
    };
    return typeMap[orderType] || orderType;
  }

  getTimingText(timing: string): string {
    const timingMap: { [key: string]: string } = {
      asap: 'Dès que possible',
      later: 'Plus tard',
    };
    return timingMap[timing] || timing;
  }

  getPaymentMethodText(): string {
    if (!this.paymentDetails) return 'Non spécifié';

    if (this.paymentDetails.platforms?.length) {
      const platform = this.paymentDetails.platforms[0];
      const platformMap: { [key: string]: string } = {
        paygreen: 'PayGreen',
        stripe: 'Stripe',
        apple_pay: 'Apple Pay',
        google_pay: 'Google Pay',
        bank_card: 'Carte bancaire',
        conecs: 'Conecs',
        restoflash: 'Restoflash',
        swile: 'Swile',
      };
      return platformMap[platform] || platform;
    }

    return 'Carte bancaire';
  }

  getDeliveryStatusText(status: string | null | undefined): string {
    const s = String(status || '').toLowerCase();
    const map: Record<string, string> = {
      created: 'Créée',
      assigning: "Recherche d'un coursier",
      assigned: 'Coursier assigné',
      picking: 'Récupération en cours',
      picked: 'Récupérée',
      delivering: 'En cours de livraison',
      delivered: 'Livrée',
      cancelled: 'Annulée',
    };
    return map[s] || status || '—';
  }

  getSafeTrackingUrl(): SafeResourceUrl | null {
    if (!this.deliveryInfo?.tracking_url) {
      return null;
    }

    // Sanitize the URL to prevent XSS attacks
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      this.deliveryInfo.tracking_url
    );
  }


  private async sendConfirmationEmail(order: Order, emailAlreadySent: boolean) {
    try {
      // The confirm-payment function reports and claims the sent flag
      if (emailAlreadySent) {
        console.log(
          'Confirmation email already sent for order:',
          order.orderNumber
        );
        return;
      }

      console.log('Sending confirmation email for order:', order.orderNumber);

      // Prefer the resolved vendor context (works for both /vendor/:slug and custom domains)
      const currentVendor = this.vendorService.getCurrentVendor();
      const vendorSlug = currentVendor
        ? this.vendorService.getVendorSlug(currentVendor)
        : undefined;

      // Generate tracking URL
      const trackingUrl = this.emailService.generateTrackingUrl(
        order.id,
        vendorSlug
      );

      // Send confirmation email
      const emailResult = await this.emailService.sendOrderConfirmationEmail(
        order,
        trackingUrl
      );

      if (emailResult.success) {
        console.log('Order confirmation email sent successfully');
      } else {
        console.error('Failed to send confirmation email:', emailResult.error);
      }
    } catch (error) {
      console.error('Error sending confirmation email:', error);
      // Don't throw - email failure shouldn't break the order flow
    }
  }

  private async loadOrderFromTrackingLink(orderId: string) {
    try {
      this.isProcessing = true;

      // Load order details
      const order = await this.ordersService.getOrderById(orderId);

      if (order) {
        this.orderDetails = order;
        this.orderNumber = order.orderNumber;
        this.orderId = orderId;
        this.startKioskAutoReturn();

        // Start auto-refresh for order status
        this.startOrderStatusRefresh();

        // If delivery order, load delivery info
        if (order.orderType === 'delivery') {
          await this.loadDeliveryInfo(orderId);
        }

        console.log('Order loaded from tracking link:', order);
      } else {
        console.error('Order not found:', orderId);
      }
    } catch (error) {
      console.error('Error loading order from tracking link:', error);
    } finally {
      this.isProcessing = false;
    }
  }
}
