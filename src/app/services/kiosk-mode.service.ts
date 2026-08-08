import {
  Injectable,
  NgZone,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { MatDialog } from '@angular/material/dialog';

import { LayoutService } from './layout.service';
import { VendorService } from './vendor.service';
import { DiningPreferenceService } from './dining-preference.service';
import { AppState } from '../store/models/app.state';
import { clearCart } from '../store/actions/cart.actions';
import { selectCartItems } from '../store/selectors/cart.selectors';
import { CartItem } from '../store/models/app.state';
import { IdleWarningDialogComponent } from '../components/kiosk/idle-warning-dialog/idle-warning-dialog.component';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];

/**
 * Self-ordering kiosk mode (SPEC.md FR4).
 *
 * Activation: `vendors.kiosk_enabled` AND a landscape form factor — the
 * mounted-tablet posture. A kiosk-enabled vendor's phone customers keep
 * the normal storefront (plan T29/T30 assumption).
 *
 * Session lifecycle: the attract screen greets between customers; a tap
 * starts a session; after `idleMs` without input, a non-empty cart gets a
 * countdown dialog (`countdownMs`) before the session resets, an empty
 * cart returns to the attract screen silently. Idle handling never fires
 * while a dialog (e.g. checkout) is open.
 */
@Injectable({ providedIn: 'root' })
export class KioskModeService {
  private readonly layout = inject(LayoutService);
  private readonly vendorService = inject(VendorService);
  private readonly store = inject(Store<AppState>);
  private readonly diningPreferenceService = inject(DiningPreferenceService);
  private readonly dialog = inject(MatDialog);
  private readonly zone = inject(NgZone);

  /** Idle timings (SPEC: 60s -> 20s). E2e shortens them via window hooks. */
  private readonly idleMs =
    Number((window as any).__KIOSK_IDLE_MS__) > 0
      ? Number((window as any).__KIOSK_IDLE_MS__)
      : 60_000;
  private readonly countdownMs =
    Number((window as any).__KIOSK_COUNTDOWN_MS__) > 0
      ? Number((window as any).__KIOSK_COUNTDOWN_MS__)
      : 20_000;

  private readonly vendor = toSignal(this.vendorService.currentVendor$, {
    initialValue: null,
  });

  private readonly cartItems = toSignal(this.store.select(selectCartItems), {
    initialValue: [] as CartItem[],
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

  /** Attract screen visibility — true between customer sessions. */
  readonly attractVisible = signal(false);

  private idleTimer?: ReturnType<typeof setTimeout>;
  private readonly onActivity = () => {
    if (this.active() && !this.attractVisible()) {
      this.armIdleTimer();
    }
  };

  private wasActive = false;

  constructor() {
    effect(() => {
      const active = this.active();
      this.layout.setKioskMode(active);
      document.documentElement.classList.toggle('kiosk-mode', active);

      // Greet only on the inactive -> active TRANSITION: the effect
      // re-runs on every vendor emission, and re-showing the attract
      // screen mid-session would swallow the customer's taps.
      if (active && !this.wasActive) {
        this.attractVisible.set(true);
        this.bindActivityListeners();
      } else if (!active && this.wasActive) {
        this.attractVisible.set(false);
        this.unbindActivityListeners();
        this.clearIdleTimer();
      }
      this.wasActive = active;
    });
  }

  /** Customer tapped the attract screen — begin an ordering session. */
  startSession(): void {
    this.attractVisible.set(false);
    this.armIdleTimer();
  }

  /** Clear the customer's session: cart + dining preference (FR4). */
  resetSession(): void {
    this.store.dispatch(clearCart());
    this.diningPreferenceService.resetPreference();
  }

  /** End the session and return to the attract screen. */
  endSession(): void {
    this.resetSession();
    this.clearIdleTimer();
    this.attractVisible.set(true);
  }

  private bindActivityListeners(): void {
    this.zone.runOutsideAngular(() => {
      for (const event of ACTIVITY_EVENTS) {
        document.addEventListener(event, this.onActivity, { passive: true });
      }
    });
  }

  private unbindActivityListeners(): void {
    for (const event of ACTIVITY_EVENTS) {
      document.removeEventListener(event, this.onActivity);
    }
  }

  private armIdleTimer(): void {
    this.clearIdleTimer();
    this.zone.runOutsideAngular(() => {
      this.idleTimer = setTimeout(
        () => this.zone.run(() => this.onIdle()),
        this.idleMs
      );
    });
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = undefined;
    }
  }

  private onIdle(): void {
    if (!this.active() || this.attractVisible()) {
      return;
    }
    // Never interrupt an open dialog (checkout, customisations…): the
    // customer may legitimately be reading. Re-arm instead.
    if (this.dialog.openDialogs.length > 0) {
      this.armIdleTimer();
      return;
    }
    if ((this.cartItems() ?? []).length === 0) {
      // Nothing to lose — return to the attract screen silently.
      this.attractVisible.set(true);
      return;
    }
    const ref = this.dialog.open(IdleWarningDialogComponent, {
      maxWidth: '440px',
      disableClose: true,
      data: { countdownMs: this.countdownMs },
    });
    ref.afterClosed().subscribe((stillThere: boolean) => {
      if (stillThere) {
        this.armIdleTimer();
      } else {
        this.endSession();
      }
    });
  }
}
