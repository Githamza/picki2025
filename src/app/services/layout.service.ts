import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';

/**
 * The storefront's four layout form factors (SPEC.md FR1).
 * `kiosk` is a mode, not a viewport size — it activates in Phase 6 via
 * KioskModeService; until then formFactor never returns it.
 */
export type FormFactor =
  | 'phone'
  | 'tablet-portrait'
  | 'tablet-landscape'
  | 'kiosk';

/**
 * Individual media queries observed by the service.
 * phonePortrait/phoneLandscape mirror the two halves of the CDK's
 * `Breakpoints.Handset` union — kept separate because BreakpointState
 * keys entries by individual query.
 */
export const LAYOUT_QUERIES = {
  phonePortrait: '(max-width: 599.98px) and (orientation: portrait)',
  phoneLandscape: '(max-width: 959.98px) and (orientation: landscape)',
  landscape: '(orientation: landscape)',
  coarsePointer: '(pointer: coarse)',
} as const;

/**
 * Single source of layout truth for the storefront (SPEC.md FR1).
 * Storefront components must consume this instead of BreakpointObserver;
 * direct BreakpointObserver use remains only in admin components.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly breakpointObserver = inject(BreakpointObserver);

  /** Flipped by KioskModeService in Phase 6; constant false until then. */
  private readonly kioskMode = signal(false);

  private readonly state = toSignal(
    this.breakpointObserver.observe(Object.values(LAYOUT_QUERIES)),
    {
      initialValue: { matches: false, breakpoints: {} } as BreakpointState,
    }
  );

  private matches(query: string): boolean {
    return this.state().breakpoints[query] ?? false;
  }

  readonly isLandscape = computed(() =>
    this.matches(LAYOUT_QUERIES.landscape)
  );

  readonly isTouch = computed(() =>
    this.matches(LAYOUT_QUERIES.coarsePointer)
  );

  readonly isKiosk = computed(() => this.kioskMode());

  readonly formFactor = computed<FormFactor>(() => {
    if (this.kioskMode()) {
      return 'kiosk';
    }
    const isPhone =
      this.matches(LAYOUT_QUERIES.phonePortrait) ||
      this.matches(LAYOUT_QUERIES.phoneLandscape);
    if (isPhone) {
      return 'phone';
    }
    return this.isLandscape() ? 'tablet-landscape' : 'tablet-portrait';
  });
}
