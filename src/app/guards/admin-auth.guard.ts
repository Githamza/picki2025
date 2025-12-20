import { Injectable, inject } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
  UrlTree,
} from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { VendorService } from '../services/vendor.service';
import { filter, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class AdminAuthGuard implements CanActivate {
  private readonly authService = inject(AuthService);
  private readonly vendorService = inject(VendorService);
  private readonly router = inject(Router);
  private authInitialized = false;

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ):
    | Observable<boolean | UrlTree>
    | Promise<boolean | UrlTree>
    | boolean
    | UrlTree {
    // Initialize auth service when first accessing admin routes
    this.initializeAuthIfNeeded();

    // Wait for auth initialization to complete
    if (this.authService.isLoading()) {
      return this.waitForAuthInitialization(route, state);
    }

    return this.checkAuthentication(route, state);
  }

  /**
   * Wait for authentication initialization to complete
   */
  private waitForAuthInitialization(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    // Create an observable that emits when loading is false
    return new Observable<boolean | UrlTree>((observer) => {
      const checkLoading = () => {
        if (!this.authService.isLoading()) {
          this.checkAuthentication(route, state).subscribe(observer);
        } else {
          // Check again after a short delay
          setTimeout(checkLoading, 100);
        }
      };
      checkLoading();
    });
  }

  /**
   * Initialize auth service only when first accessing admin routes
   */
  private initializeAuthIfNeeded(): void {
    if (!this.authInitialized) {
      console.log('🔐 Initializing auth service for admin interface');
      // The AuthService constructor will be called when first injected
      // This ensures it's only initialized when admin routes are accessed
      this.authInitialized = true;
    }
  }

  private checkAuthentication(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    // Check if user is authenticated
    const isAuthenticated = this.authService.isAuthenticated();
    const currentUser = this.authService.currentUser();

    if (!isAuthenticated || !currentUser) {
      return this.redirectToLogin(route, state);
    }

    // Check if user's account is still active
    if (!currentUser.isActive) {
      this.authService.logout();
      return this.redirectToLogin(
        route,
        state,
        'Your account has been deactivated'
      );
    }

    // Check if user's session is still valid (async check)
    return new Observable((observer) => {
      this.authService
        .isSessionValid(currentUser)
        .then((isValid) => {
          if (!isValid) {
            // Session expired, logout and redirect to login
            this.authService.logout();
            this.redirectToLogin(route, state).subscribe((result) => {
              observer.next(result);
              observer.complete();
            });
          } else {
            // Session is valid, continue with other checks
            this.performAdditionalChecks(route, state, currentUser).subscribe(
              (result) => {
                observer.next(result);
                observer.complete();
              }
            );
          }
        })
        .catch((error) => {
          console.error('Error checking session validity:', error);
          this.authService.logout();
          this.redirectToLogin(route, state).subscribe((result) => {
            observer.next(result);
            observer.complete();
          });
        });
    });
  }

  private performAdditionalChecks(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
    currentUser: any
  ): Observable<boolean | UrlTree> {
    // Check vendor-specific access
    const vendorSlug = this.getVendorSlugFromRoute(route);
    if (vendorSlug) {
      const currentVendor = this.vendorService.getCurrentVendor();

      // Ensure vendor is set and matches the route
      if (
        !currentVendor ||
        this.vendorService.getVendorSlug(currentVendor) !== vendorSlug
      ) {
        return this.redirectToVendorSelection();
      }

      // Ensure user belongs to this vendor
      if (currentUser.vendorId !== currentVendor.id) {
        return this.redirectToLogin(
          route,
          state,
          'Access denied for this vendor'
        );
      }
    }

    // Check for specific resource permissions if defined in route data
    const requiredPermission = route.data?.['permission'];
    if (requiredPermission) {
      const { resource, action } = requiredPermission;
      if (!this.authService.hasPermission(resource, action)) {
        return this.redirectToAccessDenied();
      }
    }

    // Check for minimum role if defined in route data
    const requiredRole = route.data?.['role'];
    if (requiredRole) {
      if (!this.hasRequiredRole(currentUser.role, requiredRole)) {
        return this.redirectToAccessDenied();
      }
    }

    return of(true);
  }

  private redirectToLogin(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
    message?: string
  ): Observable<UrlTree> {
    // Look for vendorSlug in current route or parent routes
    const vendorSlug = this.getVendorSlugFromRoute(route);

    if (vendorSlug) {
      // Redirect to vendor-specific login
      const loginUrl = this.router.createUrlTree(
        [`/vendor/${vendorSlug}/admin/login`],
        {
          queryParams: {
            returnUrl: state.url,
            ...(message && { message }),
          },
        }
      );
      return of(loginUrl);
    } else {
      // Redirect to generic admin login
      const loginUrl = this.router.createUrlTree(['/admin/login'], {
        queryParams: {
          returnUrl: state.url,
          ...(message && { message }),
        },
      });
      return of(loginUrl);
    }
  }

  private redirectToVendorSelection(): Observable<UrlTree> {
    const vendorSelectionUrl = this.router.createUrlTree(['/']);
    return of(vendorSelectionUrl);
  }

  private redirectToAccessDenied(): Observable<UrlTree> {
    const currentVendor = this.vendorService.getCurrentVendor();

    if (currentVendor) {
      const vendorSlug = this.vendorService.getVendorSlug(currentVendor);
      const accessDeniedUrl = this.router.createUrlTree([
        `/${vendorSlug}/admin/access-denied`,
      ]);
      return of(accessDeniedUrl);
    } else {
      return this.redirectToVendorSelection();
    }
  }

  private hasRequiredRole(userRole: string, requiredRole: string): boolean {
    // Define role hierarchy (higher number = more permissions)
    const roleHierarchy: Record<string, number> = {
      staff: 1,
      manager: 2,
      admin: 3,
    };

    const userRoleLevel = roleHierarchy[userRole] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

    return userRoleLevel >= requiredRoleLevel;
  }

  /**
   * Get vendor slug from route parameters, checking current route and parent routes
   */
  private getVendorSlugFromRoute(route: ActivatedRouteSnapshot): string | null {
    // Check current route first
    if (route.paramMap.has('vendorSlug')) {
      const slug = route.paramMap.get('vendorSlug');
      console.debug(
        'AdminAuthGuard: Found vendor slug in current route:',
        slug
      );
      return slug;
    }

    // Check parent routes
    let currentRoute = route.parent;
    while (currentRoute) {
      if (currentRoute.paramMap.has('vendorSlug')) {
        const slug = currentRoute.paramMap.get('vendorSlug');
        console.debug(
          'AdminAuthGuard: Found vendor slug in parent route:',
          slug
        );
        return slug;
      }
      currentRoute = currentRoute.parent;
    }

    // If not found in routes, try to extract from URL
    const url = route.pathFromRoot
      .map((r) => r.url.map((segment) => segment.path).join('/'))
      .join('/');
    const urlSegments = url.split('/').filter((segment) => segment);

    console.debug(
      'AdminAuthGuard: Attempting to extract vendor slug from URL segments:',
      urlSegments
    );

    // Look for pattern where vendor slug is followed by 'admin'
    for (let i = 0; i < urlSegments.length - 1; i++) {
      if (urlSegments[i + 1] === 'admin') {
        const slug = urlSegments[i];
        console.debug(
          'AdminAuthGuard: Found vendor slug from URL pattern:',
          slug
        );
        return slug;
      }
    }

    // Additional fallback: if URL starts with a vendor-like segment (not empty, not 'admin')
    if (
      urlSegments.length > 0 &&
      urlSegments[0] !== 'admin' &&
      urlSegments[0] !== ''
    ) {
      const potentialSlug = urlSegments[0];
      console.debug(
        'AdminAuthGuard: Using first URL segment as potential vendor slug:',
        potentialSlug
      );
      return potentialSlug;
    }

    console.warn(
      'AdminAuthGuard: Could not extract vendor slug from route or URL'
    );
    return null;
  }
}

// Functional guard variant for modern Angular
export const adminAuthGuard = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const vendorService = inject(VendorService);
  const router = inject(Router);

  // Create guard instance and use it
  const guard = new AdminAuthGuard();
  return guard.canActivate(route, state) as Observable<boolean | UrlTree>;
};
