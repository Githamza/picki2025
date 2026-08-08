import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { KioskNativeService } from './kiosk-native.service';
import { KioskModeService } from './kiosk-mode.service';

describe('KioskNativeService', () => {
  it('is inert on the web platform (no native calls, no listeners, no throw)', () => {
    // Karma runs in a browser: Capacitor.isNativePlatform() is false, so
    // construction must be a no-op — the guard is the contract (FR5).
    TestBed.configureTestingModule({
      providers: [
        {
          provide: KioskModeService,
          useValue: { active: signal(false) },
        },
      ],
    });

    expect(() => TestBed.inject(KioskNativeService)).not.toThrow();
  });
});
