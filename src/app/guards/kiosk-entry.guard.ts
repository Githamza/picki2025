import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { VendorService } from '../services/vendor.service';

/**
 * Entry point for the shop APK (see capacitor.config.ts): the tablet opens
 * on `/kiosk`, and this guard decides where it really lands.
 *
 * - No session -> the shared admin login, which returns here after login.
 * - Session    -> the authenticated vendor's public storefront
 *                 (`/vendor/:slug`), where VendorGuard sets up the vendor
 *                 context and kiosk mode takes over.
 *
 * The storefront itself stays public: the login only selects which vendor's
 * shop the tablet shows, customers are never authenticated.
 */
export const kioskEntryGuard: CanActivateFn = async (): Promise<UrlTree> => {
  const authService = inject(AuthService);
  const vendorService = inject(VendorService);
  const router = inject(Router);

  const loginUrl = (message?: string): UrlTree =>
    router.createUrlTree(['/admin/login'], {
      queryParams: { returnUrl: '/kiosk', ...(message && { message }) },
    });

  // Wait for the persisted session to be restored (same polling approach as
  // AdminAuthGuard.waitForAuthInitialization).
  while (authService.isLoading()) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const currentUser = authService.currentUser();
  if (!authService.isAuthenticated() || !currentUser) {
    return loginUrl();
  }

  try {
    await vendorService.loadVendors();
    const vendors = await firstValueFrom(vendorService.vendors$);
    const vendor = vendors.find((v) => v.id === currentUser.vendorId);

    if (!vendor) {
      return loginUrl('No shop is linked to this account');
    }

    return router.createUrlTree([
      '/vendor',
      vendorService.getVendorSlug(vendor),
    ]);
  } catch (error) {
    console.error('kioskEntryGuard: failed to resolve vendor:', error);
    return loginUrl('Could not load your shop, please try again');
  }
};
