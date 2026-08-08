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

  beforeEach(() => {
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
    document.documentElement.classList.remove('kiosk-mode');
  });

  it('is inactive without a kiosk-enabled vendor', () => {
    const service = TestBed.inject(KioskModeService);
    emit([LAYOUT_QUERIES.landscape]);
    vendor$.next({ kiosk_enabled: false });
    TestBed.tick();
    expect(service.active()).toBeFalse();
  });

  it('activates for a kiosk-enabled vendor on landscape', () => {
    const service = TestBed.inject(KioskModeService);
    emit([LAYOUT_QUERIES.landscape]);
    vendor$.next({ kiosk_enabled: true });
    TestBed.tick();
    expect(service.active()).toBeTrue();
    expect(
      document.documentElement.classList.contains('kiosk-mode')
    ).toBeTrue();
  });

  it('stays inactive on phones even when the vendor flag is on', () => {
    const service = TestBed.inject(KioskModeService);
    emit([LAYOUT_QUERIES.phonePortrait]);
    vendor$.next({ kiosk_enabled: true });
    TestBed.tick();
    expect(service.active()).toBeFalse();
  });

  it('promotes the LayoutService form factor to kiosk when active', () => {
    const service = TestBed.inject(KioskModeService);
    const layout = TestBed.inject(LayoutService);
    emit([LAYOUT_QUERIES.landscape]);
    vendor$.next({ kiosk_enabled: true });
    TestBed.tick();
    expect(service.active()).toBeTrue();
    expect(layout.formFactor()).toBe('kiosk');
  });

  it('deactivates when the vendor changes to a non-kiosk one', () => {
    const service = TestBed.inject(KioskModeService);
    emit([LAYOUT_QUERIES.landscape]);
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
