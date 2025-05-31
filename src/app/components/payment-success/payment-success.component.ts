import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Store } from '@ngrx/store';
import { AppState, CartItem } from '../../store/models/app.state';
import { clearCart } from '../../store/actions/cart.actions';
import { selectCartItems } from '../../store/selectors/cart.selectors';
import { OrdersService } from '../../services/orders.service';
import { Order, OrderItem } from '../../models/order.model';
import { DiningPreferenceService } from '../../services/dining-preference.service';
import { SupabaseService } from '../../services/supabase.service';
import { PaymentService } from '../../services/payment.service';
import { take, firstValueFrom, interval, Subscription } from 'rxjs';
import { VendorNavigationService } from '../../services/vendor-navigation.service';

@Component({
  selector: 'app-payment-success',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="payment-container">
      <mat-card class="payment-card">
        <mat-card-content>
          <div *ngIf="!isProcessing; else processing">
            <div class="success-icon">
              <mat-icon class="success-icon-svg">check_circle</mat-icon>
            </div>
            <h1>Paiement réussi !</h1>
            <p class="success-message">
              Votre commande a été confirmée avec succès.
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
                        item.price * item.quantity
                          | currency : 'EUR' : 'symbol' : '1.2-2' : 'fr-FR'
                      }}
                    </div>
                  </div>
                </div>

                <div class="total">
                  <strong
                    >Total:
                    {{
                      orderDetails.totalAmount
                        | currency : 'EUR' : 'symbol' : '1.2-2' : 'fr-FR'
                    }}</strong
                  >
                </div>
              </div>

              <!-- Payment Information -->
              <div class="payment-info" *ngIf="paymentDetails">
                <h3>Informations de paiement</h3>
                <p><strong>Méthode:</strong> {{ getPaymentMethodText() }}</p>
                <p>
                  <strong>Montant:</strong>
                  {{
                    paymentDetails.amount
                      | currency : 'EUR' : 'symbol' : '1.2-2' : 'fr-FR'
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
            </div>

            <!-- Fallback order number display -->
            <p class="order-info" *ngIf="orderNumber && !orderDetails">
              Numéro de commande: <strong>{{ orderNumber }}</strong>
            </p>

            <p class="order-info">
              Un email de confirmation vous a été envoyé.
            </p>

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
      .order-notes {
        margin: 20px 0;
        padding: 15px;
        background-color: #fff;
        border-radius: 6px;
        border-left: 4px solid #4caf50;
      }

      .customer-info h3,
      .order-items h3,
      .payment-info h3,
      .order-notes h3 {
        color: #333;
        margin: 0 0 15px 0;
        font-size: 18px;
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
      }
    `,
  ],
})
export class PaymentSuccessComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private store = inject(Store<AppState>);
  private ordersService = inject(OrdersService);
  private diningPreferenceService = inject(DiningPreferenceService);
  private supabaseService = inject(SupabaseService);
  private paymentService = inject(PaymentService);
  private vendorNavigation = inject(VendorNavigationService);

  isProcessing = true;
  orderNumber?: string;
  orderDetails?: Order;
  paymentDetails?: any;

  // Auto-refresh subscription
  private autoRefreshSubscription?: Subscription;
  private orderId?: string;

  ngOnInit() {
    this.processSuccessfulPayment();
  }

  ngOnDestroy() {
    // Clean up the auto-refresh subscription
    if (this.autoRefreshSubscription) {
      this.autoRefreshSubscription.unsubscribe();
    }
  }

  private startOrderStatusRefresh() {
    if (!this.orderId) {
      console.log('No order ID available for status refresh');
      return;
    }

    // Start auto-refresh with 10-second interval
    this.autoRefreshSubscription = interval(10000).subscribe(() => {
      console.log('Auto-refreshing order status...');
      this.refreshOrderStatus();
    });
  }

  private async refreshOrderStatus() {
    if (!this.orderId) return;

    try {
      // Fetch the latest order details
      const updatedOrder = await this.ordersService.getOrderById(this.orderId);

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

      // Check if payment was successful
      if (status !== 'authorized' && status !== 'succeeded') {
        console.error('Payment was not successful:', status);
        this.isProcessing = false;
        return;
      }

      let paymentDetails: any = null;
      let paymentProvider = '';
      let paymentId = '';
      let orderId = '';

      // Retrieve payment details from the payment provider
      try {
        if (poId) {
          paymentProvider = 'paygreen';
          paymentId = poId;
          paymentDetails = await firstValueFrom(
            this.paymentService.getPayGreenPayment(poId)
          );
          console.log('PayGreen payment details:', paymentDetails);

          // Store payment details for template
          this.paymentDetails = paymentDetails;

          // Get order ID from payment reference
          orderId =
            paymentDetails.metadata?.reference || paymentDetails.reference;
        } else if (sessionId) {
          paymentProvider = 'stripe';
          paymentId = sessionId;
          paymentDetails = await firstValueFrom(
            this.paymentService.getStripeSession(sessionId)
          );
          console.log('Stripe payment details:', paymentDetails);

          // Store payment details for template
          this.paymentDetails = paymentDetails;

          // Get order ID from payment metadata
          orderId = paymentDetails.metadata?.orderId;
        }
      } catch (error) {
        console.error('Error retrieving payment details:', error);
      }

      if (orderId) {
        // Store the order ID for status updates
        this.orderId = orderId;

        // Retrieve the existing order using the reference
        try {
          const existingOrder = await this.ordersService.getOrderById(orderId);
          if (existingOrder) {
            console.log('Retrieved existing order:', existingOrder);

            // Store order details for template
            this.orderDetails = existingOrder;

            // Don't automatically update order status - let restaurant owner validate first
            // await this.ordersService.updateOrderStatus(orderId, 'todo');
            console.log(
              'Order retrieved - keeping status as initiated for restaurant validation'
            );

            // Keep the original order status for display
            // this.orderDetails.status = 'todo';

            // Set order number for display
            this.orderNumber = existingOrder.orderNumber;

            // Check if payment record already exists
            if (paymentDetails) {
              const existingPayment =
                await this.supabaseService.getPaymentByOrderId(orderId);

              if (!existingPayment) {
                const payment = await this.supabaseService.createPayment({
                  provider: paymentProvider as 'paygreen' | 'stripe',
                  provider_payment_id: paymentId,
                  amount: paymentDetails.amount,
                  currency: paymentDetails.currency,
                  status: 'pending',
                  order_id: orderId,
                  metadata: {
                    orderNumber: existingOrder.orderNumber,
                  },
                });
                console.log('Created payment record:', payment);
              } else {
                console.log('Payment record already exists:', existingPayment);
              }
            }

            // Clear the cart after successful order confirmation
            this.store.dispatch(clearCart());

            // Clear dining preference
            this.diningPreferenceService.resetPreference();

            // Start auto-refresh after successfully loading order
            this.startOrderStatusRefresh();

            return; // Exit successfully
          }
        } catch (error) {
          console.error('Error retrieving order by ID:', error);
        }
      }

      // Fallback to the old flow if no order reference found
      console.log(
        'No order reference found, falling back to cart data creation'
      );
      await this.fallbackOrderCreation(
        paymentDetails,
        paymentProvider,
        paymentId
      );
    } catch (error) {
      console.error('Error processing payment success:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async fallbackOrderCreation(
    paymentDetails: any,
    paymentProvider: string,
    paymentId: string
  ) {
    // Generate order number
    this.orderNumber = this.generateOrderNumber();

    if (paymentDetails && paymentDetails.metadata) {
      // Create order from payment metadata
      const metadata = paymentDetails.metadata;

      // Create order items from payment metadata
      const orderItems: OrderItem[] =
        metadata.orderItems?.map((item: any) => ({
          productId: item.productId,
          productName: item.name,
          quantity: item.quantity,
          price: item.price,
          options: item.options || [],
        })) || [];

      // Calculate scheduled time if needed
      let scheduledDateTime: Date | undefined;
      if (
        metadata.timing === 'later' &&
        metadata.scheduledDate &&
        metadata.scheduledTime
      ) {
        scheduledDateTime = new Date(metadata.scheduledDate);
        const time = new Date(metadata.scheduledTime);
        scheduledDateTime.setHours(time.getHours(), time.getMinutes(), 0, 0);
      }

      // Create order object
      const order: Order = {
        id: '', // Will be generated by database
        orderNumber: this.orderNumber,
        customer: {
          firstName: metadata.customerFirstName || 'Guest',
          lastName: metadata.customerLastName || 'User',
          email: paymentDetails.customerEmail || 'guest@example.com',
          phone: metadata.customerPhone || '',
        },
        items: orderItems,
        totalAmount: paymentDetails.amount,
        status: 'initiated',
        orderType: metadata.diningPreference || 'take-away',
        timing: metadata.timing || 'asap',
        scheduledTime: scheduledDateTime,
        tableNumber: metadata.tableNumber,
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: metadata.notes || '',
      };

      console.log('Order to be created from payment data:', order);

      // Save order to database
      const createdOrder = await this.ordersService.addOrder(order);
      console.log('Created order:', createdOrder);

      // Store order details for template
      if (createdOrder) {
        this.orderDetails = createdOrder;
      }

      // Create payment record
      if (createdOrder) {
        const payment = await this.supabaseService.createPayment({
          provider: paymentProvider as 'paygreen' | 'stripe',
          provider_payment_id: paymentId,
          amount: paymentDetails.amount,
          currency: paymentDetails.currency,
          status: 'completed',
          order_id: createdOrder.id,
          metadata: {
            orderNumber: this.orderNumber,
          },
        });
        console.log('Created payment record:', payment);
      }
    } else {
      // Fallback to cart data if payment details are not available
      console.log('No payment details available, falling back to cart data');

      const cartItems = await new Promise<CartItem[]>((resolve) => {
        this.store
          .select(selectCartItems)
          .pipe(take(1))
          .subscribe((items) => resolve(items));
      });

      if (cartItems.length > 0) {
        // Get dining preference
        const diningPrefData =
          this.diningPreferenceService.diningPreferenceData();
        const diningPref = diningPrefData?.preference || 'take-away';
        const timing = diningPrefData?.timing || 'asap';
        const scheduledDate = diningPrefData?.scheduledDate;
        const scheduledTime = diningPrefData?.scheduledTime;

        console.log('Dining preference data:', diningPrefData);

        // Calculate scheduled time if needed
        let scheduledDateTime: Date | undefined;
        if (timing === 'later' && scheduledDate && scheduledTime) {
          scheduledDateTime = new Date(scheduledDate);
          scheduledDateTime.setHours(
            scheduledTime.getHours(),
            scheduledTime.getMinutes(),
            0,
            0
          );
        }

        // Create order items
        const orderItems: OrderItem[] = cartItems.map((item) => ({
          productId: item.product.id.toString(),
          productName: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
          options: [],
        }));

        // Calculate total
        const totalAmount = cartItems.reduce(
          (sum, item) => sum + item.product.price * item.quantity,
          0
        );

        // Create order object
        const order: Order = {
          id: '', // Will be generated by database
          orderNumber: this.orderNumber,
          customer: {
            firstName: 'Guest',
            lastName: 'User',
            email: 'guest@example.com',
            phone: '',
          },
          items: orderItems,
          totalAmount,
          status: 'todo',
          orderType: diningPref as any,
          timing: timing as any,
          scheduledTime: scheduledDateTime,
          tableNumber: diningPref === 'eat-in' ? '1' : undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
          notes: '',
        };

        console.log('Order to be created from cart:', order);

        // Save order to database
        const createdOrder = await this.ordersService.addOrder(order);
        console.log('Created order:', createdOrder);

        // Store order details for template
        if (createdOrder) {
          this.orderDetails = createdOrder;
        }

        // Create payment record
        if (paymentId && createdOrder) {
          const payment = await this.supabaseService.createPayment({
            provider: paymentProvider as 'paygreen' | 'stripe',
            provider_payment_id: paymentId,
            amount: totalAmount,
            currency: 'EUR',
            status: 'completed',
            order_id: createdOrder.id,
            metadata: {
              orderNumber: this.orderNumber,
            },
          });
          console.log('Created payment:', payment);
        }
      } else {
        console.log('No cart items found and no payment data available');
      }
    }

    // Clear the cart after successful order creation
    this.store.dispatch(clearCart());

    // Clear dining preference
    this.diningPreferenceService.resetPreference();
  }

  private generateOrderNumber(): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `${year}${month}${day}-${random}`;
  }

  navigateHome() {
    this.vendorNavigation.navigateWithVendor('products');
  }

  getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      initiated: 'En attente de validation',
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
}
