import { Injectable, inject } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { VendorService } from '../services/vendor.service';
import { SupabaseAuthService } from '../services/supabase-auth.service';

@Injectable({
  providedIn: 'root',
})
export class VendorGuard implements CanActivate {
  private vendorService = inject(VendorService);
  private router = inject(Router);
  private supabaseAuthService = inject(SupabaseAuthService);

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
    const vendorSlug = route.paramMap.get('vendorSlug');

    if (!vendorSlug) {
      console.error('No vendor slug provided');
      this.router.navigate(['/']);
      return of(false);
    }

    // Check if vendor is already set and matches the requested slug
    const currentVendor = this.vendorService.getCurrentVendor();
    if (
      currentVendor &&
      this.vendorService.getVendorSlug(currentVendor) === vendorSlug
    ) {
      console.log('Vendor already set:', currentVendor.business_name);
      // Set vendor ID in SupabaseAuthService
      this.supabaseAuthService.setCurrentVendorId(currentVendor.id);
      return of(true);
    }

    // Otherwise, load the vendor
    return this.vendorService.setCurrentVendorBySlug(vendorSlug).pipe(
      map((vendor) => {
        if (vendor) {
          console.log('Vendor set successfully:', vendor.business_name);
          // Set vendor ID in SupabaseAuthService
          this.supabaseAuthService.setCurrentVendorId(vendor.id);
          return true;
        } else {
          console.error('Vendor not found:', vendorSlug);
          this.router.navigate(['/']);
          return false;
        }
      }),
      catchError((error) => {
        console.error('Error setting vendor:', error);
        this.router.navigate(['/']);
        return of(false);
      })
    );
  }
}
