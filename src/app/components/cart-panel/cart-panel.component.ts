import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { CartContentComponent } from '../../shared/components/cart-content/cart-content.component';
import { CheckoutService } from '../../services/checkout.service';

/**
 * Persistent cart surface for tablet-landscape / kiosk (SPEC.md FR6/FR7):
 * the order summary is always visible, never hidden behind a badge.
 * Same shared body and checkout path as the bottom sheet.
 */
@Component({
  selector: 'app-cart-panel',
  standalone: true,
  imports: [MatIconModule, CartContentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="cart-panel" aria-label="Mon panier">
      <h2 class="panel-title">
        <mat-icon aria-hidden="true">shopping_cart</mat-icon>
        Mon panier
      </h2>
      <app-cart-content
        [stockErrors]="checkoutService.stockErrors()"
        (checkoutRequested)="checkout()"
      />
    </aside>
  `,
  styles: [
    `
      :host {
        display: flex;
        min-height: 0;
      }
      .cart-panel {
        display: flex;
        flex-direction: column;
        min-height: 0;
        width: 100%;
        padding: 16px;
        background: var(--mat-sys-surface-container-low);
        border-left: 1px solid var(--mat-sys-outline-variant);
      }
      .panel-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 12px 0;
        font: var(--mat-sys-title-large);
        color: var(--mat-sys-on-surface);
      }
      .panel-title mat-icon {
        color: var(--mat-sys-primary);
      }
    `,
  ],
})
export class CartPanelComponent {
  protected readonly checkoutService = inject(CheckoutService);

  checkout(): void {
    // No surface to dismiss — the panel persists through checkout.
    this.checkoutService.checkout({ orderSource: 'cart-panel' });
  }
}
