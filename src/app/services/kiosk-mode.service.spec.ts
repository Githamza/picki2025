import { TestBed } from '@angular/core/testing';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { BehaviorSubject } from 'rxjs';
import { provideMockStore } from '@ngrx/store/testing';

import { KioskModeService } from './kiosk-mode.service';
import { LayoutService, LAYOUT_QUERIES } from './layout.service';
import { VendorService } from './vendor.service';
import { DiningPreferenceService } from './dining-preference.service';

describe('KioskModeService', () => {
  let breakpoints$: BehaviorSubject<BreakpointState>;
  let vendor$: BehaviorSubject<any>;

  function emit(matched: string[]): void {
    const breakpoints: Record<string, boolean> = {};
    for (const query of Object.values(LAYOUT_QUERIES)) {
      breakpoints[query] = matched.includes(query);
    }
    breakpoints$.next({ matches: matched.length > 0, breakpoints });
  }

  /** Simulate the Capacitor wrapper (the tablet APK) — must be set
   *  before the service is instantiated, like the real wrapper. */
  function simulateKioskDevice(): void {
    (window as any).__KIOSK_DEVICE__ = true;
  }

  beforeEach(() => {
    delete (window as any).__KIOSK_DEVICE__;
    breakpoints$ = new BehaviorSubject<BreakpointState>({
      matches: false,
      breakpoints: {},
    });
    vendor$ = new BehaviorSubject<any>(null);

    TestBed.configureTestingModule({
      providers: [
        provideMockStore(),
        {
          provide: BreakpointObserver,
          useValue: { observe: () => breakpoints$.asObservable() },
        },
        { provide: VendorService, useValue: { currentVendor$: vendor$.asObservable() } },
        { provide: DiningPreferenceService, useValue: { resetPreference: () => {} } },
      ],
    });
  });

  afterEach(() => {
    delete (window as any).__KIOSK_DEVICE__;
    document.documentElement.classList.remove('kiosk-mode');
  });

  it('is inactive without a kiosk-enabled vendor', () => {
    simulateKioskDevice();
    const service = TestBed.inject(KioskModeService);
    vendor$.next({ kiosk_enabled: false });
    TestBed.tick();
    expect(service.active()).toBeFalse();
  });

  it('activates for a kiosk-enabled vendor on a kiosk device', () => {
    simulateKioskDevice();
    const service = TestBed.inject(KioskModeService);
    vendor$.next({ kiosk_enabled: true });
    TestBed.tick();
    expect(service.active()).toBeTrue();
    expect(
      document.documentElement.classList.contains('kiosk-mode')
    ).toBeTrue();
  });

  it('activates regardless of orientation (auto-rotate)', () => {
    simulateKioskDevice();
    const service = TestBed.inject(KioskModeService);
    // Portrait posture: kiosk activation must not care.
    emit([LAYOUT_QUERIES.phonePortrait]);
    vendor$.next({ kiosk_enabled: true });
    TestBed.tick();
    expect(service.active()).toBeTrue();
  });

  it('stays inactive in a browser even when the vendor flag is on', () => {
    const service = TestBed.inject(KioskModeService);
    emit([LAYOUT_QUERIES.landscape]);
    vendor$.next({ kiosk_enabled: true });
    TestBed.tick();
    expect(service.active()).toBeFalse();
    expect(
      document.documentElement.classList.contains('kiosk-mode')
    ).toBeFalse();
  });

  it('promotes the LayoutService form factor to kiosk when active', () => {
    simulateKioskDevice();
    const service = TestBed.inject(KioskModeService);
    const layout = TestBed.inject(LayoutService);
    vendor$.next({ kiosk_enabled: true });
    TestBed.tick();
    expect(service.active()).toBeTrue();
    expect(layout.formFactor()).toBe('kiosk');
  });

  it('deactivates when the vendor changes to a non-kiosk one', () => {
    simulateKioskDevice();
    const service = TestBed.inject(KioskModeService);
    vendor$.next({ kiosk_enabled: true });
    TestBed.tick();
    expect(service.active()).toBeTrue();

    vendor$.next({ kiosk_enabled: false });
    TestBed.tick();
    expect(service.active()).toBeFalse();
    expect(
      document.documentElement.classList.contains('kiosk-mode')
    ).toBeFalse();
  });
});
