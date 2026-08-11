import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { kioskEntryGuard, kioskSetupGuard } from './kiosk-entry.guard';
import { AuthService } from '../services/auth.service';
import { VendorService } from '../services/vendor.service';

describe('kioskEntryGuard', () => {
  let authService: {
    isLoading: jasmine.Spy;
    isAuthenticated: jasmine.Spy;
    currentUser: jasmine.Spy;
  };
  let vendorService: {
    loadVendors: jasmine.Spy;
    getVendorSlug: jasmine.Spy;
    setCurrentVendor: jasmine.Spy;
    vendors$: BehaviorSubject<any[]>;
  };
  let router: Router;

  const vendor = { id: 'vendor-1', business_name: 'Granola' };

  beforeEach(() => {
    authService = {
      isLoading: jasmine.createSpy('isLoading').and.returnValue(false),
      isAuthenticated: jasmine.createSpy('isAuthenticated').and.returnValue(false),
      currentUser: jasmine.createSpy('currentUser').and.returnValue(null),
    };
    vendorService = {
      loadVendors: jasmine.createSpy('loadVendors').and.resolveTo(undefined),
      getVendorSlug: jasmine.createSpy('getVendorSlug').and.returnValue('granola'),
      setCurrentVendor: jasmine.createSpy('setCurrentVendor'),
      vendors$: new BehaviorSubject<any[]>([vendor]),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: VendorService, useValue: vendorService },
      ],
    });
    router = TestBed.inject(Router);
  });

  const runGuard = (): Promise<UrlTree> =>
    TestBed.runInInjectionContext(
      () => kioskEntryGuard({} as any, {} as any) as Promise<UrlTree>
    );

  it('redirects a logged-out user to the shared login with returnUrl=/kiosk', async () => {
    const result = await runGuard();

    expect(router.serializeUrl(result)).toBe('/admin/login?returnUrl=%2Fkiosk');
  });

  it("redirects a logged-in user to their vendor's storefront", async () => {
    authService.isAuthenticated.and.returnValue(true);
    authService.currentUser.and.returnValue({ id: 'u1', vendorId: 'vendor-1' });

    const result = await runGuard();

    expect(vendorService.loadVendors).toHaveBeenCalled();
    expect(router.serializeUrl(result)).toBe('/vendor/granola');
  });

  it('sends a user with no matching vendor back to login with a message', async () => {
    authService.isAuthenticated.and.returnValue(true);
    authService.currentUser.and.returnValue({ id: 'u1', vendorId: 'unknown' });

    const result = await runGuard();

    const url = router.serializeUrl(result);
    expect(url).toContain('/admin/login');
    expect(url).toContain('returnUrl=%2Fkiosk');
    expect(url).toContain('message=');
  });

  it('sends the user to login when vendor loading fails', async () => {
    authService.isAuthenticated.and.returnValue(true);
    authService.currentUser.and.returnValue({ id: 'u1', vendorId: 'vendor-1' });
    vendorService.loadVendors.and.rejectWith(new Error('network down'));

    const result = await runGuard();

    expect(router.serializeUrl(result)).toContain('/admin/login');
  });

  describe('kioskSetupGuard', () => {
    const runSetupGuard = (): Promise<boolean | UrlTree> =>
      TestBed.runInInjectionContext(
        () => kioskSetupGuard({} as any, {} as any) as Promise<boolean | UrlTree>
      );

    it('redirects a logged-out user to login with returnUrl=/kiosk/setup', async () => {
      const result = await runSetupGuard();

      expect(router.serializeUrl(result as UrlTree)).toBe(
        '/admin/login?returnUrl=%2Fkiosk%2Fsetup'
      );
    });

    it('sets the vendor context and allows a logged-in user through', async () => {
      authService.isAuthenticated.and.returnValue(true);
      authService.currentUser.and.returnValue({ id: 'u1', vendorId: 'vendor-1' });

      const result = await runSetupGuard();

      expect(result).toBe(true);
      expect(vendorService.setCurrentVendor).toHaveBeenCalledWith(
        jasmine.objectContaining({ id: 'vendor-1' })
      );
    });

    it('sends a user with no matching vendor back to login', async () => {
      authService.isAuthenticated.and.returnValue(true);
      authService.currentUser.and.returnValue({ id: 'u1', vendorId: 'unknown' });

      const result = await runSetupGuard();

      const url = router.serializeUrl(result as UrlTree);
      expect(url).toContain('/admin/login');
      expect(url).toContain('returnUrl=%2Fkiosk%2Fsetup');
    });
  });
});
