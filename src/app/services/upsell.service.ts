import { Injectable, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Store } from '@ngrx/store';

import { ProductService, Product } from './product.service';
import { VendorService } from './vendor.service';
import { DiningPreferenceService } from './dining-preference.service';
import { selectCartItems } from '../store/selectors/cart.selectors';
import { CartItem } from '../store/models/app.state';
import { CartMultiStepMetadata } from '../models/multi-step-product.model';

// One post-add offer, at most, per add — and each tier at most once per
// order session (SPEC-UPSELL.md). The session resets when the cart empties.
export type UpsellOffer =
  | { tier: 'convert'; menu: Product; replacedProduct: Product }
  | { tier: 'pool'; products: Product[] };

export const POOL_OFFER_MAX_ITEMS = 4;

@Injectable({ providedIn: 'root' })
export class UpsellService {
  private store = inject(Store);
  private productService = inject(ProductService);
  private vendorService = inject(VendorService);
  private diningPreferenceService = inject(DiningPreferenceService);

  private convertTierShown = signal(false);
  private poolTierShown = signal(false);

  // Staged by the post-add hooks, consumed by the upsell page.
  private _pendingOffer = signal<UpsellOffer | null>(null);
  readonly pendingOffer = this._pendingOffer.asReadonly();

  private cartItems: CartItem[] = [];

  constructor() {
    this.store.select(selectCartItems).subscribe((items) => {
      this.cartItems = items;
      if (items.length === 0) {
        this.convertTierShown.set(false);
        this.poolTierShown.set(false);
        this._pendingOffer.set(null);
      }
    });
  }

  decidePostAddOffer(addedProduct: Product): Observable<UpsellOffer | null> {
    return this.convertOffer(addedProduct).pipe(
      switchMap((offer) => (offer ? of(offer) : this.poolOffer()))
    );
  }

  private convertOffer(added: Product): Observable<UpsellOffer | null> {
    if (this.convertTierShown() || added.isMultiStep) {
      return of(null);
    }
    const vendor = this.vendorService.getCurrentVendor();
    if (!vendor) {
      return of(null);
    }
    return this.productService.getMenusContaining(added.id, vendor.id).pipe(
      map((menus) => {
        if (menus.length === 0) {
          return null;
        }
        const cheapest = [...menus].sort((a, b) => a.price - b.price)[0];
        this.convertTierShown.set(true);
        return {
          tier: 'convert' as const,
          menu: cheapest,
          replacedProduct: added,
        };
      })
    );
  }

  private poolOffer(): Observable<UpsellOffer | null> {
    if (this.poolTierShown()) {
      return of(null);
    }
    const vendor = this.vendorService.getCurrentVendor();
    const orderType = this.diningPreferenceService.diningPreference();
    if (!vendor || !orderType) {
      return of(null);
    }
    return this.productService.getUpsellPool(vendor.id, orderType).pipe(
      map((pool) => {
        if (pool.length === 0) {
          return null;
        }
        if (this.cartContainsAny(new Set(pool.map((p) => p.id)))) {
          return null;
        }
        this.poolTierShown.set(true);
        return {
          tier: 'pool' as const,
          products: pool.slice(0, POOL_OFFER_MAX_ITEMS),
        };
      })
    );
  }

  stageOffer(offer: UpsellOffer): void {
    this._pendingOffer.set(offer);
  }

  clearOffer(): void {
    this._pendingOffer.set(null);
  }

  // Pool detection is nested-aware: a drink inside a purchased menu counts
  // (same walk as selectCartQuantityMap).
  private cartContainsAny(productIds: ReadonlySet<number>): boolean {
    for (const item of this.cartItems) {
      if (productIds.has(item.product.id)) {
        return true;
      }
      const metadata = item.metadata as CartMultiStepMetadata | undefined;
      if (metadata?.stepSelections) {
        for (const step of metadata.stepSelections) {
          for (const option of step.selectedOptions) {
            if (option.productId && productIds.has(option.productId)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }
}
