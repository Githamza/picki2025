import { Component, inject, signal, effect, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Observable, firstValueFrom, Subscription } from 'rxjs';
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
  UserInfoDialogData,
} from '../user-info-dialog/user-info-dialog.component';
import { AppState, CartItem } from '../../store/models/app.state';
import {
  selectCartItems,
  selectFoodItems,
  selectAccessoryItems,
} from '../../store/selectors/cart.selectors';
import {
  addToCart,
  decrementCartItem,
  incrementCartItem,
  removeCartItem,
  clearCart,
} from '../../store/actions/cart.actions';
import { VendorNavigationService } from '../../services/vendor-navigation.service';
import { VendorService } from '../../services/vendor.service';
import { Product, ProductService } from '../../services/product.service';
import { DeliverySelectionService } from '../../services/delivery/delivery-selection.service';
import { AccessoriesStripComponent } from '../accessories-strip/accessories-strip.component';
import { VendorCurrencyPipe } from '../../shared/pipes/vendor-currency.pipe';
import { CartItemStepsTreeComponent } from '../cart-item-steps-tree/cart-item-steps-tree.component';
import { SupabaseService } from '../../services/supabase.service';
import { getDefaultVatRate } from '../../shared/utils/vat-rates.util';

@Component({
  selector: 'app-cart-details-page',
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    CartItemStepsTreeComponent,
    VendorCurrencyPipe,
    AccessoriesStripComponent,
  ],
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

      @if (cartItems$ | async; as items) {
        <!-- Food items -->
        @for (item of (foodItems$ | async) || []; track item.product.id) {
          <div class="cart-item-row">
            <div class="cart-item-info">
              @if (item.metadata?.stepSelections?.length) {
                <app-cart-item-steps-tree
                  [steps]="item.metadata?.stepSelections"
                >
                  <span stepsHeader class="cart-item-name">{{ item.product.name }}</span>
                </app-cart-item-steps-tree>
              } @else {
                <span class="cart-item-name">{{ item.product.name }}</span>
              }
            </div>
            @if (item.product.id !== -9999) {
              <div class="cart-item-controls">
                <button
                  mat-mini-fab
                  [color]="item.quantity === 1 ? 'warn' : 'primary'"
                  (click)="item.quantity === 1 ? remove(item.product.id) : decrement(item.product.id)"
                >
                  <mat-icon>{{ item.quantity === 1 ? 'delete' : 'remove' }}</mat-icon>
                </button>
                <span class="cart-item-qty">{{ item.quantity }}</span>
                <button
                  mat-mini-fab
                  color="primary"
                  (click)="increment(item.product.id)"
                  [disabled]="isIncrementDisabled(items, item.product)"
                >
                  <mat-icon>add</mat-icon>
                </button>
              </div>
            } @else {
              <div class="cart-item-controls">
                <span class="cart-item-qty">{{ item.quantity }}</span>
              </div>
            }
            <span
              class="cart-item-price"
              [style.visibility]="getItemPrice(item) > 0 ? 'visible' : 'hidden'"
            >
              {{ getItemPrice(item) | vendorCurrency }}
            </span>
          </div>
          <!-- Insufficient stock error message -->
          @if (insufficientStockItems().get(item.product.id); as stockError) {
            <div class="stock-error-message">
              Stock insuffisant, ajustez votre quantité ({{ stockError.available }} disponible(s))
            </div>
          }
        }

        <!-- Accessories strip -->
        @if (availableAccessories().length > 0) {
          <app-accessories-strip
            [accessories]="availableAccessories()"
            [cartAccessories]="(accessoryItems$ | async) || []"
            (add)="onAccessoryAdded($event)"
            (increment)="increment($event)"
            (decrement)="decrement($event)"
            (remove)="remove($event)"
          />
        }

        <!-- Selected accessories as cart items -->
        @for (item of (accessoryItems$ | async) || []; track item.product.id) {
          <div class="cart-item-row">
            <div class="cart-item-info">
              <span class="cart-item-name">
                @if (item.product.iconEmoji) {
                  <span class="accessory-item-emoji">{{ item.product.iconEmoji }}</span>
                }
                {{ item.product.name }}
              </span>
            </div>
            <span
              class="cart-item-price"
              [style.visibility]="getItemPrice(item) > 0 ? 'visible' : 'hidden'"
            >
              {{ getItemPrice(item) | vendorCurrency }}
            </span>
          </div>
        }

        @if (getServiceFee(items); as serviceFee) {
          <div class="cart-fee-row">
            <span>Frais de service:</span>
            <span class="cart-fee">{{ serviceFee | vendorCurrency }}</span>
          </div>
        }
        <div class="cart-total-row">
          <span>Total:</span>
          <span class="cart-total">{{ getTotal(items) | vendorCurrency }}</span>
        </div>

        <!-- Checkout Button -->
        <button
          matButton="filled"
          color="accent"
          class="checkout-button"
          (click)="checkout()"
          [disabled]="isCheckingOut || (ordersSuspended$ | async) || restaurantStatusService.closedForDay()"
        >
          <mat-icon>{{ getCheckoutIcon() }}</mat-icon>
          {{ getCheckoutLabel() }}
        </button>
      } @else {
        <div class="empty-cart">Votre panier est vide.</div>
      }
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
        align-items: center;
        gap: 12px;
        padding: 12px 0;
        border-bottom: 1px solid #eee;
      }
      .cart-item-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }
      .cart-item-name {
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .multi-step-details {
        margin-top: 4px;
        padding-left: 8px;
        border-left: 2px solid var(--mat-sys-primary);
      }
      .step-detail {
        margin-bottom: 2px;
        font-size: 0.8em;
        color: var(--mat-sys-on-surface-variant);
      }
      .step-name {
        font-weight: 500;
        color: var(--mat-sys-primary);
      }
      .option-name {
        color: var(--mat-sys-on-surface);
      }
      .cart-item-price {
        font-weight: 500;
        white-space: nowrap;
        min-width: 64px;
        text-align: right;
      }
      .cart-item-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .cart-item-qty {
        min-width: 28px;
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
      .cart-fee-row {
        display: flex;
        justify-content: space-between;
        margin: 12px 0 0 0;
        font-size: 0.95em;
        color: var(--mat-sys-on-surface-variant);
      }
      .cart-fee {
        color: var(--mat-sys-on-surface);
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
      .stock-error-message {
        color: var(--mat-sys-error);
        font-size: 0.85em;
        padding: 4px 0 8px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .accessory-item-row {
        background: var(--mat-sys-surface-container-low);
        border-radius: 8px;
        padding: 8px 12px;
        margin: 4px 0;
      }
      .accessory-item-emoji {
        margin-right: 4px;
      }
    `,
  ],
})
export class CartDetailsPageComponent implements OnInit, OnDestroy {
  cartItems$: Observable<CartItem[]>;
  foodItems$: Observable<CartItem[]>;
  accessoryItems$: Observable<CartItem[]>;
  protected diningPreferenceService = inject(DiningPreferenceService);
  private router = inject(Router);
  private vendorNavigation = inject(VendorNavigationService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private ordersService = inject(OrdersService);
  private paymentService = inject(PaymentService);
  protected restaurantStatusService = inject(RestaurantStatusService);
  private vendorService = inject(VendorService);
  private productService = inject(ProductService);
  private deliverySelection = inject(DeliverySelectionService);
  private supabaseService = inject(SupabaseService);
  readonly ordersSuspended$ = this.vendorService.ordersSuspended$;

  isCheckingOut = false;

  // Track products with insufficient stock by product ID
  insufficientStockItems = signal<Map<number, { available: number; required: number }>>(new Map());

  // Accessories
  availableAccessories = signal<Product[]>([]);
  private accessoriesSub?: Subscription;
  private previousDiningPref: string | null = null;

  constructor(private store: Store<AppState>, private location: Location) {
    this.cartItems$ = this.store.select(selectCartItems);
    this.foodItems$ = this.store.select(selectFoodItems);
    this.accessoryItems$ = this.store.select(selectAccessoryItems);

    // React to dining preference changes
    effect(() => {
      const pref = this.diningPreferenceService.diningPreference();
      if (pref) {
        this.loadAccessories(pref);
        this.removeInapplicableAccessories(pref);
      }
    });
  }

  ngOnInit() {
    // Check if restaurant is closed for the day
    this.restaurantStatusService.refreshClosedForDay();

    // Initial load if dining preference is already set
    const pref = this.diningPreferenceService.diningPreference();
    if (pref) {
      this.loadAccessories(pref);
    }
  }

  ngOnDestroy() {
    this.accessoriesSub?.unsubscribe();
  }

  private loadAccessories(orderType: string) {
    const vendorId = this.vendorService.getCurrentVendor()?.id;
    if (!vendorId) return;

    this.accessoriesSub?.unsubscribe();
    this.accessoriesSub = this.productService
      .getAccessories(vendorId, orderType)
      .subscribe({
        next: (accessories) => this.availableAccessories.set(accessories),
        error: (err) => {
          console.error('Error loading accessories:', err);
          this.availableAccessories.set([]);
        },
      });
  }

  private async removeInapplicableAccessories(newPref: string) {
    // Skip on first load (no previous preference to compare against)
    if (!this.previousDiningPref) {
      this.previousDiningPref = newPref;
      return;
    }
    if (this.previousDiningPref === newPref) return;
    this.previousDiningPref = newPref;

    const accessoryItems = await firstValueFrom(this.accessoryItems$);
    for (const item of accessoryItems) {
      const applicable = item.product.applicableOrderTypes || [];
      if (!applicable.includes(newPref)) {
        this.store.dispatch(removeCartItem({ productId: item.product.id }));
        this.snackBar.open(
          `${item.product.name} retiré (non applicable pour ${this.getOrderTypeLabel(newPref)})`,
          'OK',
          { duration: 3000 }
        );
      }
    }
  }

  private getOrderTypeLabel(type: string): string {
    switch (type) {
      case 'eat-in': return 'sur place';
      case 'take-away': return 'à emporter';
      case 'delivery': return 'livraison';
      default: return type;
    }
  }

  onAccessoryAdded(product: Product) {
    this.store.dispatch(addToCart({ product, quantity: 1 }));
  }

  private isOnlinePaymentsEnabled(): boolean {
    const currentVendor = this.vendorService.getCurrentVendor();
    return currentVendor?.online_payments_enabled ?? true;
  }

  getCheckoutIcon(): string {
    if (this.isCheckingOut) return 'hourglass_empty';
    return this.isOnlinePaymentsEnabled() ? 'payment' : 'receipt_long';
  }

  getCheckoutLabel(): string {
    if (this.isCheckingOut) return 'Vérification...';
    return this.isOnlinePaymentsEnabled() ? 'Valider et payer' : 'Valider ma commande';
  }

  goBack() {
    this.location.back();
  }

  increment(productId: number) {
    this.clearStockErrorForProduct(productId);
    this.store.dispatch(incrementCartItem({ productId }));
  }

  decrement(productId: number) {
    this.clearStockErrorForProduct(productId);
    this.store.dispatch(decrementCartItem({ productId }));
  }

  remove(productId: number) {
    this.clearStockErrorForProduct(productId);
    this.store.dispatch(removeCartItem({ productId }));
  }

  private clearStockErrorForProduct(productId: number): void {
    const currentErrors = this.insufficientStockItems();
    if (currentErrors.has(productId)) {
      const newMap = new Map(currentErrors);
      newMap.delete(productId);
      this.insufficientStockItems.set(newMap);
    }
  }

  getSubtotal(items: CartItem[]): number {
    return items.reduce((total, item) => {
      // Use stored totalPrice for multi-step products, otherwise calculate normally
      const itemTotal = item.totalPrice || item.product.price * item.quantity;
      return total + itemTotal;
    }, 0);
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
    return subtotal + this.getServiceFee(items);
  }

  getItemPrice(item: CartItem): number {
    // totalPrice already includes quantity for multi-step products
    return item.totalPrice || item.product.price * item.quantity;
  }

  isIncrementDisabled(items: CartItem[], product: Product): boolean {
    if (product.maxQuantityPerOrder != null) {
      const totalInCart = items
        .filter((i) => i.product.id === product.id)
        .reduce((sum, i) => sum + i.quantity, 0);
      if (totalInCart >= product.maxQuantityPerOrder) return true;
    }
    if (product.stockQuantity == null) return false;
    const totalInCart = items
      .filter((i) => i.product.id === product.id)
      .reduce((sum, i) => sum + i.quantity, 0);
    return totalInCart >= product.stockQuantity;
  }

  changeDiningPreference(): void {
    // Navigate to the dining preference route with vendor context
    this.vendorNavigation.navigateWithVendor('dining-preference');
  }

  async checkout() {
    if (this.isCheckingOut) return;
    if (this.vendorService.getCurrentOrdersSuspendedStatus()) {
      return;
    }
    if (this.restaurantStatusService.closedForDay()) {
      return;
    }

    this.isCheckingOut = true;

    try {
      // Restaurant is open, proceed with normal checkout
      const items = await firstValueFrom(this.cartItems$);
      if (items.length === 0) {
        this.snackBar.open('Votre panier est vide', 'Fermer', {
          duration: 3000,
        });
        this.isCheckingOut = false;
        return;
      }

      // Validate stock availability before proceeding
      const stockValidation = await this.validateCartStock(items);
      if (!stockValidation.valid) {
        this.showInsufficientStockError(stockValidation.insufficientItems);
        this.isCheckingOut = false;
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
        const defaultVatRate = getDefaultVatRate(
          this.vendorService.getCurrentVendor()?.country
        );
        
        // Store multi-step metadata in options field
        const options = item.metadata ? 
          [item.metadata] : // Store CartMultiStepMetadata
          item.selectedComplements || []; // Store complements if available

        // Transform customisation selections for storage
        let customisationSelections: OrderItem['customisationSelections'] = undefined;
        if (item.customisationSelections && item.customisationSelections.size > 0) {
          customisationSelections = [];
          
          // Get product customisations to map IDs to names
          const productCustomisations = item.product.customisations || [];
          
          item.customisationSelections.forEach((selectedOptionIds, customisationId) => {
            const customisation = productCustomisations.find(c => c.id === customisationId);
            
            if (customisation && selectedOptionIds.length > 0) {
              const selectedOptions = selectedOptionIds
                .map(optionId => {
                  const option = customisation.options?.find(o => o.id === optionId);
                  if (option) {
                    return {
                      optionId: option.id,
                      optionName: option.name,
                      priceAdjustment: option.price_adjustment || 0,
                    };
                  }
                  return null;
                })
                .filter((opt): opt is NonNullable<typeof opt> => opt !== null);
              
              if (selectedOptions.length > 0) {
                customisationSelections!.push({
                  customisationId: customisation.id,
                  customisationName: customisation.name,
                  selectedOptions,
                });
              }
            }
          });
          
          if (customisationSelections.length === 0) {
            customisationSelections = undefined;
          }
        }

        return {
          productId: item.product.id.toString(),
          productName: item.product.name,
          quantity: item.quantity,
          price: itemPrice, // Use calculated price for multi-step products
          tvaRate: item.product.tvaRate ?? defaultVatRate, // Store TVA rate from product
          options: options, // Store multi-step metadata or complements
          vendorId: item.product.vendorId,
          comment: item.comment,
          customisationSelections, // Store customisation selections
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
        tableNumber: diningPref === 'eat-in' ? (diningPrefData?.tableNumber || '1') : undefined,
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
        const isDelivery =
          this.diningPreferenceService.diningPreference() === 'delivery';
        const best = this.deliverySelection.bestOption();
        if (isDelivery) {
          // Build pickup from vendor info
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
              best: best ?? (fallbackBest as any),
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
        this.store.dispatch(clearCart());
        this.diningPreferenceService.resetPreference();

        const successBaseUrl = this.vendorNavigation.getVendorUrl('successPayment');
        const url = `${successBaseUrl}?orderId=${encodeURIComponent(createdOrder.id)}`;
        this.snackBar.open(
          'Commande enregistrée. Paiement à effectuer au retrait.',
          'OK',
          { duration: 5000 }
        );
        this.isCheckingOut = false;
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

      const best = this.deliverySelection.bestOption();

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
          orderSource: 'cart-page',
          delivery: best
            ? {
                providerId: best.providerId,
                providerName: best.providerName,
                amountMinor: best.totalAmount,
                currency: best.currency,
                etaMinutes: best.etaMinutes ?? null,
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
          this.isCheckingOut = false;
        },
      });
    } catch (error: any) {
      console.error('Error creating order:', error);

      // Handle insufficient stock error from atomic reservation
      if (error?.message === 'INSUFFICIENT_STOCK' && error?.insufficientItems?.length > 0) {
        this.showInsufficientStockError(error.insufficientItems);
      } else if (error?.message?.includes('Stock reservation failed')) {
        // Database error during stock reservation
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
      this.isCheckingOut = false;
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

  private async validateCartStock(
    items: CartItem[]
  ): Promise<{ valid: boolean; insufficientItems: any[] }> {
    try {
      // Build items array for validation RPC
      const validationItems = items
        .filter((item) => item.product.id > 0) // Skip virtual items like delivery fee
        .map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          // Include multi-step option products
          optionProductIds:
            item.metadata?.stepSelections?.flatMap(
              (s: { selectedOptions: { productId: number }[] }) =>
                s.selectedOptions
                  .map((o: { productId: number }) => o.productId)
                  .filter((id: number) => id && id > 0)
            ) || [],
          // Include complement products
          complementProductIds:
            item.selectedComplements?.map((c: any) => ({
              productId: c.complement_product_id,
              quantity: c.quantity,
            })) || [],
        }));

      if (validationItems.length === 0) {
        return { valid: true, insufficientItems: [] };
      }

      // Cast to any to allow calling custom RPC function not yet in generated types
      const { data, error } = await (this.supabaseService.getClient() as any).rpc(
        'validate_stock_for_cart',
        { p_items: validationItems }
      );

      if (error) {
        console.error('Stock validation error:', error);
        // Fail open on error - allow checkout to proceed
        return { valid: true, insufficientItems: [] };
      }

      // Ensure proper return type
      if (data && typeof data === 'object' && 'valid' in data) {
        return {
          valid: Boolean(data.valid),
          insufficientItems: data.insufficientItems || [],
        };
      }

      return { valid: true, insufficientItems: [] };
    } catch (error) {
      console.error('Stock validation exception:', error);
      // Fail open on error - allow checkout to proceed
      return { valid: true, insufficientItems: [] };
    }
  }

  private showInsufficientStockError(
    items: { productId?: number; product_id?: number; productName: string; available: number; required: number }[]
  ): void {
    // Build a map of product IDs to stock errors for inline display
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

    // Update the signal to trigger inline error display
    this.insufficientStockItems.set(stockErrorMap);

    // Show snackbar notification
    const productNames = items.map((i) => i.productName).join(', ');
    this.snackBar.open(
      `Stock insuffisant pour : ${productNames}`,
      'Fermer',
      { duration: 6000 }
    );
  }
}
