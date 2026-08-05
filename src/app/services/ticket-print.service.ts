import { Injectable, inject } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

import { Order } from '../models/order.model';
import { PrinterErrorCode, ThermalPrinter } from '../native/thermal-printer.plugin';
import { bytesToBase64 } from '../shared/utils/escpos-builder';
import { PrinterSettingsService } from './printer-settings.service';
import { TicketRendererService } from './ticket-renderer.service';
import { VendorService } from './vendor.service';

const PRINTED_IDS_KEY = 'picki.printer.printedOrderIds';

/** Keep the printed-id log bounded; a busy service is a few hundred orders. */
const MAX_PRINTED_IDS = 200;

/**
 * Orders older than this are never auto-printed. Guards against a whole
 * backlog printing when the app is relaunched or the vendor is switched.
 */
const AUTO_PRINT_MAX_AGE_MS = 30 * 60 * 1000;

const ERROR_MESSAGES: Record<PrinterErrorCode, string> = {
  NO_ADAPTER: "Cet appareil n'a pas de Bluetooth",
  BT_DISABLED: 'Le Bluetooth est désactivé',
  NO_PERMISSION: 'Autorisation Bluetooth refusée',
  NOT_PAIRED: "L'imprimante n'est pas appairée dans les réglages Android",
  CONNECT_FAILED: "Connexion à l'imprimante impossible - est-elle allumée ?",
  WRITE_FAILED: "Erreur d'envoi vers l'imprimante",
  INVALID_ARGS: 'Configuration imprimante invalide',
  UNAVAILABLE: "L'impression Bluetooth n'est disponible que dans l'application Android",
};

export interface PrintTestOptions {
  address?: string;
  columns?: number;
  codePage?: number;
}

/**
 * Sends tickets to the thermal printer.
 *
 * Jobs are serialised: two orders arriving in the same polling tick must not
 * interleave on a single Bluetooth socket.
 */
@Injectable({ providedIn: 'root' })
export class TicketPrintService {
  private readonly renderer = inject(TicketRendererService);
  private readonly printerSettings = inject(PrinterSettingsService);
  private readonly vendorService = inject(VendorService);

  private queue: Promise<unknown> = Promise.resolve();
  private printedIds: string[] = [];
  private printedIdsLoaded = false;
  /** True until the first auto-print pass on a tablet that has never printed. */
  private isFirstRun = false;

  get isNative(): boolean {
    return this.printerSettings.isNative;
  }

  /**
   * Print the tickets for newly arrived orders.
   *
   * Safe to call on every polling tick: orders already printed, too old, or
   * not yet payable are skipped. Never throws - a printer problem must not
   * break the orders dashboard.
   */
  async autoPrintNewOrders(orders: Order[]): Promise<void> {
    if (!this.isNative) {
      return;
    }

    const settings = await this.printerSettings.load();
    if (!settings.autoPrint || !settings.address) {
      return;
    }
    if (!this.vendorService.getCurrentVendor()?.auto_print_enabled) {
      return;
    }

    await this.loadPrintedIds();

    const now = Date.now();
    const candidates = orders.filter(
      (order) =>
        (order.status === 'paid' || order.status === 'todo') &&
        now - new Date(order.createdAt).getTime() <= AUTO_PRINT_MAX_AGE_MS &&
        !this.printedIds.includes(order.id)
    );

    if (this.isFirstRun) {
      // First launch on this tablet: adopt whatever is already on screen as
      // "seen" rather than printing a backlog the kitchen has already handled.
      this.isFirstRun = false;
      for (const order of candidates) {
        await this.markPrinted(order.id);
      }
      return;
    }

    for (const order of candidates) {
      // Recorded before printing: a crash mid-print must not cause a loop.
      await this.markPrinted(order.id);
      try {
        await this.printOrder(order);
      } catch (error) {
        console.error(`Automatic printing failed for order ${order.orderNumber}`, error);
      }
    }
  }

  /** Print one order's ticket. Rejects on printer errors so callers can report. */
  async printOrder(order: Order): Promise<void> {
    const settings = await this.printerSettings.load();
    if (!settings.address) {
      throw this.error('INVALID_ARGS', 'Aucune imprimante sélectionnée');
    }

    const bytes = this.renderer.render(order, {
      columns: this.printerSettings.columns(),
      codePage: settings.codePage,
    });

    for (let copy = 0; copy < settings.copies; copy++) {
      await this.enqueue(() =>
        ThermalPrinter.print({ address: settings.address, data: bytesToBase64(bytes) })
      );
    }
  }

  /** Alignment / encoding check from the settings screen. */
  async printTestTicket(options: PrintTestOptions = {}): Promise<void> {
    const settings = await this.printerSettings.load();
    const address = options.address || settings.address;
    if (!address) {
      throw this.error('INVALID_ARGS', 'Aucune imprimante sélectionnée');
    }

    const bytes = this.renderer.renderTestTicket({
      columns: options.columns ?? this.printerSettings.columns(),
      codePage: options.codePage ?? settings.codePage,
    });

    await this.enqueue(() =>
      ThermalPrinter.print({ address, data: bytesToBase64(bytes) })
    );
  }

  /** Turn a native rejection into something a user can act on. */
  describeError(error: unknown): string {
    const code = (error as { code?: PrinterErrorCode })?.code;
    if (code && ERROR_MESSAGES[code]) {
      return ERROR_MESSAGES[code];
    }
    const message = (error as Error)?.message;
    return message || "Erreur d'impression";
  }

  /**
   * Serialise every printer call. The native plugin already writes on a single
   * thread, but queueing here also keeps the copies of one ticket contiguous.
   */
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const result = this.queue.then(job, job);
    // Swallow rejections on the chain itself so one failure does not poison
    // every subsequent job; the caller still sees the original rejection.
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async loadPrintedIds(): Promise<void> {
    if (this.printedIdsLoaded) {
      return;
    }
    try {
      const { value } = await Preferences.get({ key: PRINTED_IDS_KEY });
      this.isFirstRun = value == null;
      const parsed = value ? JSON.parse(value) : [];
      this.printedIds = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Could not read printed order ids', error);
      this.printedIds = [];
    } finally {
      this.printedIdsLoaded = true;
    }
  }

  private async markPrinted(orderId: string): Promise<void> {
    this.printedIds = [...this.printedIds, orderId].slice(-MAX_PRINTED_IDS);
    try {
      await Preferences.set({
        key: PRINTED_IDS_KEY,
        value: JSON.stringify(this.printedIds),
      });
    } catch (error) {
      console.error('Could not persist printed order ids', error);
    }
  }

  private error(code: PrinterErrorCode, message: string): Error {
    const error = new Error(message) as Error & { code: PrinterErrorCode };
    error.code = code;
    return error;
  }
}
