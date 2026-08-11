import { Injectable, effect, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar } from '@capacitor/status-bar';
import { KeepAwake } from '@capacitor-community/keep-awake';

import { KioskModeService } from './kiosk-mode.service';

/**
 * Native kiosk affordances for the Capacitor Android app (SPEC.md FR5).
 *
 * Web builds are untouched: every call is behind
 * `Capacitor.isNativePlatform()`, and plugin failures are non-fatal (a
 * kiosk without keep-awake still takes orders).
 *
 * - kiosk active  -> hide the status bar, keep awake
 * - kiosk inactive -> show the status bar, allow sleep
 * - orientation is never locked: the OS auto-rotates and the layout
 *   adapts (kiosk activation does not depend on orientation).
 * - hardware back  -> in kiosk mode never exits the app; otherwise the
 *   default in-app back navigation applies.
 */
@Injectable({ providedIn: 'root' })
export class KioskNativeService {
  private readonly kioskMode = inject(KioskModeService);

  constructor() {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    effect(() => {
      const active = this.kioskMode.active();
      void this.applyNativeState(active);
    });

    void App.addListener('backButton', ({ canGoBack }) => {
      if (this.kioskMode.active()) {
        // FR5: a kiosk never exits the app. Back inside the storefront is
        // allowed; at the root we simply stay put.
        if (canGoBack) {
          window.history.back();
        }
        return;
      }
      if (canGoBack) {
        window.history.back();
      } else {
        void App.exitApp();
      }
    });
  }

  private async applyNativeState(active: boolean): Promise<void> {
    try {
      if (active) {
        await StatusBar.hide();
        await KeepAwake.keepAwake();
      } else {
        await StatusBar.show();
        await KeepAwake.allowSleep();
      }
    } catch (error) {
      // Non-fatal: e.g. StatusBar is unavailable on some devices.
      console.warn('[kiosk-native] failed to apply native state:', error);
    }
  }
}
