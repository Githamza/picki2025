import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { Store } from '@ngrx/store';

import { UpsellService, UpsellOffer } from '../../services/upsell.service';
import { VendorNavigationService } from '../../services/vendor-navigation.service';
import { Product } from '../../services/product.service';
import { CartItem } from '../../store/models/app.state';
import { selectCartItems } from '../../store/selectors/cart.selectors';
import {
  addToCart,
  incrementCartItem,
  decrementCartItem,
  removeCartItem,
} from '../../store/actions/cart.actions';
import { VendorCurrencyPipe } from '../../shared/pipes/vendor-currency.pipe';
import { AccessoriesStripComponent } from '../accessories-strip/accessories-strip.component';
import { PRODUCT_PLACEHOLDER_IMAGE } from '../../shared/utils/image-placeholder';

// Post-add upsell page (SPEC-UPSELL.md): one decision per screen, focus-shell
// styling. A routed page — never a dialog — so the kiosk idle-warning's
// open-dialog counting is untouched. Entered only via a staged offer; a direct
// visit redirects to the grid.
@Component({
  selector: 'app-upsell-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    VendorCurrencyPipe,
    AccessoriesStripComponent,
  ],
  template: `
    @if (offer(); as currentOffer) {
      <div class="upsell-page">
        @if (currentOffer.tier === 'convert') {
          <h1 class="upsell-title">Et si vous en faisiez un menu&nbsp;?</h1>
          <p class="upsell-subtitle">
            {{ currentOffer.replacedProduct.name }} existe aussi en menu.
          </p>
          <div class="menu-card">
            <img
              class="menu-image"
              [src]="currentOffer.menu.imageUrl || placeholderImage"
              [alt]="currentOffer.menu.name"
            />
            <div class="menu-info">
              <span class="menu-name">{{ currentOffer.menu.name }}</span>
              <span class="menu-description" *ngIf="currentOffer.menu.shortDescription">
                {{ currentOffer.menu.shortDescription }}
              </span>
              <span class="menu-price">{{ currentOffer.menu.price | vendorCurrency }}</span>
            </div>
          </div>
          <div class="upsell-actions">
            <button matButton="filled" class="accept-button" (click)="acceptConvert()">
              Choisir le menu
            </button>
            <button matButton class="dismiss-button" (click)="dismiss()">
              Non merci
            </button>
          </div>
        } @else {
          <h1 class="upsell-title">Une petite soif&nbsp;? 🥤</h1>
          <p class="upsell-subtitle">Complétez votre commande</p>
          <app-accessories-strip
            stripTitle="Nos suggestions"
            [accessories]="currentOffer.products"
            [cartAccessories]="cartItems()"
            (add)="onPoolAdd($event)"
            (increment)="onPoolIncrement($event)"
            (decrement)="onPoolDecrement($event)"
            (remove)="onPoolRemove($event)"
          ></app-accessories-strip>
          <div class="upsell-actions">
            <button
              matButton="filled"
              class="dismiss-button pool-continue"
              (click)="dismiss()"
            >
              {{ hasAddedSuggestion() ? 'Continuer' : 'Non merci' }}
            </button>
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        background: var(--mat-sys-surface);
        min-height: 100%;
      }

      .upsell-page {
        max-width: 560px;
        margin: 0 auto;
        padding: 32px 16px 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        text-align: center;
      }

      .upsell-title {
        margin: 0;
        font: var(--mat-sys-headline-medium);
        color: var(--mat-sys-on-surface);
      }

      .upsell-subtitle {
        margin: 0;
        font: var(--mat-sys-body-medium);
        color: var(--mat-sys-on-surface-variant);
      }

      .menu-card {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        border-radius: var(--mat-sys-corner-large);
        background: var(--mat-sys-surface-container-low);
        text-align: left;
      }

      .menu-image {
        width: 96px;
        height: 96px;
        object-fit: cover;
        border-radius: var(--mat-sys-corner-medium);
        flex-shrink: 0;
      }

      .menu-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }

      .menu-name {
        font: var(--mat-sys-title-medium);
        color: var(--mat-sys-on-surface);
      }

      .menu-description {
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);
      }

      .menu-price {
        font: var(--mat-sys-title-small);
        color: var(--mat-sys-on-surface);
      }

      .upsell-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 8px;
      }

      .upsell-actions button {
        width: 100%;
        height: 48px;
      }

      app-accessories-strip {
        text-align: left;
      }
    `,
  ],
})
export class UpsellPageComponent implements OnInit {
  private upsellService = inject(UpsellService);
  private vendorNavigation = inject(VendorNavigationService);
  private store = inject(Store);
  private destroyRef = inject(DestroyRef);

  readonly placeholderImage = PRODUCT_PLACEHOLDER_IMAGE;
  readonly offer = this.upsellService.pendingOffer;
  cartItems = signal<CartItem[]>([]);

  ngOnInit(): void {
    if (!this.offer()) {
      this.vendorNavigation.navigateWithVendor(this.upsellService.returnPath());
      return;
    }
    this.store
      .select(selectCartItems)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => this.cartItems.set(items));
  }

  hasAddedSuggestion(): boolean {
    const currentOffer = this.offer();
    if (currentOffer?.tier !== 'pool') {
      return false;
    }
    const poolIds = new Set(currentOffer.products.map((p) => p.id));
    return this.cartItems().some((item) => poolIds.has(item.product.id));
  }

  acceptConvert(): void {
    const currentOffer = this.offer();
    if (currentOffer?.tier !== 'convert') {
      return;
    }
    this.store.dispatch(
      removeCartItem({ productId: currentOffer.replacedProduct.id })
    );
    this.upsellService.stagePreselect(
      currentOffer.menu.id,
      currentOffer.replacedProduct.id
    );
    this.upsellService.clearOffer();
    this.vendorNavigation.navigateWithVendor(['product', currentOffer.menu.name]);
  }

  dismiss(): void {
    this.upsellService.clearOffer();
    this.vendorNavigation.navigateWithVendor(this.upsellService.returnPath());
  }

  onPoolAdd(product: Product): void {
    this.store.dispatch(addToCart({ product, quantity: 1 }));
  }

  onPoolIncrement(productId: number): void {
    this.store.dispatch(incrementCartItem({ productId }));
  }

  onPoolDecrement(productId: number): void {
    this.store.dispatch(decrementCartItem({ productId }));
  }

  onPoolRemove(productId: number): void {
    this.store.dispatch(removeCartItem({ productId }));
  }
}
