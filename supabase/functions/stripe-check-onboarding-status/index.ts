// Supabase Edge Function (Deno runtime)
// Checks Stripe account onboarding status and updates the vendor record
declare const Deno: any;
// @ts-ignore - resolved by Deno at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type CheckOnboardingStatusBody = {
  vendorId: string;
};

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  let body: CheckOnboardingStatusBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const vendorId = (body.vendorId || '').trim();

  if (!vendorId) {
    return json({ error: 'vendorId is required' }, { status: 400 });
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

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  // Fetch vendor
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

  if (!vendor.stripe_account_id) {
    return json(
      { error: 'Vendor has no Stripe account configured' },
      { status: 400 }
    );
  }

  // Retrieve the Stripe account to check its status
  const accountRes = await fetch(
    `https://api.stripe.com/v1/accounts/${vendor.stripe_account_id}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
      },
    }
  );

  if (!accountRes.ok) {
    const errorText = await accountRes.text();
    console.error('Failed to retrieve Stripe account:', errorText);
    return json(
      { error: 'Failed to retrieve Stripe account status', details: errorText },
      { status: 502 }
    );
  }

  const account = await accountRes.json();

  // Check if onboarding is complete
  // An account is considered fully onboarded when:
  // - details_submitted is true
  // - charges_enabled is true (can accept payments)
  const isOnboardingComplete =
    account.details_submitted === true &&
    account.charges_enabled === true;

  // Update the vendor record if status changed
  if (isOnboardingComplete && !vendor.stripe_onboarding_completed) {
    const { error: updateError } = await supabase
      .from('vendors')
      .update({
        stripe_onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendorId);

    if (updateError) {
      console.error('Failed to update vendor onboarding status:', updateError);
      // Don't fail the request, just log the error
    }
  }

  return json({
    stripe_account_id: vendor.stripe_account_id,
    details_submitted: account.details_submitted,
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    onboarding_complete: isOnboardingComplete,
    requirements: account.requirements,
  });
});
