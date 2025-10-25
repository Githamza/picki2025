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
      console.error('Current URL:', this.router.url);
      return;
    }

    const vendorSlug = this.vendorService.getVendorSlug(currentVendor);
    const fullPath = Array.isArray(path)
      ? [vendorSlug, ...path]
      : [vendorSlug, path];

    console.log('VendorNavigationService: Navigating to:', fullPath);
    console.log(
      'Current vendor:',
      currentVendor.business_name,
      'Slug:',
      vendorSlug
    );

    this.router
      .navigate(fullPath)
      .then((success) => {
        if (success) {
          console.log('Navigation successful to:', fullPath.join('/'));
        } else {
          console.error('Navigation failed to:', fullPath.join('/'));
        }
      })
      .catch((error) => {
        console.error('Navigation error:', error);
      });
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
