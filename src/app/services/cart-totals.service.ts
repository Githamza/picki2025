import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import {
  selectAppliedCoupon,
  selectCartItems,
} from '../store/selectors/cart.selectors';
import { AppState, CartItem } from '../store/models/app.state';
import { VendorService } from './vendor.service';
import { DiningPreferenceService } from './dining-preference.service';
import { DeliverySelectionService } from './delivery/delivery-selection.service';

const DELIVERY_FEE_PRODUCT_ID = -9999;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Single source of truth for cart totals (subtotal, service fee, delivery fee,
 * coupon discount, grand total). Exposed as signals so components can render
 * with OnPush + auto change detection without duplicating arithmetic.
 *
 * Conventions:
 *   - All amounts in vendor currency major units (e.g. 12.50 EUR).
 *   - The coupon discount applies to the products subtotal ONLY. Service fee
 *     is always computed from the original subtotal (per spec). Delivery fee
 *     is unaffected.
 */
@Injectable({ providedIn: 'root' })
export class CartTotalsService {
  private readonly store = inject(Store<AppState>);
  private readonly vendor = inject(VendorService);
  private readonly diningPref = inject(DiningPreferenceService);
  private readonly deliverySelection = inject(DeliverySelectionService);

  readonly items = toSignal(this.store.select(selectCartItems), {
    initialValue: [] as CartItem[],
  });

  readonly coupon = toSignal(this.store.select(selectAppliedCoupon), {
    initialValue: undefined,
  });

  readonly subtotal = computed(() => {
    return round2(
      this.items()
        .filter((it) => it.product.id !== DELIVERY_FEE_PRODUCT_ID)
        .reduce((sum, item) => {
          const itemTotal =
            item.totalPrice ?? item.product.price * item.quantity;
          return sum + itemTotal;
        }, 0)
    );
  });

  readonly serviceFee = computed(() => {
    const subtotal = this.subtotal();
    if (subtotal <= 0) return 0;
    const v = this.vendor.getCurrentVendor();
    const ratePercent = v?.service_fee_rate_percent ?? 0;
    const fixedFee = v?.service_fee_fixed ?? 0;
    const fee = subtotal * (ratePercent / 100) + fixedFee;
    return fee > 0 ? round2(fee) : 0;
  });

  readonly deliveryFee = computed(() => {
    if (this.diningPref.diningPreference() !== 'delivery') return 0;
    const items = this.items();
    const cartLine = items.find(
      (i) => i.product.id === DELIVERY_FEE_PRODUCT_ID
    );
    if (cartLine) {
      return round2(
        cartLine.totalPrice ?? cartLine.product.price * cartLine.quantity
      );
    }
    const v = this.vendor.getCurrentVendor();
    if ((v as any)?.delivery_system === 'own') {
      const amount = Number((v as any)?.own_delivery_price ?? 0);
      return Number.isFinite(amount) && amount > 0 ? round2(amount) : 0;
    }
    const best = this.deliverySelection.bestOption();
    return best ? round2(best.totalAmount / 100) : 0;
  });

  readonly discount = computed(() => {
    const c = this.coupon();
    if (!c) return 0;
    return round2(Math.min(c.discountAmount, this.subtotal()));
  });

  readonly total = computed(() => {
    const sub = this.subtotal();
    const post = Math.max(0, sub - this.discount());
    return round2(post + this.serviceFee() + this.deliveryFee());
  });
}
