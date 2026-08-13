import { TestBed } from '@angular/core/testing';

import {
  QontoAdminService,
  qontoToggleBlockedReason,
} from './qonto-admin.service';
import { SupabaseAuthService } from './supabase-auth.service';

describe('QontoAdminService', () => {
  let service: QontoAdminService;
  let invokeSpy: jasmine.Spy;

  beforeEach(() => {
    invokeSpy = jasmine
      .createSpy('invoke')
      .and.resolveTo({ data: {}, error: null });
    const clientStub = { functions: { invoke: invokeSpy } };
    TestBed.configureTestingModule({
      providers: [
        QontoAdminService,
        {
          provide: SupabaseAuthService,
          useValue: { getClient: () => clientStub },
        },
      ],
    });
    service = TestBed.inject(QontoAdminService);
  });

  it('status invokes qonto-oauth with the vendor id', async () => {
    invokeSpy.and.resolveTo({
      data: { connected: true, organizationId: 'org', connectedAt: 'now' },
      error: null,
    });
    const status = await service.status('v1');
    expect(invokeSpy).toHaveBeenCalledWith('qonto-oauth', {
      body: { action: 'status', vendorId: 'v1' },
    });
    expect(status.connected).toBeTrue();
  });

  it('authorizeUrl returns the url from the edge function', async () => {
    invokeSpy.and.resolveTo({ data: { url: 'https://oauth.qonto.com/x' }, error: null });
    const url = await service.authorizeUrl('v1', 'http://app/callback');
    expect(invokeSpy).toHaveBeenCalledWith('qonto-oauth', {
      body: {
        action: 'authorize-url',
        vendorId: 'v1',
        redirectUri: 'http://app/callback',
      },
    });
    expect(url).toBe('https://oauth.qonto.com/x');
  });

  it('exchange forwards code + state', async () => {
    await service.exchange('v1', 'the-code', 'the-state', 'http://app/callback');
    expect(invokeSpy).toHaveBeenCalledWith('qonto-oauth', {
      body: {
        action: 'exchange',
        vendorId: 'v1',
        code: 'the-code',
        state: 'the-state',
        redirectUri: 'http://app/callback',
      },
    });
  });

  it('listTerminals maps the terminals array', async () => {
    invokeSpy.and.resolveTo({
      data: { terminals: [{ id: 't1', poi_id: 'S1F2-1' }] },
      error: null,
    });
    const terminals = await service.listTerminals('v1');
    expect(invokeSpy).toHaveBeenCalledWith('qonto-terminal', {
      body: { action: 'list-terminals', vendorId: 'v1' },
    });
    expect(terminals).toEqual([{ id: 't1', poi_id: 'S1F2-1' }]);
  });

  it('rejects when the edge function reports an error', async () => {
    invokeSpy.and.resolveTo({ data: null, error: { message: 'nope' } });
    await expectAsync(service.status('v1')).toBeRejectedWithError('nope');
  });
});

describe('qontoToggleBlockedReason (truth table)', () => {
  it('blocks when not connected', () => {
    expect(
      qontoToggleBlockedReason({ connected: false, terminalId: 't1', currency: 'EUR' })
    ).toContain('Qonto');
  });

  it('blocks when no terminal is selected', () => {
    expect(
      qontoToggleBlockedReason({ connected: true, terminalId: null, currency: 'EUR' })
    ).toContain('terminal');
  });

  it('blocks when the vendor currency is not EUR', () => {
    expect(
      qontoToggleBlockedReason({ connected: true, terminalId: 't1', currency: 'GBP' })
    ).toContain('EUR');
  });

  it('allows when connected, terminal chosen, and currency EUR', () => {
    expect(
      qontoToggleBlockedReason({ connected: true, terminalId: 't1', currency: 'EUR' })
    ).toBeNull();
  });

  it('treats a lowercase eur as EUR', () => {
    expect(
      qontoToggleBlockedReason({ connected: true, terminalId: 't1', currency: 'eur' })
    ).toBeNull();
  });
});
