import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Product } from '../../services/product.service';
import { CartItem } from '../../store/models/app.state';
import { VendorCurrencyPipe } from '../../shared/pipes/vendor-currency.pipe';

@Component({
  selector: 'app-accessories-strip',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, VendorCurrencyPipe],
  template: `
    <div>
      <h4 class="accessories-title">{{ stripTitle() }}</h4>
      <div class="accessories-scroll">
        @for (accessory of accessories(); track accessory.id) {
          @let cartItem = getCartItem(accessory.id);
          <div
            class="accessory-card"
            [class.selected]="cartItem"
            [class.disabled]="isOutOfStock(accessory)"
          >
            <span class="accessory-emoji">{{ accessory.iconEmoji || '📦' }}</span>
            <span class="accessory-name">{{ accessory.name }}</span>
            <span
              class="accessory-price"
              [style.visibility]="accessory.price > 0 ? 'visible' : 'hidden'"
            >{{ accessory.price | vendorCurrency }}</span>
            <div class="accessory-controls">
              @if (cartItem) {
                <button
                  mat-mini-fab
                  class="control-btn"
                  [color]="cartItem.quantity === 1 ? 'warn' : 'primary'"
                  [attr.aria-label]="
                    (cartItem.quantity === 1 ? 'Retirer ' : 'Réduire ') +
                    accessory.name
                  "
                  (click)="onDecrement(accessory.id, cartItem.quantity)"
                >
                  <mat-icon>{{ cartItem.quantity === 1 ? 'delete' : 'remove' }}</mat-icon>
                </button>
                <span class="qty">{{ cartItem.quantity }}</span>
                <button
                  mat-mini-fab
                  color="primary"
                  class="control-btn"
                  [attr.aria-label]="'Augmenter ' + accessory.name"
                  (click)="increment.emit(accessory.id)"
                  [disabled]="isIncrementDisabled(accessory, cartItem)"
                >
                  <mat-icon>add</mat-icon>
                </button>
              } @else {
                <button
                  mat-mini-fab
                  color="primary"
                  class="control-btn"
                  [attr.aria-label]="'Ajouter ' + accessory.name"
                  (click)="add.emit(accessory)"
                  [disabled]="isOutOfStock(accessory)"
                >
                  <mat-icon>add</mat-icon>
                </button>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`


    .accessories-title {
      margin: 0 0 8px 0;
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-on-surface-variant);
    }

    .accessories-scroll {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      padding-bottom: 4px;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .accessories-scroll::-webkit-scrollbar {
      display: none;
    }

    .accessory-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      min-width: 100px;
      padding: 10px 8px;
      border-radius: 12px;
      background: var(--mat-sys-surface-container-low);
      border: 2px solid transparent;
      transition: border-color 0.15s ease, background-color 0.15s ease;
      text-align: center;
    }

    @media (min-width: 400px) {
      .accessory-card {
        min-width: 120px;
      }
    }

    .accessory-card.selected {
      border-color: var(--mat-sys-primary);
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, var(--mat-sys-surface-container-low));
    }

    .accessory-card.disabled {
      opacity: 0.5;
      pointer-events: none;
    }

    .accessory-emoji {
      font-size: 24px;
      line-height: 1;
    }

    .accessory-name {
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      width: 100%;
    }

    .accessory-price {
      font: var(--mat-sys-label-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .accessory-controls {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
    }

    .control-btn {
      width: 28px !important;
      height: 28px !important;

      ::ng-deep .mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .qty {
      min-width: 20px;
      text-align: center;
      font-weight: bold;
      font: var(--mat-sys-label-large);
    }
  `],
})
export class AccessoriesStripComponent {
  accessories = input.required<Product[]>();
  cartAccessories = input.required<CartItem[]>();
  // The strip is reused by the upsell surfaces with a different heading
  // ("Pour accompagner"); named stripTitle to avoid the native title attribute.
  stripTitle = input<string>('Accessoires');
  add = output<Product>();
  increment = output<number>();
  decrement = output<number>();
  remove = output<number>();

  onDecrement(productId: number, currentQty: number) {
    if (currentQty <= 1) {
      this.remove.emit(productId);
    } else {
      this.decrement.emit(productId);
    }
  }

  getCartItem(productId: number): CartItem | undefined {
    return this.cartAccessories().find((item) => item.product.id === productId);
  }

  isOutOfStock(accessory: Product): boolean {
    return accessory.stockQuantity != null && accessory.stockQuantity <= 0;
  }

  isIncrementDisabled(accessory: Product, cartItem: CartItem): boolean {
    if (accessory.maxQuantityPerOrder != null && cartItem.quantity >= accessory.maxQuantityPerOrder) {
      return true;
    }
    if (accessory.stockQuantity == null) return false;
    return cartItem.quantity >= accessory.stockQuantity;
  }
}
