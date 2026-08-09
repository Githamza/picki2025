import { Injectable, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Store } from '@ngrx/store';

import { ProductService, Product } from './product.service';
import { VendorService } from './vendor.service';
import { DiningPreferenceService } from './dining-preference.service';
import { selectCartItems } from '../store/selectors/cart.selectors';
import { CartItem } from '../store/models/app.state';
import {
  CartMultiStepMetadata,
  ProductStep,
} from '../models/multi-step-product.model';

// One post-add offer, at most, per add — and each tier at most once per
// order session (SPEC-UPSELL.md). The session resets when the cart empties.
export type UpsellOffer =
  | { tier: 'convert'; menu: Product; replacedProduct: Product }
  | { tier: 'pool'; products: Product[] };

export const POOL_OFFER_MAX_ITEMS = 4;

// Convert-accept preselection is best-effort and unambiguous-only (plan
// decision 6): exactly one option referencing the product, in a single-select
// step. Anything else returns null and the menu flow opens unselected.
export function findUnambiguousPreselection(
  steps: ProductStep[],
  productId: number
): { stepId: number; optionId: number } | null {
  const matches = steps.flatMap((step) =>
    (step.options ?? [])
      .filter((option) => option.productId === productId)
      .map((option) => ({ step, option }))
  );
  if (matches.length !== 1) {
    return null;
  }
  const { step, option } = matches[0];
  if (step.stepType !== 'single-select') {
    return null;
  }
  return { stepId: step.id, optionId: option.id };
}

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

  // Where the upsell page returns to on dismiss (the grid the customer came
  // from); staged together with the offer.
  private _returnPath = signal<string[]>(['promotional-banner', 'products']);
  readonly returnPath = this._returnPath.asReadonly();

  // Convert-accept handoff: the menu flow preselects this product's option
  // when unambiguous (SPEC-UPSELL.md). Session-scoped, never in the URL.
  private _pendingPreselect = signal<{ menuId: number; productId: number } | null>(null);
  readonly pendingPreselect = this._pendingPreselect.asReadonly();

  private cartItems: CartItem[] = [];

  constructor() {
    this.store.select(selectCartItems).subscribe((items) => {
      this.cartItems = items;
      if (items.length === 0) {
        this.convertTierShown.set(false);
        this.poolTierShown.set(false);
        this._pendingOffer.set(null);
        this._pendingPreselect.set(null);
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

  stageOffer(offer: UpsellOffer, returnPath?: string[]): void {
    this._pendingOffer.set(offer);
    if (returnPath) {
      this._returnPath.set(returnPath);
    }
  }

  clearOffer(): void {
    this._pendingOffer.set(null);
  }

  stagePreselect(menuId: number, productId: number): void {
    this._pendingPreselect.set({ menuId, productId });
  }

  consumePreselect(menuId: number): number | null {
    const pending = this._pendingPreselect();
    if (!pending || pending.menuId !== menuId) {
      return null;
    }
    this._pendingPreselect.set(null);
    return pending.productId;
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
