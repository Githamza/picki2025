import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CartItemStepsTreeComponent } from '../../../components/cart-item-steps-tree/cart-item-steps-tree.component';
import { AccessoriesStripComponent } from '../../../components/accessories-strip/accessories-strip.component';
import { CouponInputComponent } from '../../../components/coupon-input/coupon-input.component';
import {
  selectCartItems,
  selectFoodItems,
  selectAccessoryItems,
  selectAppliedCoupon,
} from '../../../store/selectors/cart.selectors';
import { CartItem, AppState } from '../../../store/models/app.state';
import {
  addToCart,
  incrementCartItem,
  decrementCartItem,
  removeCartItem,
  applyCoupon as applyCouponAction,
  removeCoupon as removeCouponAction,
} from '../../../store/actions/cart.actions';
import { DiningPreferenceService } from '../../../services/dining-preference.service';
import { RestaurantStatusService } from '../../../services/restaurant-status.service';
import { VendorService } from '../../../services/vendor.service';
import { Product, ProductService } from '../../../services/product.service';
import { CouponService } from '../../../services/coupon.service';
import { CartTotalsService } from '../../../services/cart-totals.service';
import { AppliedCoupon } from '../../../models/coupon.model';
import { VendorCurrencyPipe } from '../../pipes/vendor-currency.pipe';

/**
 * The cart body (SPEC.md FR7): line items with quantity controls,
 * accessories strip, coupon input, fee rows, and the checkout CTA.
 *
 * Shared presentation for every cart surface — the bottom sheet
 * (phone/tablet-portrait) and the persistent panel (landscape/kiosk)
 * both wrap this component. Checkout itself stays with the host, which
 * listens to (checkoutRequested).
 */
@Component({
  selector: 'app-cart-content',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    CartItemStepsTreeComponent,
    AccessoriesStripComponent,
    CouponInputComponent,
    VendorCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cart-content.component.html',
  styleUrl: './cart-content.component.scss',
})
export class CartContentComponent implements OnInit, OnDestroy {
  private readonly store = inject(Store<AppState>);
  private readonly vendorService = inject(VendorService);
  private readonly productService = inject(ProductService);
  private readonly couponService = inject(CouponService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly diningPreferenceService = inject(DiningPreferenceService);
  protected readonly restaurantStatusService = inject(RestaurantStatusService);
  protected readonly totals = inject(CartTotalsService);
  protected readonly ordersSuspended$ = this.vendorService.ordersSuspended$;

  /** Stock errors keyed by product id — owned by the host's checkout flow. */
  readonly stockErrors = input<
    Map<number, { available: number; required: number }>
  >(new Map());

  readonly checkoutRequested = output<void>();

  cartItems$: Observable<CartItem[]> = this.store.select(selectCartItems);
  foodItems$: Observable<CartItem[]> = this.store.select(selectFoodItems);
  accessoryItems$: Observable<CartItem[]> = this.store.select(
    selectAccessoryItems
  );

  availableAccessories = signal<Product[]>([]);
  private accessoriesSub?: Subscription;

  protected couponBusy = signal(false);
  protected couponError = signal<string | null>(null);
  protected appliedCoupon = signal<AppliedCoupon | undefined>(undefined);
  private couponSub?: Subscription;

  constructor() {
    effect(() => {
      const pref = this.diningPreferenceService.diningPreference();
      if (pref) {
        this.loadAccessories(pref);
      }
    });
  }

  ngOnInit(): void {
    this.restaurantStatusService.refreshClosedForDay();

    const pref = this.diningPreferenceService.diningPreference();
    if (pref) {
      this.loadAccessories(pref);
    }

    this.couponSub = this.store
      .select(selectAppliedCoupon)
      .subscribe((c) => this.appliedCoupon.set(c));
  }

  ngOnDestroy(): void {
    this.accessoriesSub?.unsubscribe();
    this.couponSub?.unsubscribe();
  }

  private loadAccessories(orderType: string): void {
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

  onFoodIncrement(productId: number): void {
    this.store.dispatch(incrementCartItem({ productId }));
  }

  onFoodDecrement(productId: number): void {
    this.store.dispatch(decrementCartItem({ productId }));
  }

  onFoodRemove(productId: number): void {
    this.store.dispatch(removeCartItem({ productId }));
  }

  onAccessoryAdded(product: Product): void {
    this.store.dispatch(addToCart({ product, quantity: 1 }));
  }

  onAccessoryIncrement(productId: number): void {
    this.store.dispatch(incrementCartItem({ productId }));
  }

  onAccessoryDecrement(productId: number): void {
    this.store.dispatch(decrementCartItem({ productId }));
  }

  onAccessoryRemove(productId: number): void {
    this.store.dispatch(removeCartItem({ productId }));
  }

  getItemPrice(item: CartItem): number {
    // totalPrice already includes quantity for multi-step products
    return item.totalPrice || item.product.price * item.quantity;
  }

  protected onApplyCoupon(code: string): void {
    const vendor = this.vendorService.getCurrentVendor();
    const subtotal = this.totals.subtotal();
    if (!vendor?.id || subtotal <= 0) {
      this.couponError.set("Ajoutez des produits avant d'appliquer un code.");
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
            this.couponError.set(
              this.couponFailureMessage(result.reason, result.minSubtotal)
            );
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
        return "Ce code n'est plus valide.";
      case 'EXHAUSTED':
        return "Ce code a atteint son nombre maximum d'utilisations.";
      case 'INACTIVE':
        return "Ce code n'est pas actif.";
      case 'BELOW_MIN_SUBTOTAL':
        return minSubtotal !== undefined
          ? `Panier minimum requis : ${minSubtotal.toFixed(2)} ${this.vendorService.getCurrentCurrency() ?? ''}`.trim()
          : 'Le panier ne respecte pas le minimum requis.';
      case 'NOT_FOUND':
      default:
        return 'Code invalide.';
    }
  }
}
