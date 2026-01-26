import { LOCALE_ID, Pipe, PipeTransform, inject } from '@angular/core';

import { VendorService } from '../../services/vendor.service';

type CurrencyDisplay = 'symbol' | 'code' | 'name' | 'narrowSymbol';

@Pipe({
  name: 'vendorCurrencySymbol',
  standalone: true,
  pure: false,
})
export class VendorCurrencySymbolPipe implements PipeTransform {
  private readonly vendorService = inject(VendorService);
  private readonly localeId = inject(LOCALE_ID);

  transform(
    _value?: unknown,
    display: CurrencyDisplay = 'symbol',
    currencyCode?: string
  ): string {
    const currency =
      (currencyCode || this.vendorService.getCurrentCurrency() || 'EUR')
        .toString()
        .trim()
        .toUpperCase() || 'EUR';

    try {
      const parts = new Intl.NumberFormat(this.localeId, {
        style: 'currency',
        currency,
        currencyDisplay: display,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).formatToParts(0);

      const currencyPart = parts.find((p) => p.type === 'currency')?.value;
      return currencyPart || currency;
    } catch {
      return currency;
    }
  }
}








