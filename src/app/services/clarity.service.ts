import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { distinctUntilChanged } from 'rxjs';

import { VendorService } from './vendor.service';

type ClarityCommand = (
  command: 'set',
  key: string,
  value: string
) => void;

interface ClarityWindow extends Window {
  clarity?: ClarityCommand;
}

@Injectable({
  providedIn: 'root',
})
export class ClarityService {
  private readonly document = inject(DOCUMENT);
  private readonly vendorService = inject(VendorService);

  private initialized = false;

  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    this.vendorService.currentVendor$
      .pipe(
        distinctUntilChanged(
          (previousVendor, nextVendor) =>
            previousVendor?.id === nextVendor?.id &&
            previousVendor?.business_name === nextVendor?.business_name
        )
      )
      .subscribe((vendor) => {
        if (!vendor) {
          return;
        }

        this.setCustomTag('vendorId', vendor.id);
        this.setCustomTag('vendorName', vendor.business_name);
      });
  }

  private setCustomTag(key: string, value: string): void {
    const browserWindow = this.document.defaultView as ClarityWindow | null;
    const normalizedValue = value.trim();

    if (!browserWindow?.clarity || !normalizedValue) {
      return;
    }

    browserWindow.clarity('set', key, normalizedValue.slice(0, 255));
  }
}
