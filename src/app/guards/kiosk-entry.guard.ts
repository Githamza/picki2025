import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Vendor, VendorService } from '../services/vendor.service';

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
const buildLoginUrl = (
  router: Router,
  returnUrl: string,
  message?: string
): UrlTree =>
  router.createUrlTree(['/admin/login'], {
    queryParams: { returnUrl, ...(message && { message }) },
  });

/**
 * Restore the persisted session and resolve the vendor linked to the
 * signed-in account. Returns the vendor, or a login redirect when there is
 * no session / no linked shop.
 */
const resolveKioskVendor = async (returnUrl: string): Promise<Vendor | UrlTree> => {
  const authService = inject(AuthService);
  const vendorService = inject(VendorService);
  const router = inject(Router);

  // Wait for the persisted session to be restored (same polling approach as
  // AdminAuthGuard.waitForAuthInitialization).
  while (authService.isLoading()) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const currentUser = authService.currentUser();
  if (!authService.isAuthenticated() || !currentUser) {
    return buildLoginUrl(router, returnUrl);
  }

  try {
    await vendorService.loadVendors();
    const vendors = await firstValueFrom(vendorService.vendors$);
    const vendor = vendors.find((v) => v.id === currentUser.vendorId);

    if (!vendor) {
      return buildLoginUrl(router, returnUrl, 'No shop is linked to this account');
    }

    return vendor;
  } catch (error) {
    console.error('kiosk guard: failed to resolve vendor:', error);
    return buildLoginUrl(router, returnUrl, 'Could not load your shop, please try again');
  }
};

export const kioskEntryGuard: CanActivateFn = async (): Promise<UrlTree> => {
  const vendorService = inject(VendorService);
  const router = inject(Router);

  const resolved = await resolveKioskVendor('/kiosk');
  if (resolved instanceof UrlTree) {
    return resolved;
  }

  return router.createUrlTree([
    '/vendor',
    vendorService.getVendorSlug(resolved),
  ]);
};

/**
 * Guards the shop APK's device-setup page (`/kiosk/setup`, reached via the
 * attract screen's maintenance gesture). AdminAuthGuard is unsuitable here:
 * its URL fallback would read "kiosk" as a vendor slug and bounce to `/`.
 *
 * Also sets the vendor context so the settings page works when opened cold
 * (e.g. as the returnUrl right after login).
 */
export const kioskSetupGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const vendorService = inject(VendorService);

  const resolved = await resolveKioskVendor('/kiosk/setup');
  if (resolved instanceof UrlTree) {
    return resolved;
  }

  vendorService.setCurrentVendor(resolved);
  return true;
};
