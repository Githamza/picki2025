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

export function mockListTerminals(): Array<{ id: string; poi_id: string }> {
  return [
    { id: 'e2e00000-0000-4000-8000-00000000t001', poi_id: 'S1F2-MOCK-000001' },
    { id: 'e2e00000-0000-4000-8000-00000000t002', poi_id: 'S1F2-MOCK-000002' },
  ];
}

// ---------------------------------------------------------------------------
// OAuth state (CSRF): base64url(payload).base64url(hmac-sha256(payload))
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  return atob(s.replace(/-/g, '+').replace(/_/g, '/'));
}

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

export async function signState(env: QontoEnv, vendorId: string): Promise<string> {
  if (!env.stateSecret) throw new Error('QONTO_STATE_SECRET is not configured');
  const payload = b64url(
    encoder.encode(
      JSON.stringify({
        v: vendorId,
        exp: Date.now() + 10 * 60 * 1000,
        n: crypto.randomUUID(),
      })
    )
  );
  const signature = b64url(await hmac(env.stateSecret, payload));
  return `${payload}.${signature}`;
}

/** Returns the vendor id bound to a valid state, or null. */
export async function verifyState(env: QontoEnv, state: string): Promise<string | null> {
  if (!env.stateSecret) return null;
  const [payload, signature] = String(state).split('.');
  if (!payload || !signature) return null;
  const expected = b64url(await hmac(env.stateSecret, payload));
  if (expected !== signature) return null;
  try {
    const data = JSON.parse(b64urlDecode(payload));
    if (typeof data.v !== 'string' || Date.now() > Number(data.exp)) return null;
    return data.v;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Vendor admin verification
// ---------------------------------------------------------------------------

/** Verify the request carries a real user JWT belonging to an active admin of
 *  vendorId. Throws {status: 401|403} errors otherwise. */
export async function requireVendorAdmin(
  supabase: any,
  req: Request,
  vendorId: string
): Promise<void> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data, error } = await supabase.auth.getUser(token);
  const user = data?.user;
  if (error || !user) {
    throw Object.assign(new Error('Authentification requise'), { status: 401 });
  }
  const { data: membership, error: membershipError } = await supabase
    .from('vendor_admin_users')
    .select('id')
    .eq('user_id', user.id)
    .eq('vendor_id', vendorId)
    .eq('is_active', true)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) {
    throw Object.assign(new Error('Accès refusé pour ce restaurant'), {
      status: 403,
    });
  }
}

// ---------------------------------------------------------------------------
// Tokens: refresh + rotation
// ---------------------------------------------------------------------------

interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  organization_id?: string;
}

export async function exchangeCodeForTokens(
  env: QontoEnv,
  code: string,
  redirectUri: string
): Promise<TokenPair> {
  if (env.mock) {
    return {
      access_token: `mock-access-${crypto.randomUUID()}`,
      refresh_token: `mock-refresh-${crypto.randomUUID()}`,
      expires_in: 3600,
      organization_id: 'mock-organization',
    };
  }
  const response = await fetch(`${env.oauthBaseUrl}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: env.clientId,
      client_secret: env.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error('Qonto token exchange failed:', response.status, text);
    throw Object.assign(new Error('Échange du code Qonto impossible'), {
      status: 502,
    });
  }
  return JSON.parse(text);
}

async function refreshTokens(env: QontoEnv, refreshToken: string): Promise<TokenPair> {
  if (env.mock) {
    return {
      access_token: `mock-access-${crypto.randomUUID()}`,
      refresh_token: `mock-refresh-${crypto.randomUUID()}`,
      expires_in: 3600,
    };
  }
  const response = await fetch(`${env.oauthBaseUrl}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.clientId,
      client_secret: env.clientSecret,
      refresh_token: refreshToken,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error('Qonto token refresh failed:', response.status, text);
    throw Object.assign(new Error('refresh_failed'), { status: 502 });
  }
  return JSON.parse(text);
}

/**
 * Valid access token for a vendor, refreshing if expired. Qonto refresh
 * tokens are ONE-TIME USE, so rotation is serialized with an atomic
 * compare-and-swap on the refresh token: the UPDATE only lands if the row
 * still holds the token we refreshed with. A loser of the race re-reads the
 * row and uses the winner's fresh access token — no lost update, no lock.
 */
export async function getValidAccessToken(
  supabase: any,
  env: QontoEnv,
  vendorId: string
): Promise<string> {
  const read = async () => {
    const { data, error } = await supabase
      .from('vendor_qonto_connections')
      .select('access_token, access_token_expires_at, refresh_token')
      .eq('vendor_id', vendorId)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const connection = await read();
  if (!connection) {
    throw Object.assign(new Error("Ce restaurant n'est pas connecté à Qonto"), {
      status: 403,
    });
  }
  const freshUntil = Date.now() + 60_000;
  if (new Date(connection.access_token_expires_at).getTime() > freshUntil) {
    return connection.access_token;
  }

  let pair: TokenPair;
  try {
    pair = await refreshTokens(env, connection.refresh_token);
  } catch (refreshError) {
    // A concurrent instance may have consumed the one-time refresh token
    // between our read and our refresh. If it left a fresh pair, use it.
    const latest = await read();
    if (
      latest &&
      latest.refresh_token !== connection.refresh_token &&
      new Date(latest.access_token_expires_at).getTime() > Date.now()
    ) {
      return latest.access_token;
    }
    throw Object.assign(
      new Error('La connexion Qonto a expiré — reconnectez le compte'),
      { status: 502, cause: refreshError }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from('vendor_qonto_connections')
    .update({
      access_token: pair.access_token,
      refresh_token: pair.refresh_token,
      access_token_expires_at: new Date(
        Date.now() + pair.expires_in * 1000
      ).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('vendor_id', vendorId)
    .eq('refresh_token', connection.refresh_token) // CAS: only if unrotated
    .select('vendor_id');
  if (updateError) throw updateError;

  if (updated?.length) return pair.access_token;

  // Lost the race: someone else rotated first — their pair is canonical.
  const latest = await read();
  if (latest) return latest.access_token;
  throw Object.assign(new Error("Ce restaurant n'est pas connecté à Qonto"), {
    status: 403,
  });
}
