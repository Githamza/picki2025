// This file runs on Supabase Edge Functions (Deno runtime)
// Declare Deno for TypeScript tooling in Node projects scanning this file
declare const Deno: any;
// @ts-ignore - remote import resolved by Deno at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    ...init,
  });

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeaders } });
  }
  if (req.method !== 'GET') {
    return json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  const url = new URL(req.url);
  const vendorId = url.searchParams.get('vendorId');
  const paymentId = url.searchParams.get('paymentId');
  const frontendApiUrl = url.searchParams.get('apiUrl');
  if (!vendorId || !paymentId) {
    return json({ error: 'vendorId and paymentId required' }, { status: 400 });
  }

  // Use local Supabase URL and service key if LOCALLY is true
  const isLocal = Deno.env.get('LOCALLY') === 'true';
  const supabaseUrl = isLocal 
    ? Deno.env.get('LOCAL_SUPABASE_URL') 
    : Deno.env.get('SUPABASE_URL');
  const serviceKey = isLocal 
    ? Deno.env.get('LOCAL_SUPABASE_SERVICE_ROLE_KEY') 
    : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Server not configured' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: creds } = await supabase
    .from('vendor_paygreen_credentials')
    .select('shop_id, secret_key')
    .eq('vendor_id', vendorId)
    .eq('active', true)
    .single();
  if (!creds) {
    return json({ error: 'Vendor credentials not found' }, { status: 400 });
  }

  const secretKey: string = creds.secret_key;
  // Use API URL from frontend if provided, otherwise fall back to environment variable or default
  const apiUrl = frontendApiUrl || Deno.env.get('PG_API_URL') || 'https://api.paygreen.fr';
  
  console.log('Using PayGreen API URL:', apiUrl);

  // authenticate
  const authRes = await fetch(
    `${apiUrl}/auth/authentication/${creds.shop_id}/secret-key`,
    {
      method: 'POST',
      headers: {
        Authorization: secretKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  );
  if (!authRes.ok) {
    const body = await authRes.text();
    return json({ error: 'Auth error', details: body }, { status: 500 });
  }
  const token = (await authRes.json()).data.token as string;

  const detailsRes = await fetch(
    `${apiUrl}/payment/payment-orders/${paymentId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  );

  const txt = await detailsRes.text();
  return new Response(txt, {
    status: detailsRes.status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
});
