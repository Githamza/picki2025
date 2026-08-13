import { TestBed } from '@angular/core/testing';

import { VendorService, Vendor } from './vendor.service';
import { SupabaseAuthService } from './supabase-auth.service';
import { SupabaseService } from './supabase.service';
import { AuthStateService } from '../store/auth.state';

/**
 * Kiosk terminal settings mapping (SPEC-QONTO-TERMINAL.md T7): the
 * saveRestaurantInfo facade forwards the kioskTerminal option to the
 * dedicated writer and refreshes the local vendor context with the row the
 * writer returns.
 */
describe('VendorService — kiosk terminal settings', () => {
  let service: VendorService;
  let authSpy: jasmine.SpyObj<SupabaseAuthService>;

  const vendor = { id: 'vendor-1', business_name: 'Test' } as Vendor;
  const updatedVendor = {
    ...vendor,
    kiosk_terminal_enabled: true,
    kiosk_terminal_id: 'term-1',
    kiosk_terminal_label: 'S1F2-1',
  } as Vendor;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj<SupabaseAuthService>('SupabaseAuthService', [
      'updateVendorKioskTerminal',
    ]);
    authSpy.updateVendorKioskTerminal.and.resolveTo(updatedVendor);

    TestBed.configureTestingModule({
      providers: [
        VendorService,
        { provide: SupabaseAuthService, useValue: authSpy },
        { provide: SupabaseService, useValue: {} },
        { provide: AuthStateService, useValue: {} },
      ],
    });
    service = TestBed.inject(VendorService);
    spyOn(service, 'getCurrentVendor').and.returnValue(vendor);
  });

  it('forwards kioskTerminal settings to the writer', async () => {
    await service.saveRestaurantInfo({
      kioskTerminal: {
        enabled: true,
        terminalId: 'term-1',
        terminalLabel: 'S1F2-1',
      },
    });

    expect(authSpy.updateVendorKioskTerminal).toHaveBeenCalledOnceWith(
      'vendor-1',
      { enabled: true, terminalId: 'term-1', terminalLabel: 'S1F2-1' }
    );
  });

  it('refreshes the local vendor context with the updated row', async () => {
    await service.saveRestaurantInfo({
      kioskTerminal: { enabled: true, terminalId: 'term-1', terminalLabel: 'S1F2-1' },
    });

    const current = await new Promise((resolve) => {
      service.currentVendor$.subscribe((v) => resolve(v)).unsubscribe();
    });
    expect(current).toEqual(updatedVendor);
  });

  it('does not call the writer when the option is absent', async () => {
    await service.saveRestaurantInfo({});
    expect(authSpy.updateVendorKioskTerminal).not.toHaveBeenCalled();
  });

  it('supports disabling with a cleared terminal binding', async () => {
    await service.saveRestaurantInfo({
      kioskTerminal: { enabled: false, terminalId: null, terminalLabel: null },
    });

    expect(authSpy.updateVendorKioskTerminal).toHaveBeenCalledOnceWith(
      'vendor-1',
      { enabled: false, terminalId: null, terminalLabel: null }
    );
  });
});
