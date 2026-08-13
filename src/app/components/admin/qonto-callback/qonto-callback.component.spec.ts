import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';

import { QontoCallbackComponent } from './qonto-callback.component';
import { QontoAdminService } from '../../../services/qonto-admin.service';
import { VendorService } from '../../../services/vendor.service';

describe('QontoCallbackComponent', () => {
  let qontoSpy: jasmine.SpyObj<QontoAdminService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let queryParams: Record<string, string>;

  const vendor = { id: 'vendor-1' } as any;

  function createComponent(): ComponentFixture<QontoCallbackComponent> {
    TestBed.configureTestingModule({
      imports: [QontoCallbackComponent],
      providers: [
        { provide: QontoAdminService, useValue: qontoSpy },
        { provide: VendorService, useValue: { getCurrentVendor: () => vendor } },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParams } },
        },
      ],
    });
    const fixture = TestBed.createComponent(QontoCallbackComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    qontoSpy = jasmine.createSpyObj<QontoAdminService>('QontoAdminService', [
      'exchange',
      'authorizeUrl',
    ]);
    qontoSpy.exchange.and.resolveTo();
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    queryParams = { code: 'the-code', state: 'the-state' };
  });

  it('exchanges the code + state for the current vendor', async () => {
    const fixture = createComponent();
    await fixture.whenStable();

    expect(qontoSpy.exchange).toHaveBeenCalledOnceWith(
      'vendor-1',
      'the-code',
      'the-state',
      `${window.location.origin}/admin/qonto/callback`
    );
  });

  it('routes back to the Paiement page on success', async () => {
    const fixture = createComponent();
    await fixture.whenStable();

    expect(routerSpy.navigate).toHaveBeenCalledWith(
      ['/admin/restaurant-info/paiement'],
      jasmine.anything()
    );
  });

  it('shows the error state with a retry button when the exchange fails', async () => {
    qontoSpy.exchange.and.rejectWith(new Error('nope'));
    const fixture = createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(routerSpy.navigate).not.toHaveBeenCalled();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Réessayer');
  });

  it('treats missing code/state as an error', async () => {
    queryParams = {};
    const fixture = createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(qontoSpy.exchange).not.toHaveBeenCalled();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Réessayer');
  });
});
