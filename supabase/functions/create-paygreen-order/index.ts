import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface CreateOrderRequest {
  vendorId: string;
  paymentOrder: any;
  apiUrl?: string;
  isSandbox?: boolean;
}

// Helper to build JSON responses with CORS headers
const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
    },
    ...init,
  });

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  let body: CreateOrderRequest;
  try {
    body = await req.json();
  } catch (_) {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { vendorId, paymentOrder, apiUrl: frontendApiUrl, isSandbox = false } = body;
  if (!vendorId || !paymentOrder) {
    return json(
      { error: 'vendorId and paymentOrder are required' },
      { status: 400 }
    );
  }

  console.log('Sandbox mode:', isSandbox);

  // Initialize Supabase service client
  // Use local Supabase URL and service key if LOCALLY is true
  const isLocal = Deno.env.get('LOCALLY') === 'true';
  const supabaseUrl = isLocal 
    ? Deno.env.get('LOCAL_SUPABASE_URL') 
    : Deno.env.get('SUPABASE_URL');
  const serviceKey = isLocal 
    ? Deno.env.get('LOCAL_SUPABASE_SERVICE_ROLE_KEY') 
    : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase Service Key:', serviceKey);
  if (!supabaseUrl || !serviceKey) {
    return json(
      { error: 'Supabase service credentials not set' },
      { status: 500 }
    );
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  // Fetch PayGreen credentials for this vendor
  // Select both production and sandbox credentials
  const { data: creds, error: credsError } = await supabase
    .from('vendor_paygreen_credentials')
    .select('shop_id, public_key, secret_key, sandbox_shop_id, sandbox_public_key, sandbox_secret_key')
    .eq('vendor_id', vendorId)
    .eq('active', true)
    .single();

  console.log(
    'Fetched credentials for vendor:',
    vendorId,
    creds ? 'Found' : 'Not found'
  );

  if (credsError || !creds) {
    console.error('Credentials error:', credsError);
    return json({ error: 'Credentials not found for vendor' }, { status: 400 });
  }

  // Select the appropriate credentials based on sandbox mode
  const shopId = isSandbox ? creds.sandbox_shop_id : creds.shop_id;
  const secretKey = isSandbox ? creds.sandbox_secret_key : creds.secret_key;

  if (!shopId || !secretKey) {
    const mode = isSandbox ? 'sandbox' : 'production';
    console.error(`Missing ${mode} credentials for vendor:`, vendorId);
    return json({ error: `${mode} credentials not configured for vendor` }, { status: 400 });
  }
  // Use API URL from frontend if provided, otherwise fall back to environment variable or default
  const apiUrl = frontendApiUrl || Deno.env.get('PG_API_URL') || 'https://api.paygreen.fr';
  
  console.log('Using PayGreen API URL:', apiUrl);

  try {
    // 1. Authenticate with PayGreen
    const authRes = await fetch(
      `${apiUrl}/auth/authentication/${shopId}/secret-key`,
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
      const errBody = await authRes.text();
      console.error('PayGreen auth failed:', errBody);
      return json({ error: 'Auth failed', details: errBody }, { status: 500 });
    }

    const authData = await authRes.json();
    const token = authData.data.token as string;

    // 2. Create payment order
    const orderRes = await fetch(`${apiUrl}/payment/payment-orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(paymentOrder),
    });

    if (!orderRes.ok) {
      const errBody = await orderRes.text();
      console.error('PayGreen order creation failed:', errBody);
      return json(
        { error: 'Create order failed', details: errBody },
        { status: 500 }
      );
    }

    const orderJson = await orderRes.json();
    console.log('PayGreen order created successfully');
    return json(orderJson);
  } catch (error) {
    console.error('Function error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
});
