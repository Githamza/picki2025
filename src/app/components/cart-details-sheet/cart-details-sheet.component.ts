import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import {
  MatBottomSheetRef,
  MatBottomSheetModule,
} from '@angular/material/bottom-sheet';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog } from '@angular/material/dialog';
import { selectCartItems } from '../../store/selectors/cart.selectors';
import { CartItem, AppState } from '../../store/models/app.state';
import { Router } from '@angular/router';
import { DiningPreferenceService } from '../../services/dining-preference.service';
import { PaymentService } from '../../services/payment.service';
import { PaymentRequest } from '../../services/payment-strategy.interface';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  UserInfoDialogComponent,
  UserInfo,
} from '../user-info-dialog/user-info-dialog.component';
import { OrdersService } from '../../services/orders.service';
import { Order, OrderItem } from '../../models/order.model';
import { RestaurantStatusService } from '../../services/restaurant-status.service';
import { VendorNavigationService } from '../../services/vendor-navigation.service';

@Component({
  selector: 'app-cart-details-sheet',
  standalone: true,
  imports: [
    CommonModule,
    MatBottomSheetModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
  ],
  template: `
    <button
      *ngIf="!isOnCartDetailsPage()"
      mat-icon-button
      class="close-btn"
      aria-label="Fermer"
      (click)="close()"
    >
      <mat-icon>close</mat-icon>
    </button>
    <h2 class="sheet-title">Mon panier</h2>

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

    <mat-list *ngIf="cartItems$ | async as items; else empty">
      <mat-list-item *ngFor="let item of items">
        <mat-icon matListItemIcon>shopping_bag</mat-icon>
        <div matListItemTitle>{{ item.product.name }}</div>
        <div matListItemLine>Quantité: {{ item.quantity }}</div>
        <div matListItemLine>
          Prix: {{ item.product.price | number : '1.2-2' }} €
        </div>
      </mat-list-item>
      <mat-divider></mat-divider>
      <div class="total-row">
        <span>Total:</span>
        <span class="total-price"
          >{{ getTotal(items) | number : '1.2-2' }} €</span
        >
      </div>
    </mat-list>
    <ng-template #empty>
      <div class="empty-cart">Votre panier est vide.</div>
    </ng-template>
    <button
      mat-stroked-button
      color="primary"
      class="checkout-btn"
      (click)="goToCartDetails()"
    >
      Modifier mon panier
    </button>
    <button
      mat-flat-button
      color="accent"
      class="checkout-btn checkout-btn-validate"
      (click)="checkout()"
    >
      Valider ma commande
    </button>
  `,
  styles: [
    `
      .close-btn {
        position: absolute;
        top: 12px;
        right: 12px;
        z-index: 10;
        background: var(--mat-sys-surface, #fff);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }
      .sheet-title {
        margin: 0 0 16px 0;
        font-size: 1.3rem;
        font-weight: 600;
        text-align: center;
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
      .total-row {
        display: flex;
        justify-content: space-between;
        font-weight: bold;
        margin: 16px 0 0 0;
        font-size: 1.1em;
      }
      .total-price {
        color: var(--mat-primary);
      }
      .empty-cart {
        text-align: center;
        color: #888;
        margin: 24px 0;
      }
      .checkout-btn {
        width: 100%;
        margin-top: 16px;
      }
      .checkout-btn-validate {
        font-weight: bold;
        margin-top: 8px;
      }
    `,
  ],
})
export class CartDetailsSheetComponent {
  cartItems$: Observable<CartItem[]>;
  readonly diningPreferenceService = inject(DiningPreferenceService);
  private router = inject(Router);
  private vendorNavigation = inject(VendorNavigationService);
  private paymentService = inject(PaymentService);
  private snackBar = inject(MatSnackBar);
  private bottomSheetRef = inject(MatBottomSheetRef<CartDetailsSheetComponent>);
  private dialog = inject(MatDialog);
  private ordersService = inject(OrdersService);
  private restaurantStatusService = inject(RestaurantStatusService);

  constructor(private store: Store<AppState>) {
    this.cartItems$ = this.store.select(selectCartItems);
  }

  getTotal(items: CartItem[]): number {
    return items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
  }

  goToCartDetails() {
    this.close();
    this.vendorNavigation.navigateWithVendor('cartdetails');
  }

  close() {
    this.bottomSheetRef.dismiss();
  }

  isOnCartDetailsPage(): boolean {
    const currentUrl = this.router.url;
    const vendorSlug = this.vendorNavigation.getVendorSlug();
    return vendorSlug
      ? currentUrl.includes(`/${vendorSlug}/cartdetails`)
      : currentUrl.startsWith('/cartdetails');
  }

  async checkout() {
    // First check if restaurant is open
    const isOpen = await this.restaurantStatusService.validateRestaurantOpen();

    if (!isOpen) {
      // Restaurant is closed, dialog was shown by the service
      return;
    }

    // Restaurant is open, proceed with normal checkout
    // Subscribe to cart items to get the current state
    this.cartItems$.pipe(take(1)).subscribe((items) => {
      if (items.length === 0) {
        this.snackBar.open('Votre panier est vide', 'Fermer', {
          duration: 3000,
        });
        return;
      }

      // Check if dining preference is selected
      if (!this.diningPreferenceService.hasSelectedPreference()) {
        this.snackBar.open(
          'Veuillez choisir votre préférence de restauration',
          'Fermer',
          { duration: 3000 }
        );
        this.bottomSheetRef.dismiss();
        this.vendorNavigation.navigateWithVendor('dining-preference');
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
        }
        // If userInfo is null/undefined, user cancelled the dialog
      });
    });
  }

  private async processPayment(items: CartItem[], userInfo: UserInfo) {
    const totalAmount = this.getTotal(items);
    const currentProvider = this.paymentService.getCurrentProvider();

    // Close the sheet before processing payment
    this.close();

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
          orderSource: 'cart-sheet',
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

  changeDiningPreference(): void {
    this.close();
    // Navigate to the dining preference route with vendor context
    this.vendorNavigation.navigateWithVendor('dining-preference');
  }
}
