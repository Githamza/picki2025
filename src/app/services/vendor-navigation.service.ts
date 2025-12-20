import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { VendorService } from './vendor.service';
import { DomainService } from './domain.service';

@Injectable({
  providedIn: 'root',
})
export class VendorNavigationService {
  private router = inject(Router);
  private vendorService = inject(VendorService);
  private domainService = inject(DomainService);

  navigateWithVendor(path: string | string[]) {
    const segments = Array.isArray(path) ? path : [path];

    // Some routes are top-level and should NOT be vendor-scoped.
    // Example: /admin/...
    if (segments[0]?.startsWith('admin') || segments[0] === 'test-cache') {
      this.router.navigate(segments).catch((error) => {
        console.error('Navigation error:', error);
      });
      return;
    }

    const currentVendor = this.vendorService.getCurrentVendor();
    if (!currentVendor) {
      console.error('No vendor context available for navigation');
      console.error('Current URL:', this.router.url);
      return;
    }

    const hostname = this.domainService.getHostname();
    const isCustomDomain = this.domainService.isCustomDomain(hostname);

    const vendorSlug = this.vendorService.getVendorSlug(currentVendor);
    const fullPath = isCustomDomain ? [...segments] : ['vendor', vendorSlug, ...segments];

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
    const segments = Array.isArray(path) ? path : [path];

    // Top-level routes (not vendor-scoped)
    if (segments[0]?.startsWith('admin') || segments[0] === 'test-cache') {
      return '/' + segments.join('/');
    }

    const currentVendor = this.vendorService.getCurrentVendor();
    if (!currentVendor) {
      return '/' + segments.join('/');
    }

    const hostname = this.domainService.getHostname();
    const isCustomDomain = this.domainService.isCustomDomain(hostname);

    const vendorSlug = this.vendorService.getVendorSlug(currentVendor);
    const fullPath = isCustomDomain ? [...segments] : ['vendor', vendorSlug, ...segments];

    return '/' + fullPath.join('/');
  }

  getVendorSlug(): string | null {
    const currentVendor = this.vendorService.getCurrentVendor();
    return currentVendor
      ? this.vendorService.getVendorSlug(currentVendor)
      : null;
  }
}
