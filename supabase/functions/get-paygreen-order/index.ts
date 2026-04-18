// This file runs on Supabase Edge Functions (Deno runtime)
// Declare Deno for TypeScript tooling in Node projects scanning this file
declare const Deno: any;
import { getPayGreenAuth } from '../_shared/paygreen-auth.ts';

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
  const isSandbox = url.searchParams.get('isSandbox') === 'true';
  if (!vendorId || !paymentId) {
    return json({ error: 'vendorId and paymentId required' }, { status: 400 });
  }

  console.log('Sandbox mode:', isSandbox);

  const apiUrl = frontendApiUrl || Deno.env.get('PG_API_URL') || 'https://api.paygreen.fr';
  console.log('Using PayGreen API URL:', apiUrl);

  try {
    // Authenticate using the shared helper (handles independent vs marketplace)
    const auth = await getPayGreenAuth(vendorId, apiUrl, isSandbox);

    console.log('PayGreen mode:', auth.paygreenMode);

    const detailsRes = await fetch(
      `${apiUrl}/payment/payment-orders/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${auth.token}`,
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
  } catch (error) {
    console.error('Function error:', error);
    return json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
});
