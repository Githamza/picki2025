import { Component, inject, signal, effect, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { Observable, Subscription, firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import {
  MatBottomSheetRef,
  MatBottomSheetModule,
} from '@angular/material/bottom-sheet';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { CartContentComponent } from '../../shared/components/cart-content/cart-content.component';
import {
  selectCartItems,
  selectAppliedCoupon,
} from '../../store/selectors/cart.selectors';
import { CartItem, AppState } from '../../store/models/app.state';
import { Router } from '@angular/router';
import { DiningPreferenceService } from '../../services/dining-preference.service';
import { PaymentService } from '../../services/payment.service';
import { PaymentRequest } from '../../services/payment-strategy.interface';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  UserInfoDialogComponent,
  UserInfo,
  UserInfoDialogData,
} from '../user-info-dialog/user-info-dialog.component';
import { OrdersService } from '../../services/orders.service';
import { Order, OrderItem } from '../../models/order.model';
import { RestaurantStatusService } from '../../services/restaurant-status.service';
import { VendorNavigationService } from '../../services/vendor-navigation.service';
import { VendorService } from '../../services/vendor.service';
import { Product, ProductService } from '../../services/product.service';
import { DeliverySelectionService } from '../../services/delivery/delivery-selection.service';
import { getDefaultVatRate } from '../../shared/utils/vat-rates.util';
import { generateOrderNumber } from '../../shared/utils/order-number.util';
import {
  addToCart,
  incrementCartItem,
  decrementCartItem,
  removeCartItem,
  clearCart,
  applyCoupon as applyCouponAction,
  removeCoupon as removeCouponAction,
} from '../../store/actions/cart.actions';
import { VendorCurrencyPipe } from '../../shared/pipes/vendor-currency.pipe';
import { AppliedCoupon } from '../../models/coupon.model';

@Component({
  selector: 'app-cart-details-sheet',
  imports: [
    CommonModule,
    MatBottomSheetModule,
    MatIconModule,
    MatButtonModule,
    CartContentComponent,
  ],
  template: `
    <div class="sheet">
      @if (!isOnCartDetailsPage()) {
        <button
          mat-icon-button
          class="close-btn"
          aria-label="Fermer"
          (click)="close()"
        >
          <mat-icon>close</mat-icon>
        </button>
      }

      <h2 class="sheet-title">Mon panier</h2>

      <!-- Dining Preference Display -->
      @if (diningPreferenceService.hasSelectedPreference()) {
        <div class="dining-preference-info">
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
      }

      <!-- Shared cart body (FR7) — the persistent panel reuses it too -->
      <app-cart-content
        [stockErrors]="insufficientStockItems()"
        (checkoutRequested)="checkout()"
      />
    </div>
  `,
  styles: [
    `
      .sheet {
        position: relative;
        display: flex;
        flex-direction: column;
        max-height: 78vh;
        min-height: 0;
      }
      .close-btn {
        position: absolute;
        top: 12px;
        right: 12px;
        z-index: 10;
        background: var(--mat-sys-surface);
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
    `,
  ],
})
export class CartDetailsSheetComponent implements OnInit, OnDestroy {
  cartItems$: Observable<CartItem[]>;
  readonly diningPreferenceService = inject(DiningPreferenceService);
  private router = inject(Router);
  private vendorNavigation = inject(VendorNavigationService);
  private paymentService = inject(PaymentService);
  private snackBar = inject(MatSnackBar);
  private bottomSheetRef = inject(MatBottomSheetRef<CartDetailsSheetComponent>);
  private dialog = inject(MatDialog);
  private ordersService = inject(OrdersService);
  protected restaurantStatusService = inject(RestaurantStatusService);
  private vendorService = inject(VendorService);
  readonly deliverySelection = inject(DeliverySelectionService);
  readonly ordersSuspended$ = this.vendorService.ordersSuspended$;

  // Track products with insufficient stock by product ID
  insufficientStockItems = signal<Map<number, { available: number; required: number }>>(new Map());

  // Coupon state (checkout math reads the applied coupon)
  protected appliedCoupon = signal<AppliedCoupon | undefined>(undefined);
  private couponSub?: Subscription;

  constructor(private store: Store<AppState>) {
    this.cartItems$ = this.store.select(selectCartItems);
  }

  ngOnInit() {
    // Check if restaurant is closed for the day
    this.restaurantStatusService.refreshClosedForDay();

    this.couponSub = this.store
      .select(selectAppliedCoupon)
      .subscribe((c) => this.appliedCoupon.set(c));
  }

  ngOnDestroy() {
    this.couponSub?.unsubscribe();
  }












  getSubtotal(items: CartItem[]): number {
    return items.reduce((sum, item) => {
      // Use stored totalPrice for multi-step products, otherwise calculate normally
      const itemTotal = item.totalPrice || item.product.price * item.quantity;
      return sum + itemTotal;
    }, 0);
  }

  getDeliveryFee(items: CartItem[]): number {
    if (this.diningPreferenceService.diningPreference() !== 'delivery') {
      return 0;
    }
    // 1. Check if delivery fee is already in the cart as a virtual item
    const deliveryItem = items.find((item) => item.product.id === -9999);
    if (deliveryItem) {
      return deliveryItem.totalPrice || deliveryItem.product.price * deliveryItem.quantity;
    }
    // 2. Vendor uses own delivery with fixed price
    const vendor = this.vendorService.getCurrentVendor();
    if ((vendor as any)?.delivery_system === 'own') {
      const amount = Number((vendor as any)?.own_delivery_price ?? 0);
      return Number.isFinite(amount) && amount > 0 ? amount : 0;
    }
    // 3. Picki delivery: use best quote from delivery selection service
    const best = this.deliverySelection.bestOption();
    return best ? best.totalAmount / 100 : 0;
  }

  getServiceFee(items: CartItem[]): number {
    const subtotal = this.getSubtotal(items);
    if (subtotal <= 0) {
      return 0;
    }
    const currentVendor = this.vendorService.getCurrentVendor();
    const ratePercent = currentVendor?.service_fee_rate_percent ?? 0;
    const fixedFee = currentVendor?.service_fee_fixed ?? 0;
    const fee = subtotal * (ratePercent / 100) + fixedFee;
    return fee > 0 ? fee : 0;
  }

  getTotal(items: CartItem[]): number {
    const subtotal = this.getSubtotal(items);
    const discount = Math.min(this.appliedCoupon()?.discountAmount ?? 0, subtotal);
    let total = Math.max(0, subtotal - discount) + this.getServiceFee(items);
    // Add delivery fee if not already included as a cart item
    const hasDeliveryCartItem = items.some((item) => item.product.id === -9999);
    if (!hasDeliveryCartItem) {
      total += this.getDeliveryFee(items);
    }
    return total;
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
    if (this.vendorService.getCurrentOrdersSuspendedStatus()) {
      return;
    }
    if (this.restaurantStatusService.closedForDay()) {
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

      // Compute whether we need the preference step in the dialog
      const prefData = this.diningPreferenceService.diningPreferenceData();
      const needsPreferenceStep = !prefData || !prefData.preference || (prefData.preference !== 'eat-in' && prefData.timing == null);
      const vendor = this.vendorService.getCurrentVendor();
      const enabledOrderTypes = vendor?.enabled_order_types?.length
        ? vendor.enabled_order_types
        : ['take-away', 'eat-in', 'delivery'] as any[];

      const dialogData: UserInfoDialogData = {
        needsPreferenceStep,
        enabledOrderTypes,
        currentPreference: prefData?.preference,
        currentTiming: prefData?.timing,
        currentScheduledTime: prefData?.scheduledTime,
        currentTableNumber: prefData?.tableNumber,
      };

      // Open user info dialog (with optional preference step)
      const dialogRef = this.dialog.open(UserInfoDialogComponent, {
        width: '500px',
        maxWidth: '90vw',
        disableClose: true,
        autoFocus: true,
        data: dialogData,
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
    let currentProvider = this.paymentService.getCurrentProvider();

    try {
      const currentVendor = this.vendorService.getCurrentVendor();
      const onlinePaymentsEnabled =
        currentVendor?.online_payments_enabled ?? true;
      const payAtCheckout = !onlinePaymentsEnabled;

      // Choose payment provider based on vendor preference + Stripe configuration
      if (!payAtCheckout) {
        const preferredProvider = String(
          currentVendor?.paymentprovider ?? 'PAYGREEN'
        )
          .trim()
          .toUpperCase();
        const wantsStripe = preferredProvider === 'STRIPE';
        const stripeAccountId = (currentVendor?.stripe_account_id ?? '')
          .toString()
          .trim();
        const hasValidStripeConnectAccountId = /^(acct|cus)_[a-zA-Z0-9]+$/.test(
          stripeAccountId
        );

        let desiredProvider: 'stripe' | 'paygreen' = wantsStripe
          ? 'stripe'
          : 'paygreen';
        if (wantsStripe && !hasValidStripeConnectAccountId) {
          if (stripeAccountId) {
            console.warn(
              'Invalid vendor stripe_account_id detected (expected acct_... or cus_...):',
              stripeAccountId
            );
          }
          this.snackBar.open(
            'Stripe non configuré pour ce restaurant. Utilisation de PayGreen.',
            'OK',
            { duration: 6000 }
          );
          desiredProvider = 'paygreen';
        }
        try {
          this.paymentService.setPaymentProvider(desiredProvider);
        } catch (e) {
          console.warn(
            `Failed to switch payment provider to ${desiredProvider}, falling back to PayGreen:`,
            e
          );
          try {
            this.paymentService.setPaymentProvider('paygreen');
          } catch {
            // ignore - PayGreen is the default
          }
        }
        currentProvider = this.paymentService.getCurrentProvider();
      }

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
      const orderNumber = generateOrderNumber();

      // Create order items
      const orderItems: OrderItem[] = items.map((item) => {
        // For multi-step products, use the calculated totalPrice instead of base product price
        const itemPrice = item.totalPrice || item.product.price;
        const defaultVatRate = getDefaultVatRate(
          this.vendorService.getCurrentVendor()?.country
        );
        
        // Store multi-step metadata in options field
        const options = item.metadata ? 
          [item.metadata] : // Store CartMultiStepMetadata
          item.selectedComplements || []; // Store complements if available

        return {
          productId: item.product.id.toString(),
          productName: item.product.name,
          quantity: item.quantity,
          price: itemPrice, // Use calculated price for multi-step products
          tvaRate: item.product.tvaRate ?? defaultVatRate, // Store TVA rate from product
          options: options, // Store multi-step metadata or complements
          vendorId: item.product.vendorId,
          comment: item.comment,
        };
      });

      const couponSnapshot = this.appliedCoupon();

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
        tableNumber: diningPref === 'eat-in' ? (diningPrefData?.tableNumber || '1') : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: '',
        couponId: couponSnapshot?.couponId ?? null,
        couponCode: couponSnapshot?.code ?? null,
        discountAmount: couponSnapshot
          ? Math.min(couponSnapshot.discountAmount, this.getSubtotal(items))
          : 0,
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
        this.close();
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
      const returnUrl = `${baseUrl}${this.vendorNavigation.getVendorUrl(
        'successPayment'
      )}`;
      const cancelUrl = `${baseUrl}${this.vendorNavigation.getVendorUrl(
        'failedPayment'
      )}`;

      // Get current vendor for payment
      if (!currentVendor) {
        throw new Error('No vendor selected for payment');
      }

      // Prepare payment items (delivery fee is already stored as a cart item when applicable)
      const paymentItems = items.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        price: item.totalPrice || item.product.price,
      }));
      const serviceFee = this.getServiceFee(items);
      if (serviceFee > 0) {
        paymentItems.push({
          name: 'Frais de service',
          quantity: 1,
          price: serviceFee,
        });
      }

      const bestOption = this.deliverySelection.bestOption();

      // Delivery fee is retained by Picki as platform fee to cover courier cost.
      // Only applies to delivery orders with a 'picki' delivery system.
      const isPickiDelivery =
        diningPref === 'delivery' &&
        (currentVendor as any)?.delivery_system !== 'own';
      const deliveryFee = isPickiDelivery ? this.getDeliveryFee(items) : 0;

      // Create unified payment request with order reference
      const productsSubtotal = this.getSubtotal(items);
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
          // Note: Stripe metadata must be flat strings, so we intentionally avoid nested objects here.
        },
        // Picki retains the delivery fee from Stripe via application_fee_amount
        platformFeeAmount: deliveryFee,
        ...(couponSnapshot
          ? {
              couponCode: couponSnapshot.code,
              productsSubtotal,
            }
          : {}),
      };

      console.log(`Processing payment with ${currentProvider}...`);

      // Create payment using current strategy
      this.paymentService.createPayment(paymentRequest).subscribe({
        next: (response) => {
          console.log('Payment created:', response);

          if (response.url) {
            // Close the sheet before redirecting to payment provider
            this.close();
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
    } catch (error: any) {
      console.error('Error creating order:', error);

      if (error?.message === 'INSUFFICIENT_STOCK' && error?.insufficientItems?.length > 0) {
        this.showInsufficientStockError(error.insufficientItems);
      } else if (error?.message?.includes('Stock reservation failed')) {
        this.snackBar.open(
          'Erreur lors de la vérification du stock. Veuillez réessayer.',
          'Fermer',
          { duration: 5000 }
        );
      } else {
        this.snackBar.open(
          'Erreur lors de la création de la commande. Veuillez réessayer.',
          'Fermer',
          { duration: 5000 }
        );
      }
    }
  }

  private showInsufficientStockError(
    items: { productId?: number; product_id?: number; productName: string; available: number; required: number }[]
  ): void {
    const stockErrorMap = new Map<number, { available: number; required: number }>();

    for (const item of items) {
      const productId = item.productId ?? item.product_id;
      if (productId) {
        stockErrorMap.set(productId, {
          available: item.available,
          required: item.required,
        });
      }
    }

    this.insufficientStockItems.set(stockErrorMap);

    const productNames = items.map((i) => i.productName).join(', ');
    this.snackBar.open(
      `Stock insuffisant pour : ${productNames}`,
      'Fermer',
      { duration: 6000 }
    );
  }

  changeDiningPreference(): void {
    this.close();
    // Navigate to the dining preference route with vendor context
    this.vendorNavigation.navigateWithVendor('dining-preference');
  }
}
