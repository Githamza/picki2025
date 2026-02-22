import { LOCALE_ID, Pipe, PipeTransform, inject } from '@angular/core';

import { VendorService } from '../../services/vendor.service';

type CurrencyDisplay = 'symbol' | 'code' | 'name' | 'narrowSymbol';

function parseDigits(digits: string): {
  minimumFractionDigits: number;
  maximumFractionDigits: number;
} {
  // Format: {minIntegerDigits}.{minFractionDigits}-{maxFractionDigits}
  // Example: "1.2-2"
  const match = /^(\d+)\.(\d+)-(\d+)$/.exec(digits.trim());
  if (!match) {
    return { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  }
  const minFractionDigits = Number(match[2]);
  const maxFractionDigits = Number(match[3]);
  return {
    minimumFractionDigits: Number.isFinite(minFractionDigits) ? minFractionDigits : 2,
    maximumFractionDigits: Number.isFinite(maxFractionDigits) ? maxFractionDigits : 2,
  };
}

@Pipe({
  name: 'vendorCurrency',
  standalone: true,
  // This pipe depends on vendor context (service state), so keep it impure.
  pure: false,
})
export class VendorCurrencyPipe implements PipeTransform {
  private readonly vendorService = inject(VendorService);
  private readonly localeId = inject(LOCALE_ID);

  transform(
    value: number | null | undefined,
    display: CurrencyDisplay = 'symbol',
    digits: string = '1.2-2',
    currencyCode?: string
  ): string {
    const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    const currency =
      (currencyCode || this.vendorService.getCurrentCurrency() || 'EUR')
        .toString()
        .trim()
        .toUpperCase() || 'EUR';

    const { minimumFractionDigits, maximumFractionDigits } = parseDigits(digits);

    try {
      return new Intl.NumberFormat(this.localeId, {
        style: 'currency',
        currency,
        currencyDisplay: display,
        minimumFractionDigits,
        maximumFractionDigits,
      }).format(amount);
    } catch {
      // Fallback if Intl fails for some reason.
      return `${amount.toFixed(maximumFractionDigits)} ${currency}`;
    }
  }
}









