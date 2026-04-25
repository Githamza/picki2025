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
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog } from '@angular/material/dialog';
import { CartItemStepsTreeComponent } from '../cart-item-steps-tree/cart-item-steps-tree.component';
import { AccessoriesStripComponent } from '../accessories-strip/accessories-strip.component';
import { CouponInputComponent } from '../coupon-input/coupon-input.component';
import {
  selectCartItems,
  selectFoodItems,
  selectAccessoryItems,
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
import { CouponService } from '../../services/coupon.service';
import { CartTotalsService } from '../../services/cart-totals.service';
import { AppliedCoupon } from '../../models/coupon.model';

@Component({
  selector: 'app-cart-details-sheet',
  imports: [
    CommonModule,
    MatBottomSheetModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    CartItemStepsTreeComponent,
    AccessoriesStripComponent,
    CouponInputComponent,
    VendorCurrencyPipe,
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

      <div class="sheet-scroll">
        @if (cartItems$ | async; as items) {
          <div class="cart-list">
            @for (item of (foodItems$ | async) || []; track item.product.id) {
              <div class="cart-item">
                @if (item.product.imageUrl) {
                  <img class="item-image" [src]="item.product.imageUrl" [alt]="item.product.name" />
                } @else {
                  <mat-icon class="item-icon">shopping_bag</mat-icon>
                }
                <div class="item-content">
                  @if (item.metadata?.stepSelections?.length) {
                    <app-cart-item-steps-tree
                      [steps]="item.metadata?.stepSelections"
                    >
                      <div stepsHeader class="item-title-row">
                        <span class="item-title">{{ item.product.name }}</span>
                        <div class="qty-controls" (click)="$event.stopPropagation()">
                          @if (item.quantity > 1) {
                            <button mat-icon-button class="qty-btn" (click)="onFoodDecrement(item.product.id)">
                              <mat-icon>remove</mat-icon>
                            </button>
                          } @else {
                            <button mat-icon-button class="qty-btn" (click)="onFoodRemove(item.product.id)">
                              <mat-icon>delete</mat-icon>
                            </button>
                          }
                          <span class="qty-value">{{ item.quantity }}</span>
                          <button mat-icon-button class="qty-btn" (click)="onFoodIncrement(item.product.id)">
                            <mat-icon>add</mat-icon>
                          </button>
                        </div>
                        <span
                          class="item-price price-value"
                          [style.visibility]="
                            getItemPrice(item) > 0 ? 'visible' : 'hidden'
                          "
                        >
                          {{ getItemPrice(item) | vendorCurrency }}
                        </span>
                      </div>
                    </app-cart-item-steps-tree>
                  } @else {
                    <div class="item-title-row">
                      <span class="item-title">{{ item.product.name }}</span>
                      <div class="qty-controls">
                        @if (item.quantity > 1) {
                          <button mat-icon-button class="qty-btn" (click)="onFoodDecrement(item.product.id)">
                            <mat-icon>remove</mat-icon>
                          </button>
                        } @else {
                          <button mat-icon-button class="qty-btn" (click)="onFoodRemove(item.product.id)">
                            <mat-icon>delete</mat-icon>
                          </button>
                        }
                        <span class="qty-value">{{ item.quantity }}</span>
                        <button mat-icon-button class="qty-btn" (click)="onFoodIncrement(item.product.id)">
                          <mat-icon>add</mat-icon>
                        </button>
                      </div>
                      <span
                        class="item-price price-value"
                        [style.visibility]="
                          getItemPrice(item) > 0 ? 'visible' : 'hidden'
                        "
                      >
                        {{ getItemPrice(item) | vendorCurrency }}
                      </span>
                    </div>
                  }
                  @if (item.comment) {
                    <div class="item-comment">
                      <mat-icon>comment</mat-icon>
                      {{ item.comment }}
                    </div>
                  }
                  @if (insufficientStockItems().has(item.product.id)) {
                    <div class="stock-error-message">
                      Stock insuffisant, ajustez votre quantité ({{ insufficientStockItems().get(item.product.id)?.available }} disponible(s))
                    </div>
                  }
                </div>
              </div>
            }
          </div>

        } @else {
          <div class="empty-cart">Votre panier est vide.</div>
        }
      </div>

      <div class="sheet-actions">
        <!-- Accessories strip - always visible -->
        @if (availableAccessories().length > 0) {
          <app-accessories-strip
            [accessories]="availableAccessories()"
            [cartAccessories]="(accessoryItems$ | async) || []"
            (add)="onAccessoryAdded($event)"
            (increment)="onAccessoryIncrement($event)"
            (decrement)="onAccessoryDecrement($event)"
            (remove)="onAccessoryRemove($event)"
          />
        }

        @if (cartItems$ | async; as items) {
          <!-- Selected accessories - above service fee -->
          @for (item of (accessoryItems$ | async) || []; track item.product.id) {
            <div class="accessory-fee-item">
              <div class="fee-row-content">
                <span class="accessory-item-emoji-inline">{{ item.product.iconEmoji || '📦' }}</span>
                <span>{{ item.product.name }}</span>
              </div>
              <span class="fee-price price-value"
                [style.visibility]="getItemPrice(item) > 0 ? 'visible' : 'hidden'"
              >{{ getItemPrice(item) | vendorCurrency }}</span>
            </div>
          }

          @if (totals.subtotal() > 0) {
            <app-coupon-input
              class="coupon-input-row"
              [applied]="appliedCoupon()"
              [busy]="couponBusy()"
              [error]="couponError()"
              (apply)="onApplyCoupon($event)"
              (remove)="onRemoveCoupon()"
            />
          }

          @if (totals.discount() > 0) {
            <div class="fee-row discount-row">
              <div class="fee-row-content">
                <mat-icon class="fee-icon discount-icon">redeem</mat-icon>
                <span>Remise{{ appliedCoupon() ? ' (' + appliedCoupon()!.code + ')' : '' }}:</span>
              </div>
              <span class="fee-price price-value discount-value">
                -{{ totals.discount() | vendorCurrency }}
              </span>
            </div>
          }

          @if (getDeliveryFee(items ?? []); as deliveryFee) {
            <div class="fee-row">
              <div class="fee-row-content">
                <mat-icon class="fee-icon">local_shipping</mat-icon>
                <span>Frais de livraison:</span>
              </div>
              <span class="fee-price price-value">{{
                deliveryFee | vendorCurrency
              }}</span>
            </div>
          }

          @if (getServiceFee(items ?? []); as serviceFee) {
            <div class="fee-row">
              <div class="fee-row-content">
                <mat-icon class="fee-icon">payments</mat-icon>
                <span>Frais de service:</span>
              </div>
              <span class="fee-price price-value">{{
                serviceFee | vendorCurrency
              }}</span>
            </div>
          }
        }
        <!-- <button
         matButton="tonal"
          color="primary"
          class="checkout-btn"
          (click)="goToCartDetails()"
        >
          Modifier mon panier
        </button>  -->
        <button
          mat-flat-button
          color="accent"
          class="checkout-btn checkout-btn-validate"
          [disabled]="(ordersSuspended$ | async) || restaurantStatusService.closedForDay()"
          (click)="checkout()"
        >
          Valider ma commande - {{  getTotal((cartItems$ | async) || []) | vendorCurrency }}
        </button>
      </div>
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
      .sheet-scroll {
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
      }
      .sheet-actions {
        position: sticky;
        bottom: 0;
        z-index: 2;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px 0 0 0;
        border-top: 1px solid var(--mat-sys-outline-variant);
      }
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
      .cart-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .cart-item {
        align-items: center;

        display: flex;
        gap: 12px;
        padding: 8px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .cart-item:last-child {
        border-bottom: none;
      }
      .item-image {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        object-fit: cover;
        flex-shrink: 0;
      }
      .item-icon {
        width: 40px;
        height: 40px;
        font-size: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--mat-sys-on-surface-variant);
        flex-shrink: 0;
      }
      .qty-controls {
        display: flex;
        align-items: center;
        gap: 0;
        flex-shrink: 0;
      }
      .qty-btn {
        width: 28px;
        height: 28px;
        padding: 0;
        --mdc-icon-button-state-layer-size: 28px;
        --mdc-icon-button-icon-size: 18px;
      }
      .qty-btn mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
      .qty-value {
        min-width: 20px;
        text-align: center;
        font-weight: 500;
        font-size: 0.9em;
      }
      .item-content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }
      .item-title-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        gap: 16px;
      }
      .item-title-row > span:first-child {
        flex: 1;
        min-width: 0;
      }
      .item-title {
        font-weight: 500;
      }
      .item-price {
        font-weight: 400;
        font-size: 0.85em;
        color: var(--mat-sys-on-surface-variant);
        margin-left: auto;
        white-space: nowrap;
        padding-left: 8px;
        border-left: 1px solid var(--mat-sys-outline-variant);
      }
      .item-line {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.95em;
      }
      .price-value {
        min-width: 96px;
        text-align: right;
      }
      @media (max-width: 600px) {
        .price-value {
          min-width: auto;
        }
        .item-title-row {
          gap: 4px;
        }
        .qty-controls + .item-price {
          margin-left: 0;
        }
      }
      .total-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: bold;
        margin: 16px 0 0 0;
        font-size: 1.1em;
      }
      .total-row-content {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .total-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: var(--mat-sys-primary);
      }
      .fee-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 8px 0 0 0;
        font-size: 0.95em;
        color: var(--mat-sys-on-surface-variant);
      }
      .fee-row-content {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .fee-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: var(--mat-sys-on-surface-variant);
      }
      .fee-price {
        color: var(--mat-sys-on-surface);
      }
      .total-price {
        color: var(--mat-primary);
      }
      .coupon-input-row {
        display: block;
        margin: 8px 0 4px 0;
      }
      .discount-row {
        color: var(--mat-sys-tertiary);
      }
      .discount-icon {
        color: var(--mat-sys-tertiary);
      }
      .discount-value {
        color: var(--mat-sys-tertiary);
        font-weight: 500;
      }
      .empty-cart {
        text-align: center;
        color: #888;
        margin: 24px 0;
      }
      .checkout-btn {
        width: 100%;
        margin-top: 0;
      }
      .checkout-btn-validate {
        font-weight: bold;
        margin-top: 0;
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
      .stock-error-message {
        color: var(--mat-sys-error);
        font-size: 0.85em;
        padding: 4px 0 0 0;
      }
      .accessory-fee-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.95em;
        padding: 4px 0;
        color: var(--mat-sys-on-surface-variant);
      }
      .accessory-item-emoji-inline {
        font-size: 18px;
        margin-right: 4px;
      }
      /* delivery-summary removed: delivery fee is shown as a cart item */
    `,
  ],
})
export class CartDetailsSheetComponent implements OnInit, OnDestroy {
  cartItems$: Observable<CartItem[]>;
  foodItems$: Observable<CartItem[]>;
  accessoryItems$: Observable<CartItem[]>;
  readonly diningPreferenceService = inject(DiningPreferenceService);
  private router = inject(Router);
  private vendorNavigation = inject(VendorNavigationService);
  private paymentService = inject(PaymentService);
  private productService = inject(ProductService);
  private snackBar = inject(MatSnackBar);
  private bottomSheetRef = inject(MatBottomSheetRef<CartDetailsSheetComponent>);
  private dialog = inject(MatDialog);
  private ordersService = inject(OrdersService);
  protected restaurantStatusService = inject(RestaurantStatusService);
  private vendorService = inject(VendorService);
  readonly deliverySelection = inject(DeliverySelectionService);
  readonly ordersSuspended$ = this.vendorService.ordersSuspended$;
  private couponService = inject(CouponService);
  protected totals = inject(CartTotalsService);

  // Track products with insufficient stock by product ID
  insufficientStockItems = signal<Map<number, { available: number; required: number }>>(new Map());

  // Accessories
  availableAccessories = signal<Product[]>([]);
  private accessoriesSub?: Subscription;

  // Coupon UI state
  protected couponBusy = signal(false);
  protected couponError = signal<string | null>(null);
  protected appliedCoupon = signal<AppliedCoupon | undefined>(undefined);
  private couponSub?: Subscription;

  constructor(private store: Store<AppState>) {
    this.cartItems$ = this.store.select(selectCartItems);
    this.foodItems$ = this.store.select(selectFoodItems);
    this.accessoryItems$ = this.store.select(selectAccessoryItems);

    effect(() => {
      const pref = this.diningPreferenceService.diningPreference();
      if (pref) {
        this.loadAccessories(pref);
      }
    });
  }

  ngOnInit() {
    // Check if restaurant is closed for the day
    this.restaurantStatusService.refreshClosedForDay();

    const pref = this.diningPreferenceService.diningPreference();
    if (pref) {
      this.loadAccessories(pref);
    }

    this.couponSub = this.store
      .select(selectAppliedCoupon)
      .subscribe((c) => this.appliedCoupon.set(c));
  }

  ngOnDestroy() {
    this.accessoriesSub?.unsubscribe();
    this.couponSub?.unsubscribe();
  }

  protected onApplyCoupon(code: string): void {
    const vendor = this.vendorService.getCurrentVendor();
    const subtotal = this.totals.subtotal();
    if (!vendor?.id || subtotal <= 0) {
      this.couponError.set('Ajoutez des produits avant d\'appliquer un code.');
      return;
    }

    this.couponBusy.set(true);
    this.couponError.set(null);

    this.couponService
      .validate({ vendorId: vendor.id, code, subtotal })
      .subscribe({
        next: (result) => {
          this.couponBusy.set(false);
          if (result.valid) {
            this.store.dispatch(
              applyCouponAction({
                coupon: {
                  couponId: result.couponId,
                  code: result.code,
                  discountType: result.discountType,
                  discountAmount: result.discountAmount,
                },
              })
            );
            this.snackBar.open(`Code "${result.code}" appliqué.`, 'Fermer', {
              duration: 3000,
              panelClass: ['success-snackbar'],
            });
          } else {
            this.couponError.set(this.couponFailureMessage(result.reason, result.minSubtotal));
          }
        },
        error: () => {
          this.couponBusy.set(false);
          this.couponError.set('Validation impossible. Réessayez.');
        },
      });
  }

  protected onRemoveCoupon(): void {
    this.store.dispatch(removeCouponAction());
    this.couponError.set(null);
  }

  private couponFailureMessage(
    reason:
      | 'NOT_FOUND'
      | 'INACTIVE'
      | 'EXPIRED'
      | 'EXHAUSTED'
      | 'BELOW_MIN_SUBTOTAL',
    minSubtotal?: number
  ): string {
    switch (reason) {
      case 'EXPIRED':
        return 'Ce code n\'est plus valide.';
      case 'EXHAUSTED':
        return 'Ce code a atteint son nombre maximum d\'utilisations.';
      case 'INACTIVE':
        return 'Ce code n\'est pas actif.';
      case 'BELOW_MIN_SUBTOTAL':
        return minSubtotal !== undefined
          ? `Panier minimum requis : ${minSubtotal.toFixed(2)} ${this.vendorService.getCurrentCurrency() ?? ''}`.trim()
          : 'Le panier ne respecte pas le minimum requis.';
      case 'NOT_FOUND':
      default:
        return 'Code invalide.';
    }
  }

  private loadAccessories(orderType: string) {
    const vendorId = this.vendorService.getCurrentVendor()?.id;
    if (!vendorId) return;

    this.accessoriesSub?.unsubscribe();
    this.accessoriesSub = this.productService
      .getAccessories(vendorId, orderType)
      .subscribe({
        next: (accessories) => this.availableAccessories.set(accessories),
        error: () => this.availableAccessories.set([]),
      });
  }

  onFoodIncrement(productId: number) {
    this.store.dispatch(incrementCartItem({ productId }));
  }

  onFoodDecrement(productId: number) {
    this.store.dispatch(decrementCartItem({ productId }));
  }

  onFoodRemove(productId: number) {
    this.store.dispatch(removeCartItem({ productId }));
  }

  onAccessoryAdded(product: Product) {
    this.store.dispatch(addToCart({ product, quantity: 1 }));
  }

  onAccessoryIncrement(productId: number) {
    this.store.dispatch(incrementCartItem({ productId }));
  }

  onAccessoryDecrement(productId: number) {
    this.store.dispatch(decrementCartItem({ productId }));
  }

  onAccessoryRemove(productId: number) {
    this.store.dispatch(removeCartItem({ productId }));
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

  getItemPrice(item: CartItem): number {
    // totalPrice already includes quantity for multi-step products
    return item.totalPrice || item.product.price * item.quantity;
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
