import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DomainService } from '../services/domain.service';
import { VendorService } from '../services/vendor.service';
import { SupabaseAuthService } from '../services/supabase-auth.service';

/**
 * Matches the vendor app at the root (`/`) when the app is loaded on a vendor
 * custom domain. On pikiapp domains, it returns false so normal routing applies.
 *
 * If no vendor is found for the domain, it redirects to the vendor selection page (`/`).
 */
export const customDomainVendorGuard: CanMatchFn = (): Observable<boolean | UrlTree> => {
  const domainService = inject(DomainService);
  const vendorService = inject(VendorService);
  const supabaseAuthService = inject(SupabaseAuthService);
  const router = inject(Router);

  const hostname = domainService.normalizeDomain(domainService.getHostname());

  // Not a custom domain => do not match this route, let the normal route table apply.
  if (!hostname || !domainService.isCustomDomain(hostname)) {
    return of(false);
  }

  // Vendor already resolved for this domain
  const currentVendor = vendorService.getCurrentVendor();
  if (
    currentVendor &&
    domainService.normalizeDomain(currentVendor.customDomain || '') === hostname
  ) {
    supabaseAuthService.setCurrentVendorId(currentVendor.id);
    return of(true);
  }

  return vendorService.setCurrentVendorByCustomDomain(hostname).pipe(
    map((vendor) => {
      if (!vendor) {
        // Vendor not found for this domain -> do not match the vendor-app-at-root route.
        // This allows the router to fall back to the vendor selection page / legacy redirects.
        return false;
      }

      supabaseAuthService.setCurrentVendorId(vendor.id);
      return true;
    }),
    catchError((error) => {
      console.error('Error resolving vendor by custom domain:', error);
      return of(false);
    })
  );
};


