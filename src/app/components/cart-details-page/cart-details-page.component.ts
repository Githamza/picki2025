import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Observable, firstValueFrom } from 'rxjs';
import { Store } from '@ngrx/store';
import { Location } from '@angular/common';
import { PaymentService } from '../../services/payment.service';
import { OrdersService } from '../../services/orders.service';
import { Order, OrderItem } from '../../models/order.model';
import { RestaurantStatusService } from '../../services/restaurant-status.service';
import { DiningPreferenceService } from '../../services/dining-preference.service';
import { PaymentRequest } from '../../services/payment-strategy.interface';
import {
  UserInfoDialogComponent,
  UserInfo,
} from '../user-info-dialog/user-info-dialog.component';
import { AppState, CartItem } from '../../store/models/app.state';
import { selectCartItems } from '../../store/selectors/cart.selectors';
import {
  decrementCartItem,
  incrementCartItem,
  removeCartItem,
} from '../../store/actions/cart.actions';
import { VendorNavigationService } from '../../services/vendor-navigation.service';

@Component({
  selector: 'app-cart-details-page',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatSnackBarModule],
  template: `
    <button
      mat-icon-button
      class="close-btn"
      aria-label="Fermer"
      (click)="goBack()"
    >
      <mat-icon>close</mat-icon>
    </button>
    <div class="cart-details-page">
      <h2>Mon panier</h2>

      <!-- Dining Preference Display -->
      <div
        class="dining-preference-info"
        *ngIf="diningPreferenceService.hasSelectedPreference()"
      >
        <button
          mat-button
          class="dining-preference-button"
          (click)="changeDiningPreference()"
          aria-label="Changer la préférence de restauration"
        >
          <mat-icon class="preference-icon">
            {{
              diningPreferenceService.diningPreference() === 'eat-in'
                ? 'restaurant'
                : 'takeout_dining'
            }}
          </mat-icon>
          <span class="preference-text">{{
            diningPreferenceService.getDiningPreferenceText()
          }}</span>
          <mat-icon class="change-icon" iconPositionEnd>edit</mat-icon>
        </button>
      </div>

      <div *ngIf="cartItems$ | async as items; else empty">
        <div *ngFor="let item of items" class="cart-item-row">
          <div class="cart-item-info">
            <span class="cart-item-name">{{ item.product.name }}</span>
            <span class="cart-item-price"
              >{{ item.product.price | number : '1.2-2' }} €</span
            >
          </div>
          <div class="cart-item-controls">
            <button
              mat-mini-fab
              color="primary"
              (click)="decrement(item.product.id)"
            >
              <mat-icon>remove</mat-icon>
            </button>
            <span class="cart-item-qty">{{ item.quantity }}</span>
            <button
              mat-mini-fab
              color="primary"
              (click)="increment(item.product.id)"
            >
              <mat-icon>add</mat-icon>
            </button>
            <button
              mat-icon-button
              color="warn"
              (click)="remove(item.product.id)"
            >
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </div>
        <div class="cart-total-row">
          <span>Total:</span>
          <span class="cart-total"
            >{{ getTotal(items) | number : '1.2-2' }} €</span
          >
        </div>

        <!-- Checkout Button -->
        <button
          mat-raised-button
          color="accent"
          class="checkout-button"
          (click)="checkout()"
          [disabled]="isCheckingOut"
        >
          <mat-icon>{{
            isCheckingOut ? 'hourglass_empty' : 'payment'
          }}</mat-icon>
          {{ isCheckingOut ? 'Vérification...' : 'Valider et payer' }}
        </button>
      </div>
      <ng-template #empty>
        <div class="empty-cart">Votre panier est vide.</div>
      </ng-template>
    </div>
  `,
  styles: [
    `
      .cart-details-page {
        max-width: 480px;
        margin: 32px auto;
        padding: 16px;
        background: var(--mat-sys-surface, #fff);
        border-radius: 12px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
        position: relative;
      }
      .close-btn {
        position: absolute;
        top: 16px;
        right: 16px;
        z-index: 10;
        background: var(--mat-sys-surface, #fff);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }
      .dining-preference-info {
        margin-bottom: 16px;
        text-align: center;
      }
      .dining-preference-button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        border-radius: 20px;
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
      }
      .preference-icon {
        margin: 0;
      }
      .preference-text {
        margin: 0;
      }
      .change-icon {
        margin: 0;
        opacity: 0.7;
      }
      .dining-preference-button:hover .change-icon {
        opacity: 1;
      }
      .cart-item-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid #eee;
      }
      .cart-item-info {
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .cart-item-name {
        font-weight: 500;
      }
      .cart-item-price {
        color: #888;
        font-size: 0.95em;
      }
      .cart-item-controls {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .cart-item-qty {
        min-width: 32px;
        text-align: center;
        font-weight: bold;
      }
      .cart-total-row {
        display: flex;
        justify-content: space-between;
        font-weight: bold;
        margin: 24px 0 0 0;
        font-size: 1.1em;
      }
      .cart-total {
        color: var(--mat-primary);
      }
      .empty-cart {
        text-align: center;
        color: #888;
        margin: 24px 0;
      }
      .checkout-button {
        width: 100%;
        margin-top: 24px;
        padding: 12px;
        font-size: 1.1rem;
        font-weight: 500;
      }
      .checkout-button:disabled {
        opacity: 0.6;
      }
    `,
  ],
})
export class CartDetailsPageComponent {
  cartItems$: Observable<CartItem[]>;
  protected diningPreferenceService = inject(DiningPreferenceService);
  private router = inject(Router);
  private vendorNavigation = inject(VendorNavigationService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private ordersService = inject(OrdersService);
  private paymentService = inject(PaymentService);
  private restaurantStatusService = inject(RestaurantStatusService);

  isCheckingOut = false;

  constructor(private store: Store<AppState>, private location: Location) {
    this.cartItems$ = this.store.select(selectCartItems);
  }

  goBack() {
    this.location.back();
  }

  increment(productId: number) {
    this.store.dispatch(incrementCartItem({ productId }));
  }

  decrement(productId: number) {
    this.store.dispatch(decrementCartItem({ productId }));
  }

  remove(productId: number) {
    this.store.dispatch(removeCartItem({ productId }));
  }

  getTotal(items: CartItem[]): number {
    return items.reduce(
      (total, item) => total + item.product.price * item.quantity,
      0
    );
  }

  changeDiningPreference(): void {
    // Navigate to the dining preference route with vendor context
    this.vendorNavigation.navigateWithVendor('dining-preference');
  }

  async checkout() {
    if (this.isCheckingOut) return;

    this.isCheckingOut = true;

    try {
      // First check if restaurant is open
      const isOpen =
        await this.restaurantStatusService.validateRestaurantOpen();

      if (!isOpen) {
        // Restaurant is closed, dialog was shown by the service
        this.isCheckingOut = false;
        return;
      }

      // Restaurant is open, proceed with normal checkout
      const items = await firstValueFrom(this.cartItems$);
      if (items.length === 0) {
        this.snackBar.open('Votre panier est vide', 'Fermer', {
          duration: 3000,
        });
        this.isCheckingOut = false;
        return;
      }

      // Check if dining preference is selected
      if (!this.diningPreferenceService.hasSelectedPreference()) {
        this.snackBar.open(
          'Veuillez choisir votre préférence de restauration',
          'Fermer',
          { duration: 3000 }
        );
        this.vendorNavigation.navigateWithVendor('dining-preference');
        this.isCheckingOut = false;
        return;
      }

      // Open user info dialog first
      const dialogRef = this.dialog.open(UserInfoDialogComponent, {
        width: '500px',
        maxWidth: '90vw',
        disableClose: true,
        autoFocus: true,
      });

      dialogRef.afterClosed().subscribe((userInfo: UserInfo) => {
        if (userInfo) {
          // User provided info, proceed with payment
          this.processPayment(items, userInfo);
        } else {
          // User cancelled the dialog
          this.isCheckingOut = false;
        }
      });
    } catch (error) {
      console.error('Error during checkout:', error);
      this.snackBar.open(
        'Erreur lors de la commande. Veuillez réessayer.',
        'Fermer',
        { duration: 5000 }
      );
      this.isCheckingOut = false;
    }
  }

  private async processPayment(items: CartItem[], userInfo: UserInfo) {
    const totalAmount = this.getTotal(items);
    const currentProvider = this.paymentService.getCurrentProvider();

    try {
      // 1. First create the order with "initiated" status
      const diningPrefData =
        this.diningPreferenceService.diningPreferenceData();
      const diningPref = diningPrefData?.preference || 'take-away';
      const timing = diningPrefData?.timing || 'asap';
      const scheduledDate = diningPrefData?.scheduledDate;
      const scheduledTime = diningPrefData?.scheduledTime;

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

      // Generate order number
      const orderNumber = this.generateOrderNumber();

      // Create order items
      const orderItems: OrderItem[] = items.map((item) => ({
        productId: item.product.id.toString(),
        productName: item.product.name,
        quantity: item.quantity,
        price: item.product.price,
        options: [],
      }));

      // Create order with "initiated" status
      const order: Order = {
        id: '', // Will be generated by database
        orderNumber,
        customer: {
          firstName: userInfo.prenom,
          lastName: userInfo.nom,
          email: userInfo.email,
          phone: userInfo.phone || '',
        },
        items: orderItems,
        totalAmount,
        status: 'initiated',
        orderType: diningPref as any,
        timing: timing as any,
        scheduledTime: scheduledDateTime,
        tableNumber: diningPref === 'eat-in' ? '1' : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: '',
      };

      console.log('Creating order:', order);

      // Save order to database
      const createdOrder = await this.ordersService.addOrder(order);
      console.log('Created order:', createdOrder);

      if (!createdOrder) {
        throw new Error('Failed to create order');
      }

      // 2. Now create payment with order reference
      // Build return URLs with vendor context
      const baseUrl = window.location.origin;
      const vendorSlug = this.vendorNavigation.getVendorSlug();
      const returnUrl = vendorSlug
        ? `${baseUrl}/${vendorSlug}/successPayment`
        : `${baseUrl}/successPayment`;
      const cancelUrl = vendorSlug
        ? `${baseUrl}/${vendorSlug}/failedPayment`
        : `${baseUrl}/failedPayment`;

      // Create unified payment request with order reference
      const paymentRequest: PaymentRequest = {
        amount: totalAmount,
        currency: 'EUR',
        buyer: {
          email: userInfo.email,
          firstName: userInfo.prenom,
          lastName: userInfo.nom,
          phone: userInfo.phone,
        },
        items: items.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
        })),
        returnUrl,
        cancelUrl,
        reference: createdOrder.id, // Pass the created order ID as reference
        metadata: {
          orderId: createdOrder.id,
          orderNumber: createdOrder.orderNumber,
          diningPreference: diningPref,
          orderSource: 'cart-page',
          userInfo: {
            nom: userInfo.nom,
            prenom: userInfo.prenom,
            email: userInfo.email,
            phone: userInfo.phone,
          },
        },
      };

      console.log(`Processing payment with ${currentProvider}...`);

      // Create payment using current strategy
      this.paymentService.createPayment(paymentRequest).subscribe({
        next: (response) => {
          console.log('Payment created:', response);

          if (response.url) {
            // Redirect to payment page (Stripe Checkout or PayGreen hosted)
            window.location.href = response.url;
          } else {
            // Handle other payment flows
            this.snackBar.open(
              `Paiement créé avec ${response.provider}! ID: ${response.id}`,
              'Fermer',
              { duration: 5000 }
            );
          }
        },
        error: (error) => {
          console.error('Payment error:', error);
          this.snackBar.open(
            `Erreur lors du paiement avec ${currentProvider}. Veuillez réessayer.`,
            'Fermer',
            { duration: 5000 }
          );
        },
      });
    } catch (error) {
      console.error('Error creating order:', error);
      this.snackBar.open(
        'Erreur lors de la création de la commande. Veuillez réessayer.',
        'Fermer',
        { duration: 5000 }
      );
    }
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
}
