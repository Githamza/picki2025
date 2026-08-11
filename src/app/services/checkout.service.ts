import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { take } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { toSignal } from '@angular/core/rxjs-interop';

import {
  UserInfoDialogComponent,
  UserInfo,
  UserInfoDialogData,
} from '../components/user-info-dialog/user-info-dialog.component';
import { AppState, CartItem } from '../store/models/app.state';
import {
  selectCartItems,
  selectAppliedCoupon,
} from '../store/selectors/cart.selectors';
import { clearCart } from '../store/actions/cart.actions';
import { Order, OrderItem } from '../models/order.model';
import { DiningPreferenceService } from './dining-preference.service';
import { RestaurantStatusService } from './restaurant-status.service';
import { VendorNavigationService } from './vendor-navigation.service';
import { VendorService } from './vendor.service';
import { PaymentService } from './payment.service';
import { PaymentRequest } from './payment-strategy.interface';
import { OrdersService } from './orders.service';
import { DeliverySelectionService } from './delivery/delivery-selection.service';
import { KioskModeService } from './kiosk-mode.service';
import { TicketPrintService } from './ticket-print.service';
import { getDefaultVatRate } from '../shared/utils/vat-rates.util';
import { generateOrderNumber } from '../shared/utils/order-number.util';

export interface CheckoutHostOptions {
  /** Called before redirect/navigation so the host surface can close. */
  onDismiss?: () => void;
  /** Recorded in payment metadata (e.g. 'cart-sheet', 'cart-panel'). */
  orderSource?: string;
}

/**
 * Order submission for every cart surface (SPEC.md FR7 / T26).
 *
 * Moved verbatim from cart-details-sheet so the bottom sheet and the
 * persistent landscape panel share one checkout path. The Stripe/PayGreen
 * call flow is untouched (payment boundary).
 */
