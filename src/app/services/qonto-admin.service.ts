import { Injectable, inject } from '@angular/core';

import { SupabaseAuthService } from './supabase-auth.service';

export interface QontoConnectionStatus {
  connected: boolean;
  organizationId: string | null;
  connectedAt: string | null;
}

export interface QontoTerminalInfo {
  id: string;
  poi_id: string;
}

/**
 * Reason the kiosk-terminal toggle is blocked, or null when it may be
 * enabled (SPEC-QONTO-TERMINAL.md: connected ∧ terminal ∧ EUR).
 */
export function qontoToggleBlockedReason(input: {
  connected: boolean;
  terminalId: string | null;
  currency: string | null | undefined;
}): string | null {
  if (!input.connected) {
    return "Connectez d'abord votre compte Qonto pour activer le terminal.";
  }
  if (!input.terminalId) {
    return 'Sélectionnez le terminal utilisé par la borne.';
  }
  if (String(input.currency || '').toUpperCase() !== 'EUR') {
    return 'Le terminal Qonto est disponible uniquement pour les devises EUR.';
  }
  return null;
}

/**
 * Admin-side wrapper around the qonto-oauth / qonto-terminal edge functions.
 * Calls run with the signed-in admin's JWT (SupabaseAuthService client);
 * tokens themselves never reach the browser.
 */
@Injectable({ providedIn: 'root' })
export class QontoAdminService {
  private readonly supabaseAuthService = inject(SupabaseAuthService);

  private async invoke<T>(
    functionName: 'qonto-oauth' | 'qonto-terminal',
    body: Record<string, unknown>
  ): Promise<T> {
    const { data, error } = await this.supabaseAuthService
      .getClient()
      .functions.invoke<T>(functionName, { body });
    if (error) {
      throw new Error(error.message || String(error));
    }
    if (!data) {
      throw new Error(`Edge Function '${functionName}' returned no data`);
    }
    return data;
  }

  status(vendorId: string): Promise<QontoConnectionStatus> {
    return this.invoke<QontoConnectionStatus>('qonto-oauth', {
      action: 'status',
      vendorId,
    });
  }

  async authorizeUrl(vendorId: string, redirectUri: string): Promise<string> {
    const { url } = await this.invoke<{ url: string }>('qonto-oauth', {
      action: 'authorize-url',
      vendorId,
      redirectUri,
    });
    return url;
  }

  async exchange(
    vendorId: string,
    code: string,
    state: string,
    redirectUri: string
  ): Promise<void> {
    await this.invoke('qonto-oauth', {
      action: 'exchange',
      vendorId,
      code,
      state,
      redirectUri,
    });
  }

  async disconnect(vendorId: string): Promise<void> {
    await this.invoke('qonto-oauth', { action: 'disconnect', vendorId });
  }

  async listTerminals(vendorId: string): Promise<QontoTerminalInfo[]> {
    const { terminals } = await this.invoke<{ terminals: QontoTerminalInfo[] }>(
      'qonto-terminal',
      { action: 'list-terminals', vendorId }
    );
    return terminals ?? [];
  }
}
