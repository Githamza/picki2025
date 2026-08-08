import { Injectable, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';

import { LayoutService } from './layout.service';
import { VendorService } from './vendor.service';
import { DiningPreferenceService } from './dining-preference.service';
import { AppState } from '../store/models/app.state';
import { clearCart } from '../store/actions/cart.actions';

/**
 * Self-ordering kiosk mode (SPEC.md FR4).
 *
 * Activation: `vendors.kiosk_enabled` AND a landscape form factor — the
 * mounted-tablet posture. A kiosk-enabled vendor's phone customers keep
 * the normal storefront (plan T29/T30 assumption).
 *
 * When active, the LayoutService form factor is promoted to `kiosk`
 * (stepping up grids/type via the existing hooks) and the `.kiosk-mode`
 * root class enables the CSS step-up defined in styles.scss.
 */
@Injectable({ providedIn: 'root' })
export class KioskModeService {
  private readonly layout = inject(LayoutService);
  private readonly vendorService = inject(VendorService);
  private readonly store = inject(Store<AppState>);
  private readonly diningPreferenceService = inject(DiningPreferenceService);

  private readonly vendor = toSignal(this.vendorService.currentVendor$, {
    initialValue: null,
  });

  readonly active = computed(() => {
    const vendor = this.vendor() as { kiosk_enabled?: boolean } | null;
    if (!vendor?.kiosk_enabled) {
      return false;
    }
    // isLandscape (not formFactor) avoids self-reference once the form
    // factor is promoted to 'kiosk'; phones never qualify.
    const factor = this.layout.formFactor();
    return this.layout.isLandscape() && factor !== 'phone';
  });

  constructor() {
    effect(() => {
      const active = this.active();
      this.layout.setKioskMode(active);
      document.documentElement.classList.toggle('kiosk-mode', active);
    });
  }

  /** Clear the customer's session: cart + dining preference (FR4). */
  resetSession(): void {
    this.store.dispatch(clearCart());
    this.diningPreferenceService.resetPreference();
  }
}