@Injectable({ providedIn: 'root' })
export class CheckoutService {
  private readonly store = inject(Store<AppState>);
  private readonly router = inject(Router);
  private readonly vendorNavigation = inject(VendorNavigationService);
  private readonly paymentService = inject(PaymentService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly ordersService = inject(OrdersService);
  private readonly restaurantStatusService = inject(RestaurantStatusService);
  private readonly vendorService = inject(VendorService);
  private readonly deliverySelection = inject(DeliverySelectionService);
  private readonly diningPreferenceService = inject(DiningPreferenceService);
  private readonly kioskMode = inject(KioskModeService);
  private readonly ticketPrint = inject(TicketPrintService);

  private readonly cartItems$ = this.store.select(selectCartItems);
  private readonly appliedCoupon = toSignal(
    this.store.select(selectAppliedCoupon),
    { initialValue: undefined }
  );

  /** Products with insufficient stock, keyed by product id — hosts pass
   *  this to cart-content so the error renders on the right line. */
  readonly stockErrors = signal<
    Map<number, { available: number; required: number }>
  >(new Map());

  async checkout(options: CheckoutHostOptions = {}): Promise<void> {
    if (this.vendorService.getCurrentOrdersSuspendedStatus()) {
      return;
    }
    if (this.restaurantStatusService.closedForDay()) {
      return;
    }

    // Restaurant is open, proceed with normal checkout
    this.cartItems$.pipe(take(1)).subscribe((items) => {
      if (items.length === 0) {
        this.snackBar.open('Votre panier est vide', 'Fermer', {
          duration: 3000,
        });
        return;
      }

      // Compute whether we need the preference step in the dialog
      const prefData = this.diningPreferenceService.diningPreferenceData();
      const needsPreferenceStep =
        !prefData ||
        !prefData.preference ||
        (prefData.preference !== 'eat-in' && prefData.timing == null);
      const vendor = this.vendorService.getCurrentVendor();
      const kioskActive = this.kioskMode.active();
      let enabledOrderTypes = vendor?.enabled_order_types?.length
        ? vendor.enabled_order_types
        : (['take-away', 'eat-in', 'delivery'] as any[]);
      // FR4: a kiosk customer is on site — only "sur place" and "à emporter".
      if (kioskActive) {
        const kioskTypes = enabledOrderTypes.filter(
          (type: string) => type !== 'delivery'
        );
        enabledOrderTypes = kioskTypes.length
          ? kioskTypes
          : (['eat-in', 'take-away'] as any[]);
      }

      const dialogData: UserInfoDialogData = {
        needsPreferenceStep,
        enabledOrderTypes,
        // Same predicate processPayment applies: counter payment when the
        // vendor has no online payments OR the kiosk is active (FR4a).
        payAtCounter:
          !(vendor?.online_payments_enabled ?? true) || kioskActive,
        // FR4: kiosk customers only type their phone on a numeric keypad.
        phoneOnly: kioskActive,
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
          this.processPayment(items, userInfo, options);
        }
        // If userInfo is null/undefined, user cancelled the dialog
      });
    });
  }

  // ---------------------------------------------------------------------
  // Totals used by order submission (kept verbatim from the sheet; the
  // display path uses CartTotalsService).
  // ---------------------------------------------------------------------
  private getSubtotal(items: CartItem[]): number {
    return items.reduce((sum, item) => {
      const itemTotal = item.totalPrice || item.product.price * item.quantity;
      return sum + itemTotal;
    }, 0);
  }

  private getDeliveryFee(items: CartItem[]): number {
    if (this.diningPreferenceService.diningPreference() !== 'delivery') {
      return 0;
    }
    const deliveryItem = items.find((item) => item.product.id === -9999);
    if (deliveryItem) {
      return (
        deliveryItem.totalPrice ||
        deliveryItem.product.price * deliveryItem.quantity
      );
    }
    const vendor = this.vendorService.getCurrentVendor();
    if ((vendor as any)?.delivery_system === 'own') {
      const amount = Number((vendor as any)?.own_delivery_price ?? 0);
      return Number.isFinite(amount) && amount > 0 ? amount : 0;
    }
    const best = this.deliverySelection.bestOption();
    return best ? best.totalAmount / 100 : 0;
  }

  private getServiceFee(items: CartItem[]): number {
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

  private getTotal(items: CartItem[]): number {
    const subtotal = this.getSubtotal(items);
    const discount = Math.min(
      this.appliedCoupon()?.discountAmount ?? 0,
      subtotal
    );
    let total = Math.max(0, subtotal - discount) + this.getServiceFee(items);
    const hasDeliveryCartItem = items.some((item) => item.product.id === -9999);
    if (!hasDeliveryCartItem) {
      total += this.getDeliveryFee(items);
    }
    return total;
  }

  private async processPayment(
    items: CartItem[],
    userInfo: UserInfo,
    options: CheckoutHostOptions
  ): Promise<void> {
    const totalAmount = this.getTotal(items);
    let currentProvider = this.paymentService.getCurrentProvider();

    try {
      const currentVendor = this.vendorService.getCurrentVendor();
      const onlinePaymentsEnabled =
        currentVendor?.online_payments_enabled ?? true;
      // FR4a: kiosk orders are ALWAYS paid at the counter, even when the
      // vendor has online payments enabled. Stripe/PayGreen are never
      // entered from a kiosk.
      const payAtCheckout = !onlinePaymentsEnabled || this.kioskMode.active();

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
        const options = item.metadata
          ? [item.metadata] // Store CartMultiStepMetadata
          : item.selectedComplements || []; // Store complements if available

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
        tableNumber:
          diningPref === 'eat-in'
            ? diningPrefData?.tableNumber || '1'
            : undefined,
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
        console.warn('Failed to persist delivery selection:', e);
      }

      // Offline payment flow: order is created and paid at checkout/pickup.
      if (payAtCheckout) {
        // FR4: kiosk orders print their ticket immediately. Fire and forget —
        // the service is best-effort and must not delay the confirmation.
        if (this.kioskMode.active()) {
          void this.ticketPrint.printKioskOrderTicket(createdOrder);
        }
        options.onDismiss?.();
        this.store.dispatch(clearCart());
        this.diningPreferenceService.resetPreference();

        const successBaseUrl =
          this.vendorNavigation.getVendorUrl('successPayment');
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
          orderSource: options.orderSource ?? 'cart',
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
            // Close the host surface before redirecting to payment provider
            options.onDismiss?.();
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

      if (
        error?.message === 'INSUFFICIENT_STOCK' &&
        error?.insufficientItems?.length > 0
      ) {
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
    items: {
      productId?: number;
      product_id?: number;
      productName: string;
      available: number;
      required: number;
    }[]
  ): void {
    const stockErrorMap = new Map<
      number,
      { available: number; required: number }
    >();

    for (const item of items) {
      const productId = item.productId ?? item.product_id;
      if (productId) {
        stockErrorMap.set(productId, {
          available: item.available,
          required: item.required,
        });
      }
    }

    this.stockErrors.set(stockErrorMap);

    const productNames = items.map((i) => i.productName).join(', ');
    this.snackBar.open(`Stock insuffisant pour : ${productNames}`, 'Fermer', {
      duration: 6000,
    });
  }
}
