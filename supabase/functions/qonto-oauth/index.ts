// qonto-oauth: per-vendor Qonto connection lifecycle (SPEC-QONTO-TERMINAL.md T6).
//
// The vendor admin connects their Qonto organization from the Paiement page:
//   authorize-url -> browser visits Qonto -> /admin/qonto/callback -> exchange.
// The client secret and every token live exclusively here and in the
// service-role-only vendor_qonto_connections table; responses never carry
// them. All actions require a user JWT belonging to an active admin of the
// vendor (vendor_admin_users), so the anonymous kiosk role can do nothing.
declare const Deno: any;
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  exchangeCodeForTokens,
  getQontoEnv,
  requireVendorAdmin,
  signState,
  verifyState,
} from '../_shared/qonto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-version',
};

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    ...init,
  });

function createServiceClient() {
  const url =
    Deno.env.get('LOCAL_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
  const key =
    Deno.env.get('LOCAL_SUPABASE_SERVICE_ROLE_KEY') ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Supabase service credentials are not configured');
  }
  return createClient(url, key);
}

// organization.read is a "sensitive" scope not granted to our app —
// requesting it makes the sandbox reject the whole request (invalid_scope,
// observed 2026-08-14). Override via QONTO_OAUTH_SCOPES if the app's
// granted scopes ever change.
const OAUTH_SCOPES =
  Deno.env.get('QONTO_OAUTH_SCOPES') ||
  'terminal.read terminal.write offline_access';

async function handleAuthorizeUrl(body: any, supabase: any) {
  const env = getQontoEnv();
  if (!env.clientId) {
    return json({ error: "L'intégration Qonto n'est pas configurée" }, { status: 503 });
  }
  const redirectUri = String(body.redirectUri || '');
  if (!redirectUri) {
    return json({ error: 'redirectUri est requis' }, { status: 400 });
  }
  const state = await signState(env, String(body.vendorId));
  const url =
    `${env.oauthBaseUrl}/oauth2/auth?` +
    new URLSearchParams({
      client_id: env.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: OAUTH_SCOPES,
      state,
    }).toString();
  return json({ url });
}

async function handleExchange(body: any, supabase: any) {
  const env = getQontoEnv();
  const vendorId = String(body.vendorId || '');
  const stateVendor = await verifyState(env, String(body.state || ''));
  if (!stateVendor || stateVendor !== vendorId) {
    return json({ error: 'État OAuth invalide ou expiré' }, { status: 400 });
  }
  const code = String(body.code || '');
  if (!code) {
    return json({ error: 'code est requis' }, { status: 400 });
  }

  const pair = await exchangeCodeForTokens(env, code, String(body.redirectUri || ''));

  const { error } = await supabase.from('vendor_qonto_connections').upsert(
    {
      vendor_id: vendorId,
      organization_id: pair.organization_id ?? null,
      access_token: pair.access_token,
      refresh_token: pair.refresh_token,
      access_token_expires_at: new Date(
        Date.now() + pair.expires_in * 1000
      ).toISOString(),
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'vendor_id' }
  );
  if (error) throw error;

  return json({ connected: true, organizationId: pair.organization_id ?? null });
}

async function handleStatus(body: any, supabase: any) {
  const { data, error } = await supabase
    .from('vendor_qonto_connections')
    .select('organization_id, connected_at')
    .eq('vendor_id', String(body.vendorId))
    .maybeSingle();
  if (error) throw error;
  return json({
    connected: !!data,
    organizationId: data?.organization_id ?? null,
    connectedAt: data?.connected_at ?? null,
  });
}

async function handleDisconnect(body: any, supabase: any) {
  const { error } = await supabase
    .from('vendor_qonto_connections')
    .delete()
    .eq('vendor_id', String(body.vendorId));
  if (error) throw error;
  return json({ connected: false });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const vendorId = String(body.vendorId || '');
    if (!vendorId) {
      return json({ error: 'vendorId est requis' }, { status: 400 });
    }
    const supabase = createServiceClient();
    await requireVendorAdmin(supabase, req, vendorId);

    const action = String(body.action || '');
    if (action === 'authorize-url') return await handleAuthorizeUrl(body, supabase);
    if (action === 'exchange') return await handleExchange(body, supabase);
    if (action === 'status') return await handleStatus(body, supabase);
    if (action === 'disconnect') return await handleDisconnect(body, supabase);
    return json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('qonto-oauth error:', error);
    const status = typeof error?.status === 'number' ? error.status : 500;
    return json({ error: error?.message || 'Internal error' }, { status });
  }
});
