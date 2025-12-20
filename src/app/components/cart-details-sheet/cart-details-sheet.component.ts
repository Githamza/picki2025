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
import { VendorService } from '../../services/vendor.service';
import { DeliverySelectionService } from '../../services/delivery/delivery-selection.service';
import { clearCart } from '../../store/actions/cart.actions';
import { VendorCurrencyPipe } from '../../shared/pipes/vendor-currency.pipe';

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
    VendorCurrencyPipe,
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
        <div
          matListItemLine
          [style.visibility]="getItemPrice(item) > 0 ? 'visible' : 'hidden'"
        >
          Prix: {{ getItemPrice(item) | vendorCurrency }}
        </div>
        <!-- Multi-step product details -->
        <div matListItemLine *ngIf="item.metadata?.stepSelections?.length" class="multi-step-details">
          <div *ngFor="let step of item.metadata.stepSelections" class="step-detail">
            <span class="step-name">{{ step.stepName }}:</span>
            <span *ngFor="let option of step.selectedOptions; let last = last" class="option-name">
              {{ option.optionName }}<span *ngIf="!last">, </span>
            </span>
          </div>
        </div>
        <div matListItemLine *ngIf="item.comment" class="item-comment">
          <mat-icon>comment</mat-icon>
          {{ item.comment }}
        </div>
      </mat-list-item>
      <mat-divider></mat-divider>
      <div class="total-row">
        <span>Total:</span>
        <span class="total-price">{{ getTotal(items) | vendorCurrency }}</span>
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
      .item-comment {
        display: flex;
        align-items: center;
        gap: 4px;
        font-style: italic;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.9em;
      }
      .item-comment mat-icon {
        font-size: 16px;
        height: 16px;
        width: 16px;
      }
      .multi-step-details {
        margin-top: 8px;
        padding-left: 8px;
        border-left: 2px solid var(--mat-sys-primary);
      }
      .step-detail {
        margin-bottom: 4px;
        font-size: 0.85em;
        color: var(--mat-sys-on-surface-variant);
      }
      .step-name {
        font-weight: 500;
        color: var(--mat-sys-primary);
      }
      .option-name {
        color: var(--mat-sys-on-surface);
      }
      /* delivery-summary removed: delivery fee is shown as a cart item */
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
  private vendorService = inject(VendorService);
  readonly deliverySelection = inject(DeliverySelectionService);

  constructor(private store: Store<AppState>) {
    this.cartItems$ = this.store.select(selectCartItems);
  }

  getTotal(items: CartItem[]): number {
    return items.reduce((sum, item) => {
      // Use stored totalPrice for multi-step products, otherwise calculate normally
      const itemTotal = item.totalPrice || item.product.price * item.quantity;
      return sum + itemTotal;
    }, 0);
  }

  getItemPrice(item: CartItem): number {
    // Use stored totalPrice for multi-step products, otherwise use product price
    return item.totalPrice || item.product.price;
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
      const currentVendor = this.vendorService.getCurrentVendor();
      const onlinePaymentsEnabled =
        currentVendor?.online_payments_enabled ?? true;
      const payAtCheckout = !onlinePaymentsEnabled;

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
        // Parse time string in HH:MM format
        const [hours, minutes] = scheduledTime.split(':').map(Number);
        scheduledDateTime.setHours(hours, minutes, 0, 0);
      }

      // Generate order number
      const orderNumber = this.generateOrderNumber();

      // Create order items
      const orderItems: OrderItem[] = items.map((item) => {
        // For multi-step products, use the calculated totalPrice instead of base product price
        const itemPrice = item.totalPrice || item.product.price;
        
        // Store multi-step metadata in options field
        const options = item.metadata ? 
          [item.metadata] : // Store CartMultiStepMetadata
          item.selectedComplements || []; // Store complements if available

        return {
          productId: item.product.id.toString(),
          productName: item.product.name,
          quantity: item.quantity,
          price: itemPrice, // Use calculated price for multi-step products
          options: options, // Store multi-step metadata or complements
          vendorId: item.product.vendorId,
          comment: item.comment,
        };
      });

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
        status: payAtCheckout ? 'todo' : 'initiated',
        orderType: diningPref as any,
        timing: timing as any,
        payAtCheckout,
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

      // 2. Persist delivery selection for later creation on acceptance
      try {
        const isDeliveryMode =
          this.diningPreferenceService.diningPreference() === 'delivery';
        const bestOption = this.deliverySelection.bestOption();
        if (isDeliveryMode) {
          const vendorInfo = await this.vendorService
            .getRestaurantInfo()
            .toPromise();
          const pickup = vendorInfo
            ? {
                line1: vendorInfo.address.street,
                postal_code: vendorInfo.address.postal_code,
                city: vendorInfo.address.city,
                country_code: 'FR',
                lat: undefined,
                lng: undefined,
              }
            : {
                line1: '83 Bis Rue Du Commerce',
                postal_code: '37000',
                city: 'Tours',
                country_code: 'FR',
                lat: undefined,
                lng: undefined,
              };
          const dropoff = this.deliverySelection.selectedAddress();
          if (dropoff) {
            // Persist delivery coordinates even when no quote is available
            const fallbackBest = {
              providerId: 'internal',
              providerName: 'Internal',
              totalAmount: 0,
              currency: this.vendorService.getCurrentCurrency() as any,
              serviceLevel: 'instant' as const,
            };
            await this.ordersService.saveOrderDeliverySelection({
              orderId: createdOrder.id,
              best: bestOption ?? (fallbackBest as any),
              pickup,
              dropoff,
            });
          }
        }
      } catch (e) {
        console.warn('Failed to persist delivery selection (sheet):', e);
      }

      // Offline payment flow: order is created and paid at checkout/pickup.
      if (payAtCheckout) {
        this.store.dispatch(clearCart());
        this.diningPreferenceService.resetPreference();

        const successBaseUrl = this.vendorNavigation.getVendorUrl('successPayment');
        const url = `${successBaseUrl}?orderId=${encodeURIComponent(createdOrder.id)}`;
        this.snackBar.open(
          'Commande enregistrée. Paiement à effectuer au retrait.',
          'OK',
          { duration: 5000 }
        );
        this.router.navigateByUrl(url);
        return;
      }

      // 3. Now create payment with order reference
      // Build return URLs with vendor context
      const baseUrl = window.location.origin;
      const vendorSlug = this.vendorNavigation.getVendorSlug();
      const returnUrl = vendorSlug
        ? `${baseUrl}/${vendorSlug}/successPayment`
        : `${baseUrl}/successPayment`;
      const cancelUrl = vendorSlug
        ? `${baseUrl}/${vendorSlug}/failedPayment`
        : `${baseUrl}/failedPayment`;

      // Get current vendor for payment
      if (!currentVendor) {
        throw new Error('No vendor selected for payment');
      }

      // Prepare payment items (delivery fee is already stored as a cart item when applicable)
      const paymentItems = items.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.price,
      }));

      const bestOption = this.deliverySelection.bestOption();

      // Create unified payment request with order reference
      const paymentRequest: PaymentRequest = {
        amount: totalAmount,
        currency: this.vendorService.getCurrentCurrency(),
        vendorId: currentVendor.id, // Add vendor ID for secure payment processing
        buyer: {
          email: userInfo.email,
          firstName: userInfo.prenom,
          lastName: userInfo.nom,
          phone: userInfo.phone,
        },
        items: paymentItems,
        returnUrl,
        cancelUrl,
        reference: createdOrder.id, // Pass the created order ID as reference
        metadata: {
          orderId: createdOrder.id,
          orderNumber: createdOrder.orderNumber,
          diningPreference: diningPref,
          orderSource: 'cart-sheet',
          delivery: bestOption
            ? {
                providerId: bestOption.providerId,
                providerName: bestOption.providerName,
                amountMinor: bestOption.totalAmount,
                currency: bestOption.currency,
                etaMinutes: bestOption.etaMinutes ?? null,
              }
            : null,
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
