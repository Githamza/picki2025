import { Injectable, computed, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

import {
  CODE_PAGE_PC858,
  COLUMNS_58MM,
  COLUMNS_80MM,
} from '../shared/utils/escpos-builder';

export type PaperWidth = 58 | 80;

export interface PrinterSettings {
  /** MAC address of the paired printer, empty when none is chosen. */
  address: string;
  /** Display name, kept only so the UI can show it without a Bluetooth call. */
  name: string;
  paperWidth: PaperWidth;
  /**
   * ESC/POS code page. Exposed in the UI because a printer that lacks PC858
   * prints accents as garbage, and switching it must not require a new APK.
   */
  codePage: number;
  /** Whether *this* tablet prints incoming orders. */
  autoPrint: boolean;
  copies: number;
}

const STORAGE_KEY = 'picki.printer.settings';

const DEFAULT_SETTINGS: PrinterSettings = {
  address: '',
  name: '',
  paperWidth: 58,
  codePage: CODE_PAGE_PC858,
  autoPrint: false,
  copies: 1,
};

/**
 * Per-device printer configuration.
 *
 * Deliberately local rather than in the database: the printer belongs to the
 * tablet, not the vendor account, so an admin signed in on a laptop must never
 * inherit it.
 */
@Injectable({ providedIn: 'root' })
export class PrinterSettingsService {
  private readonly settingsSignal = signal<PrinterSettings>(DEFAULT_SETTINGS);
  private readonly loadedSignal = signal(false);
  private loadPromise?: Promise<void>;

  readonly settings = this.settingsSignal.asReadonly();
  readonly loaded = this.loadedSignal.asReadonly();

  /** Printable columns for the configured paper width. */
  readonly columns = computed(() =>
    this.settingsSignal().paperWidth === 80 ? COLUMNS_80MM : COLUMNS_58MM
  );

  readonly hasPrinter = computed(() => !!this.settingsSignal().address);

  /** Bluetooth printing only exists in the native shell. */
  readonly isNative = Capacitor.isNativePlatform();

  /** Idempotent; safe to call from every consumer. */
  async load(): Promise<PrinterSettings> {
    if (this.loadedSignal()) {
      return this.settingsSignal();
    }
    this.loadPromise ??= this.readFromStorage();
    await this.loadPromise;
    return this.settingsSignal();
  }

  async save(changes: Partial<PrinterSettings>): Promise<PrinterSettings> {
    await this.load();
    const next = this.normalise({ ...this.settingsSignal(), ...changes });
    this.settingsSignal.set(next);
    await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(next) });
    return next;
  }

  async reset(): Promise<void> {
    this.settingsSignal.set(DEFAULT_SETTINGS);
    this.loadedSignal.set(true);
    await Preferences.remove({ key: STORAGE_KEY });
  }

  private async readFromStorage(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (value) {
        this.settingsSignal.set(this.normalise({ ...DEFAULT_SETTINGS, ...JSON.parse(value) }));
      }
    } catch (error) {
      // Corrupt or unreadable storage must not stop the admin from loading.
      console.error('Could not read printer settings, using defaults', error);
    } finally {
      this.loadedSignal.set(true);
    }
  }

  private normalise(settings: PrinterSettings): PrinterSettings {
    return {
      ...settings,
      address: (settings.address || '').trim(),
      name: (settings.name || '').trim(),
      paperWidth: settings.paperWidth === 80 ? 80 : 58,
      codePage: Number.isFinite(settings.codePage) ? settings.codePage : CODE_PAGE_PC858,
      autoPrint: !!settings.autoPrint,
      copies: Math.min(3, Math.max(1, Math.round(settings.copies) || 1)),
    };
  }
}
