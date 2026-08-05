import { Injectable, inject } from '@angular/core';

import { Order } from '../models/order.model';
import { CODE_PAGE_PC858, COLUMNS_58MM } from '../shared/utils/escpos-builder';
import {
  TicketLayoutOptions,
  renderOrderTicket,
  renderTestTicket,
} from '../shared/utils/ticket-layout';
import { Vendor, VendorService } from './vendor.service';

export interface TicketRenderOptions {
  columns?: number;
  codePage?: number;
  /** Defaults to the current vendor. */
  vendor?: Vendor | null;
}

/**
 * Thin wrapper that feeds vendor context (name, country, currency) into the
 * pure layout in `shared/utils/ticket-layout`.
 */
@Injectable({ providedIn: 'root' })
export class TicketRendererService {
  private readonly vendorService = inject(VendorService);

  render(order: Order, options: TicketRenderOptions = {}): Uint8Array {
    return renderOrderTicket(order, this.layoutOptions(options));
  }

  renderTestTicket(options: TicketRenderOptions = {}): Uint8Array {
    return renderTestTicket(this.layoutOptions(options));
  }

  private layoutOptions(options: TicketRenderOptions): TicketLayoutOptions {
    const vendor = options.vendor ?? this.vendorService.getCurrentVendor();
    return {
      businessName: vendor?.business_name,
      country: vendor?.country,
      currency: vendor?.currency || this.vendorService.getCurrentCurrency() || 'EUR',
      columns: options.columns ?? COLUMNS_58MM,
      codePage: options.codePage ?? CODE_PAGE_PC858,
    };
  }
}
