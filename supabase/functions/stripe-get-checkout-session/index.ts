import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';

type GetCheckoutSessionBody = {
  sessionId: string;
};

const corsHeaders: Record<string, string> = {
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  let body: GetCheckoutSessionBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const sessionId = (body.sessionId || '').trim();
  if (!sessionId) {
    return json({ error: 'sessionId is required' }, { status: 400 });
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
  if (!stripeSecretKey) {
    return json({ error: 'STRIPE_SECRET_KEY is not configured' }, { status: 500 });
  }

  const url = new URL(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`);
  url.searchParams.append('expand[]', 'line_items');

  const stripeRes = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
    },
  });

  const stripeText = await stripeRes.text();
  if (!stripeRes.ok) {
    console.error('Stripe get session failed:', stripeText);
    return json(
      { error: 'Stripe API error', details: stripeText },
      { status: 502 }
    );
  }

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
    customer_details: session.customer_details,
    line_items: session.line_items,
    created: session.created,
    expires_at: session.expires_at,
  });
});





