import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { VendorService } from './vendor.service';

@Injectable({
  providedIn: 'root',
})
export class VendorNavigationService {
  private router = inject(Router);
  private vendorService = inject(VendorService);

  navigateWithVendor(path: string | string[]) {
    const currentVendor = this.vendorService.getCurrentVendor();
    if (!currentVendor) {
      console.error('No vendor context available for navigation');
      return;
    }

    const vendorSlug = this.vendorService.getVendorSlug(currentVendor);
    const fullPath = Array.isArray(path)
      ? [vendorSlug, ...path]
      : [vendorSlug, path];

    this.router.navigate(fullPath);
  }

  getVendorUrl(path: string | string[]): string {
    const currentVendor = this.vendorService.getCurrentVendor();
    if (!currentVendor) {
      return Array.isArray(path) ? path.join('/') : path;
    }

    const vendorSlug = this.vendorService.getVendorSlug(currentVendor);
    const fullPath = Array.isArray(path)
      ? [vendorSlug, ...path]
      : [vendorSlug, path];

    return '/' + fullPath.join('/');
  }

  getVendorSlug(): string | null {
    const currentVendor = this.vendorService.getCurrentVendor();
    return currentVendor
      ? this.vendorService.getVendorSlug(currentVendor)
      : null;
  }
}
