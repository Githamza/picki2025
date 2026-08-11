import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';

import { AppState } from '../../../store/models/app.state';
import * as PromotionalBannersActions from '../../../store/actions/promotional-banners.actions';
import * as PromotionalBannersSelectors from '../../../store/selectors/promotional-banners.selectors';
import { VendorService } from '../../../services/vendor.service';
import { KioskModeService } from '../../../services/kiosk-mode.service';

/** Maintenance gesture: this many taps on the hidden hotspot… */
const MAINTENANCE_TAP_COUNT = 5;
/** …within this window opens the device setup page (`/kiosk/setup`). */
const MAINTENANCE_TAP_WINDOW_MS = 3000;

/**
 * Kiosk attract screen (SPEC.md FR4): full-screen idle state cycling the
 * vendor's promotional banners (logo-only fallback), overlaid with
 * "Touchez pour commander". Any tap starts a session.
 */
@Component({
  selector: 'app-attract-screen',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="attract"
      (click)="start()"
      role="button"
      tabindex="0"
      (keydown)="start()"
      aria-label="Touchez pour commander"
    >
      @if (currentBanner(); as banner) {
        <img
          class="attract-banner"
          [src]="banner.image_url"
          [alt]="banner.title || ''"
        />
      } @else {
        <div class="attract-fallback">
          @if (vendor()?.logo_url) {
            <img
              class="attract-logo"
              [src]="vendor()?.logo_url"
              [alt]="vendor()?.business_name + ' logo'"
            />
          } @else {
            <mat-icon class="attract-logo-icon">restaurant</mat-icon>
          }
          <h1 class="attract-name storefront-display">
            {{ vendor()?.business_name }}
          </h1>
        </div>
      }

      <div class="attract-cta">
        <mat-icon aria-hidden="true">touch_app</mat-icon>
        <span>Touchez pour commander</span>
      </div>

      <!-- Hidden maintenance gesture: 5 taps here within 3s opens the
           device setup page (printer…). Deliberately invisible so
           customers only ever see "touch to order". -->
      <div
        class="maintenance-hotspot"
        (click)="onMaintenanceTap($event)"
        aria-hidden="true"
      ></div>
    </div>
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 2000;
        display: block;
      }
      .attract {
        width: 100%;
        height: 100%;
        background: var(--mat-sys-surface);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .attract-banner {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .attract-fallback {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 24px;
      }
      .attract-logo {
        width: 160px;
        height: 160px;
        object-fit: contain;
        border-radius: var(--mat-sys-corner-extra-large);
      }
      .attract-logo-icon {
        font-size: 120px;
        width: 120px;
        height: 120px;
        color: var(--mat-sys-primary);
      }
      .attract-name {
        margin: 0;
        color: var(--mat-sys-on-surface);
      }
      .attract-cta {
        position: absolute;
        bottom: 10vh;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px 40px;
        border-radius: 999px;
        background: var(--mat-sys-primary);
        color: var(--mat-sys-on-primary);
        font: var(--mat-sys-headline-small);
        box-shadow: var(--mat-sys-level3);
        animation: attract-pulse 2s ease-in-out infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .attract-cta {
          animation: none;
        }
      }
      @keyframes attract-pulse {
        0%,
        100% {
          transform: translateX(-50%) scale(1);
        }
        50% {
          transform: translateX(-50%) scale(1.06);
        }
      }
      .maintenance-hotspot {
        position: absolute;
        top: 0;
        right: 0;
        width: 110px;
        height: 110px;
      }
    `,
  ],
})
export class AttractScreenComponent implements OnInit, OnDestroy {
  private readonly store = inject(Store<AppState>);
  private readonly vendorService = inject(VendorService);
  private readonly kiosk = inject(KioskModeService);
  private readonly router = inject(Router);

  readonly vendor = toSignal(this.vendorService.currentVendor$, {
    initialValue: null as any,
  });

  private readonly banners = toSignal(
    this.vendorService.currentVendor$.pipe(
      switchMap((vendor) =>
        vendor
          ? this.store.select(
              PromotionalBannersSelectors.selectPromotionalBannersForVendor(
                vendor.id
              )
            )
          : of([])
      )
    ),
    { initialValue: [] as any[] }
  );

  private readonly index = signal(0);
  readonly currentBanner = computed(() => {
    const banners = this.banners();
    return banners.length ? banners[this.index() % banners.length] : null;
  });

  private rotation?: ReturnType<typeof setInterval>;

  private maintenanceTaps = 0;
  private maintenanceTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Load the vendor's banners into the store (same action the
    // promotional banner uses).
    effect(() => {
      const vendor = this.vendor();
      if (vendor) {
        this.store.dispatch(
          PromotionalBannersActions.loadPromotionalBanners({
            vendorId: vendor.id,
          })
        );
      }
    });
  }

  ngOnInit(): void {
    this.rotation = setInterval(() => {
      this.index.update((i) => i + 1);
    }, 6000);
  }

  ngOnDestroy(): void {
    if (this.rotation) {
      clearInterval(this.rotation);
    }
    if (this.maintenanceTimer) {
      clearTimeout(this.maintenanceTimer);
    }
  }

  start(): void {
    this.kiosk.startSession();
  }

  /**
   * Hidden hotspot taps. Stops propagation so a stray tap in the corner
   * never starts a customer session; a lone tap simply does nothing.
   */
  onMaintenanceTap(event: Event): void {
    event.stopPropagation();

    this.maintenanceTaps++;
    if (this.maintenanceTaps >= MAINTENANCE_TAP_COUNT) {
      this.maintenanceTaps = 0;
      if (this.maintenanceTimer) {
        clearTimeout(this.maintenanceTimer);
        this.maintenanceTimer = undefined;
      }
      this.router.navigateByUrl('/kiosk/setup');
      return;
    }

    if (this.maintenanceTimer) {
      clearTimeout(this.maintenanceTimer);
    }
    this.maintenanceTimer = setTimeout(() => {
      this.maintenanceTaps = 0;
      this.maintenanceTimer = undefined;
    }, MAINTENANCE_TAP_WINDOW_MS);
  }
}
