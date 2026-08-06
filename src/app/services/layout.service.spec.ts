import { TestBed } from '@angular/core/testing';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { BehaviorSubject } from 'rxjs';

import { LayoutService, LAYOUT_QUERIES } from './layout.service';

describe('LayoutService', () => {
  let state$: BehaviorSubject<BreakpointState>;

  /** Emit a breakpoint state where exactly `matched` queries are true. */
  function emit(matched: string[]): void {
    const breakpoints: Record<string, boolean> = {};
    for (const query of Object.values(LAYOUT_QUERIES)) {
      breakpoints[query] = matched.includes(query);
    }
    state$.next({ matches: matched.length > 0, breakpoints });
  }

  function createService(): LayoutService {
    return TestBed.inject(LayoutService);
  }

  beforeEach(() => {
    state$ = new BehaviorSubject<BreakpointState>({
      matches: false,
      breakpoints: {},
    });

    TestBed.configureTestingModule({
      providers: [
        {
          provide: BreakpointObserver,
          useValue: { observe: () => state$.asObservable() },
        },
      ],
    });
  });

  it('reports phone for a portrait handset (390x844)', () => {
    const service = createService();
    emit([LAYOUT_QUERIES.phonePortrait]);
    expect(service.formFactor()).toBe('phone');
    expect(service.isLandscape()).toBeFalse();
  });

  it('reports phone for a landscape handset (844x390)', () => {
    const service = createService();
    emit([LAYOUT_QUERIES.phoneLandscape, LAYOUT_QUERIES.landscape]);
    expect(service.formFactor()).toBe('phone');
    expect(service.isLandscape()).toBeTrue();
  });

  it('reports tablet-portrait for a portrait tablet (834x1194)', () => {
    const service = createService();
    emit([]);
    expect(service.formFactor()).toBe('tablet-portrait');
    expect(service.isLandscape()).toBeFalse();
  });

  it('reports tablet-landscape for a landscape tablet (1194x834)', () => {
    const service = createService();
    emit([LAYOUT_QUERIES.landscape]);
    expect(service.formFactor()).toBe('tablet-landscape');
    expect(service.isLandscape()).toBeTrue();
  });

  it('reports tablet-landscape for a kiosk-sized viewport (1920x1080) while kiosk mode is off', () => {
    const service = createService();
    emit([LAYOUT_QUERIES.landscape]);
    expect(service.formFactor()).toBe('tablet-landscape');
  });

  it('follows orientation flips', () => {
    const service = createService();
    emit([]);
    expect(service.formFactor()).toBe('tablet-portrait');
    emit([LAYOUT_QUERIES.landscape]);
    expect(service.formFactor()).toBe('tablet-landscape');
    emit([]);
    expect(service.formFactor()).toBe('tablet-portrait');
  });

  it('reports touch from the coarse-pointer query', () => {
    const service = createService();
    emit([LAYOUT_QUERIES.coarsePointer]);
    expect(service.isTouch()).toBeTrue();
    emit([]);
    expect(service.isTouch()).toBeFalse();
  });
});
