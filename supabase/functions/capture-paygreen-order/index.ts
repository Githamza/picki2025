// This file runs on Supabase Edge Functions (Deno runtime)
// Declare Deno for TypeScript tooling in Node projects scanning this file
declare const Deno: any;
import { getPayGreenAuth } from '../_shared/paygreen-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  const { vendorId, paymentId, apiUrl: frontendApiUrl, isSandbox = false } = await req.json();
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

    const captureRes = await fetch(
      `${apiUrl}/payment/payment-orders/${paymentId}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    const txt = await captureRes.text();
    return new Response(txt, {
      status: captureRes.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Function error:', error);
    return json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
});
