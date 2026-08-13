// Shared Qonto plumbing for the qonto-terminal / qonto-oauth edge functions
// (SPEC-QONTO-TERMINAL.md). Everything that touches Qonto lives server-side:
// tokens, client secret, and the charged amount never reach the browser.
//
// QONTO_MOCK=true swaps the real Qonto API for a deterministic in-process
// simulator so local dev, CI, and e2e need no Qonto account:
//   - totals ending in .13  -> REFUSED (failure_reason 'card_declined') ~2s in
//   - totals ending in .99  -> stays PENDING forever (timeout path)
//   - anything else         -> AUTHORIZED ~3s after payment creation
// The mock is stateless across processes: the payment id encodes its creation
// time and amount (mock-<epoch_ms>-<cents>-<uuid>), so any instance can derive
// the outcome.
declare const Deno: any;

export interface QontoEnv {
  mock: boolean;
  apiBaseUrl: string;
  oauthBaseUrl: string;
  clientId: string;
  clientSecret: string;
  stagingToken: string;
  stateSecret: string;
}

export function getQontoEnv(): QontoEnv {
  return {
    mock: (Deno.env.get('QONTO_MOCK') || '').toLowerCase() === 'true',
    apiBaseUrl:
      Deno.env.get('QONTO_API_BASE_URL') || 'https://thirdparty.qonto.com',
    oauthBaseUrl:
      Deno.env.get('QONTO_OAUTH_BASE_URL') || 'https://oauth.qonto.com',
    clientId: Deno.env.get('QONTO_CLIENT_ID') || '',
    clientSecret: Deno.env.get('QONTO_CLIENT_SECRET') || '',
    stagingToken: Deno.env.get('QONTO_STAGING_TOKEN') || '',
    stateSecret: Deno.env.get('QONTO_STATE_SECRET') || '',
  };
}

export type TerminalPaymentStatus = 'PENDING' | 'AUTHORIZED' | 'REFUSED';

export interface TerminalPaymentResult {
  id: string;
  status: TerminalPaymentStatus;
  failure_reason: string | null;
  payment_method: string | null;
  card_summary: string | null;
}

/** Authenticated fetch against the Qonto Business API (adds sandbox header). */
export async function qontoFetch(
  env: QontoEnv,
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  };
  if (env.stagingToken) headers['X-Qonto-Staging-Token'] = env.stagingToken;
  return fetch(`${env.apiBaseUrl}${path}`, { ...init, headers });
}

// ---------------------------------------------------------------------------
// Mock simulator
// ---------------------------------------------------------------------------

const MOCK_REFUSE_DELAY_MS = 2_000;
const MOCK_AUTHORIZE_DELAY_MS = 3_000;

export function mockCreatePayment(amountValue: string): { id: string } {
  const cents = Math.round(Number(amountValue) * 100);
  return { id: `mock-${Date.now()}-${cents}-${crypto.randomUUID()}` };
}

export function mockGetPayment(paymentId: string): TerminalPaymentResult {
  const match = /^mock-(\d+)-(\d+)-/.exec(paymentId);
  if (!match) {
    return {
      id: paymentId,
      status: 'REFUSED',
      failure_reason: 'unknown_mock_payment',
      payment_method: null,
      card_summary: null,
    };
  }
  const createdAt = Number(match[1]);
  const cents = Number(match[2]);
  const elapsed = Date.now() - createdAt;
  const endsIn = cents % 100;

  if (endsIn === 99) {
    return pending(paymentId); // never resolves: exercises the timeout path
  }
  if (endsIn === 13) {
    return elapsed >= MOCK_REFUSE_DELAY_MS
      ? {
          id: paymentId,
          status: 'REFUSED',
          failure_reason: 'card_declined',
          payment_method: null,
          card_summary: null,
        }
      : pending(paymentId);
  }
  return elapsed >= MOCK_AUTHORIZE_DELAY_MS
    ? {
        id: paymentId,
        status: 'AUTHORIZED',
        failure_reason: null,
        payment_method: 'cartebancaire',
        card_summary: '4242',
      }
    : pending(paymentId);
}

function pending(paymentId: string): TerminalPaymentResult {
  return {
    id: paymentId,
    status: 'PENDING',
    failure_reason: null,
    payment_method: null,
    card_summary: null,
  };
}
