import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type CreateCheckoutSessionBody = {
  vendorId: string; // vendor UUID
  currency: string; // e.g. "EUR"
  items: Array<{
    name: string;
    quantity: number;
    price: number; // major unit, e.g. 12.5 EUR
  }>;
  success_url: string;
  cancel_url: string;
  customer_email?: string;
  metadata?: Record<string, string>;
};

const corsHeaders: Record<string, string> = {
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

function toCents(amount: number): number {
  return Math.round(Number(amount) * 100);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  let body: CreateCheckoutSessionBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const vendorId = (body.vendorId || '').trim();
  const currency = (body.currency || '').trim().toLowerCase();
  const successUrl = (body.success_url || '').trim();
  const cancelUrl = (body.cancel_url || '').trim();
  const customerEmail = (body.customer_email || '').trim();

  if (!vendorId || !currency || !successUrl || !cancelUrl) {
    return json(
      {
        error:
          'vendorId, currency, success_url, and cancel_url are required fields',
      },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return json({ error: 'items must be a non-empty array' }, { status: 400 });
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
  if (!stripeSecretKey) {
    return json({ error: 'STRIPE_SECRET_KEY is not configured' }, { status: 500 });
  }

  const isLocal = Deno.env.get('LOCALLY') === 'true';
  const supabaseUrl = isLocal
    ? Deno.env.get('LOCAL_SUPABASE_URL')
    : Deno.env.get('SUPABASE_URL');
  const serviceKey = isLocal
    ? Deno.env.get('LOCAL_SUPABASE_SERVICE_ROLE_KEY')
    : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    return json(
      { error: 'Supabase service credentials not set' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: vendor, error: vendorError } = await supabase
    .from('vendors')
    .select('id, stripe_account_id, stripe_onboarding_completed')
    .eq('id', vendorId)
    .single();

  if (vendorError || !vendor) {
    return json(
      { error: 'Vendor not found', details: vendorError?.message },
      { status: 400 }
    );
  }

  const connectedAccountId = (vendor.stripe_account_id || '').toString().trim();
  if (!connectedAccountId) {
    return json(
      {
        error:
          'Stripe is not configured for this vendor (missing stripe_account_id)',
      },
      { status: 400 }
    );
  }
  if (!connectedAccountId.startsWith('acct_')) {
    return json(
      {
        error:
          'Invalid stripe_account_id for vendor. Expected a Stripe Connect account id starting with "acct_".',
        details: { stripe_account_id: connectedAccountId },
      },
      { status: 400 }
    );
  }

  if (vendor.stripe_onboarding_completed === false) {
    // Soft warning: still allow test flows, but surface a hint
    console.warn(
      'Vendor stripe_onboarding_completed is false; proceeding anyway for vendor:',
      vendorId
    );
  }

  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', successUrl);
  params.set('cancel_url', cancelUrl);

  if (customerEmail) {
    params.set('customer_email', customerEmail);
  }

  for (let i = 0; i < body.items.length; i++) {
    const item = body.items[i];
    const name = (item?.name || '').toString().trim();
    const quantity = Number(item?.quantity);
    const price = Number(item?.price);

    if (!name || !Number.isFinite(quantity) || quantity <= 0) continue;
    if (!Number.isFinite(price) || price < 0) continue;

    params.set(`line_items[${i}][price_data][currency]`, currency);
    params.set(`line_items[${i}][price_data][product_data][name]`, name);
    params.set(
      `line_items[${i}][price_data][unit_amount]`,
      String(toCents(price))
    );
    params.set(`line_items[${i}][quantity]`, String(quantity));
  }

  // Stripe Connect destination charge
  params.set(
    'payment_intent_data[transfer_data][destination]',
    connectedAccountId
  );
  params.set('payment_intent_data[application_fee_amount]', '0');

  const metadata = body.metadata || {};
  for (const [key, value] of Object.entries(metadata)) {
    const k = (key || '').toString().trim();
    const v = (value ?? '').toString();
    if (!k) continue;
    params.set(`metadata[${k}]`, v);
  }

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const stripeText = await stripeRes.text();
  if (!stripeRes.ok) {
    console.error('Stripe create session failed:', stripeText);
    return json(
      { error: 'Stripe API error', details: stripeText },
      { status: 502 }
    );
  }

  // Stripe response is JSON
  const session = JSON.parse(stripeText);
  return json({
    id: session.id,
    object: session.object,
    url: session.url,
    payment_status: session.payment_status,
    status: session.status,
    metadata: session.metadata,
    currency: session.currency,
    amount_total: session.amount_total,
  });
});


