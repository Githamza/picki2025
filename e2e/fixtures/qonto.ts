/**
 * Qonto terminal fixture (SPEC-QONTO-TERMINAL.md, T2).
 *
 * Flips the kiosk vendor's terminal toggle in the LOCAL database around a
 * test, and restores the previous state afterwards. The seed itself stays
 * toggle-OFF so every existing spec keeps the pay-at-counter flow.
 *
 * Talks to the local Supabase REST endpoint with the well-known
 * supabase-demo service-role JWT (local-only, not a secret — same key
 * `supabase status` prints on every machine). E2e never touches production.
 */

/** Seeded kiosk vendor (supabase/seed.sql). */
export const E2E_KIOSK_VENDOR_ID = 'e2e00000-0000-4000-8000-000000000002';

const LOCAL_REST_URL = 'http://127.0.0.1:54321/rest/v1';
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export interface KioskTerminalSettings {
  kiosk_terminal_enabled: boolean;
  kiosk_terminal_id: string | null;
  kiosk_terminal_label: string | null;
}

/** Mock terminal used when enabling the toggle in tests. */
export const E2E_TERMINAL = {
  id: 'e2e00000-0000-4000-8000-00000000t001',
  label: 'S1F2-000158200000001',
} as const;

async function rest(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const response = await fetch(`${LOCAL_REST_URL}${path}`, {
    ...init,
    headers: {
      apikey: LOCAL_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${LOCAL_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new Error(
      `qonto fixture: ${init.method ?? 'GET'} ${path} -> ${response.status} ${await response.text()}`
    );
  }
  return response;
}

async function readSettings(vendorId: string): Promise<KioskTerminalSettings> {
  const response = await rest(
    `/vendors?id=eq.${vendorId}&select=kiosk_terminal_enabled,kiosk_terminal_id,kiosk_terminal_label`
  );
  const rows = (await response.json()) as KioskTerminalSettings[];
  if (rows.length !== 1) {
    throw new Error(`qonto fixture: vendor ${vendorId} not found in local db`);
  }
  return rows[0];
}

async function writeSettings(
  vendorId: string,
  settings: KioskTerminalSettings
): Promise<void> {
  await rest(`/vendors?id=eq.${vendorId}`, {
    method: 'PATCH',
    body: JSON.stringify(settings),
  });
}

/**
 * Enable the Qonto terminal on the kiosk vendor and return a restore
 * function. Use in beforeEach/afterEach or around a single test:
 *
 *   const restore = await enableKioskTerminal();
 *   try { ... } finally { await restore(); }
 */
export async function enableKioskTerminal(
  vendorId: string = E2E_KIOSK_VENDOR_ID
): Promise<() => Promise<void>> {
  const previous = await readSettings(vendorId);
  await writeSettings(vendorId, {
    kiosk_terminal_enabled: true,
    kiosk_terminal_id: E2E_TERMINAL.id,
    kiosk_terminal_label: E2E_TERMINAL.label,
  });
  return async () => writeSettings(vendorId, previous);
}
