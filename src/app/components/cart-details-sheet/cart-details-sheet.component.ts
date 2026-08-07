import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatBottomSheetRef,
  MatBottomSheetModule,
} from '@angular/material/bottom-sheet';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

import { CartContentComponent } from '../../shared/components/cart-content/cart-content.component';
import { DiningPreferenceService } from '../../services/dining-preference.service';
import { CheckoutService } from '../../services/checkout.service';
import { VendorNavigationService } from '../../services/vendor-navigation.service';

/**
 * Bottom-sheet cart surface (phone / tablet portrait).
 * Thin wrapper (SPEC.md FR7): the body is the shared CartContentComponent,
 * order submission is CheckoutService. The persistent landscape panel is
 * the other wrapper around the same pieces.
 */
@Component({
  selector: 'app-cart-details-sheet',
  imports: [
    CommonModule,
    MatBottomSheetModule,
    MatIconModule,
    MatButtonModule,
    CartContentComponent,
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

      <!-- Shared cart body (FR7) -->
      <app-cart-content
        [stockErrors]="checkoutService.stockErrors()"
        (checkoutRequested)="checkout()"
      />
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
      .close-btn {
        position: absolute;
        top: 12px;
        right: 12px;
        z-index: 10;
        background: var(--mat-sys-surface);
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
    `,
  ],
})
export class CartDetailsSheetComponent {
  readonly diningPreferenceService = inject(DiningPreferenceService);
  protected readonly checkoutService = inject(CheckoutService);
  private readonly bottomSheetRef = inject(
    MatBottomSheetRef<CartDetailsSheetComponent>
  );
  private readonly router = inject(Router);
  private readonly vendorNavigation = inject(VendorNavigationService);

  checkout(): void {
    this.checkoutService.checkout({
      onDismiss: () => this.close(),
      orderSource: 'cart-sheet',
    });
  }

  close(): void {
    this.bottomSheetRef.dismiss();
  }

  isOnCartDetailsPage(): boolean {
    const currentUrl = this.router.url;
    const vendorSlug = this.vendorNavigation.getVendorSlug();
    return vendorSlug
      ? currentUrl.includes(`/${vendorSlug}/cartdetails`)
      : currentUrl.startsWith('/cartdetails');
  }

  changeDiningPreference(): void {
    this.close();
    // Navigate to the dining preference route with vendor context
    this.vendorNavigation.navigateWithVendor('dining-preference');
  }
}
