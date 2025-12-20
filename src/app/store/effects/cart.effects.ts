import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { map } from 'rxjs/operators';
import * as CartActions from '../actions/cart.actions';
import { DiningPreferenceService } from '../../services/dining-preference.service';
import { VendorService } from '../../services/vendor.service';
import { DeliverySelectionService } from '../../services/delivery/delivery-selection.service';

const DELIVERY_FEE_PRODUCT_ID = -9999;

@Injectable()
export class CartEffects {
  private actions$ = inject(Actions);
  private diningPreference = inject(DiningPreferenceService);
  private vendorService = inject(VendorService);
  private deliverySelection = inject(DeliverySelectionService);

  syncDeliveryFeeOnAdd$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CartActions.addToCart),
      map(({ product }) => {
        // Avoid recursion: adding the delivery fee item itself should not trigger fee updates.
        if (product.id === DELIVERY_FEE_PRODUCT_ID) {
          return CartActions.removeDeliveryFee();
        }

        const isDelivery = this.diningPreference.diningPreference() === 'delivery';
        if (!isDelivery) {
          return CartActions.removeDeliveryFee();
        }

        const vendor = this.vendorService.getCurrentVendor();
        const deliverySystem = (vendor as any)?.delivery_system === 'own' ? 'own' : 'picki';

        if (deliverySystem === 'own') {
          const amount = Number((vendor as any)?.own_delivery_price ?? 0);
          return CartActions.upsertDeliveryFee({
            amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
          });
        }

        // Picki: use current best quote if available (no extra calculation here)
        const best = this.deliverySelection.bestOption();
        const amount = best ? best.totalAmount / 100 : 0;
        return CartActions.upsertDeliveryFee({
          amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
        });
      })
    )
  );
}

