// Supabase Edge Function (Deno runtime)
// Creates a Stripe Express onboarding link for a vendor
// Includes idempotency, retry logic, and account recovery
declare const Deno: any;
// @ts-ignore - resolved by Deno at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SupabaseClient = ReturnType<typeof createClient>;

type CreateOnboardingLinkBody = {
  vendorId: string;
  refreshUrl: string;
  returnUrl: string;
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

/**
 * Update vendor with Stripe account ID, with retry logic and exponential backoff.
 * @param supabase Supabase client
 * @param vendorId Vendor UUID
 * @param stripeAccountId Stripe account ID to save
 * @param maxRetries Maximum retry attempts (default: 3)
 * @returns Object with success status
 */
async function updateVendorWithRetry(
  supabase: SupabaseClient,
  vendorId: string,
  stripeAccountId: string,
  maxRetries = 3
): Promise<{ success: boolean; error?: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { error } = await supabase
      .from('vendors')
      .update({
        stripe_account_id: stripeAccountId,
        stripe_onboarding_completed: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendorId);

    if (!error) {
      return { success: true };
    }

    console.error(`DB update attempt ${attempt}/${maxRetries} failed:`, error.message);

    if (attempt < maxRetries) {
      // Exponential backoff: 200ms, 400ms, 800ms
      const delay = Math.pow(2, attempt) * 100;
      await new Promise((resolve) => setTimeout(resolve, delay));
    } else {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

/**
 * Check if a Stripe Express account already exists for this email (recovery mechanism).
 * This helps recover from scenarios where account was created but DB update failed.
 */
async function findExistingStripeAccount(
  stripeSecretKey: string,
  email: string
): Promise<string | null> {
  try {
    const listRes = await fetch(
      `https://api.stripe.com/v1/accounts?limit=100`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
        },
      }
    );

    if (!listRes.ok) {
      console.error('Failed to list Stripe accounts for recovery check');
      return null;
    }

    const listData = await listRes.json();
    const matchingAccount = listData.data?.find(
      (account: any) => account.email?.toLowerCase() === email.toLowerCase()
    );

    if (matchingAccount) {
      console.log(`Found existing Stripe account ${matchingAccount.id} for email ${email}`);
      return matchingAccount.id;
    }

    return null;
  } catch (error) {
    console.error('Error checking for existing Stripe account:', error);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  let body: CreateOnboardingLinkBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const vendorId = (body.vendorId || '').trim();
  const refreshUrl = (body.refreshUrl || '').trim();
  const returnUrl = (body.returnUrl || '').trim();

  if (!vendorId || !refreshUrl || !returnUrl) {
    return json(
      { error: 'vendorId, refreshUrl, and returnUrl are required' },
      { status: 400 }
    );
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
    .select('id, business_name, country, stripe_account_id')
    .eq('id', vendorId)
    .single();

  if (vendorError || !vendor) {
    return json(
      { error: 'Vendor not found', details: vendorError?.message },
      { status: 400 }
    );
  }

  // Get vendor admin email
  const { data: adminUser, error: adminError } = await supabase
    .from('vendor_admin_users')
    .select('email')
    .eq('vendor_id', vendorId)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (adminError || !adminUser?.email) {
    return json(
      { error: 'Vendor admin email not found', details: adminError?.message },
      { status: 400 }
    );
  }

  let stripeAccountId = vendor.stripe_account_id;

  // If no Stripe account in DB, check if one exists on Stripe (recovery from failed DB save)
  if (!stripeAccountId) {
    console.log(`No stripe_account_id for vendor ${vendorId}, checking for existing account...`);

    const existingAccountId = await findExistingStripeAccount(stripeSecretKey, adminUser.email);

    if (existingAccountId) {
      console.log(`Recovering existing Stripe account ${existingAccountId} for vendor ${vendorId}`);
      stripeAccountId = existingAccountId;

      // Save recovered account to DB with retry
      const recoveryResult = await updateVendorWithRetry(supabase, vendorId, stripeAccountId);
      if (!recoveryResult.success) {
        console.error('Failed to save recovered Stripe account to DB:', recoveryResult.error);
        // Continue anyway since we have the account ID
      }
    }
  }

  // If still no Stripe account, create one
  if (!stripeAccountId) {
    const createAccountParams = new URLSearchParams();
    createAccountParams.set('type', 'express');
    createAccountParams.set('country', vendor.country || 'FR');
    createAccountParams.set('email', adminUser.email);
    createAccountParams.set('business_type', 'individual');
    createAccountParams.set('capabilities[card_payments][requested]', 'true');
    createAccountParams.set('capabilities[transfers][requested]', 'true');

    const createRes = await fetch('https://api.stripe.com/v1/accounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        // Idempotency key prevents duplicate account creation on retries
        'Idempotency-Key': `vendor-account-${vendorId}`,
      },
      body: createAccountParams.toString(),
    });

    const createText = await createRes.text();
    if (!createRes.ok) {
      console.error('Stripe create account failed:', createText);
      return json(
        { error: 'Failed to create Stripe account', details: createText },
        { status: 502 }
      );
    }

    const account = JSON.parse(createText);
    stripeAccountId = account.id;

    // Save the Stripe account ID to the vendor with retry logic
    const updateResult = await updateVendorWithRetry(supabase, vendorId, stripeAccountId);

    if (!updateResult.success) {
      console.error('All DB update attempts failed:', updateResult.error);
      // Return error but include the account ID so frontend can retry or handle it
      return json(
        {
          error: 'Stripe account created but failed to save to database. Please try again.',
          stripe_account_id: stripeAccountId,
          recoverable: true,
        },
        { status: 500 }
      );
    }
  }

  // Create account link for onboarding
  const linkParams = new URLSearchParams();
  linkParams.set('account', stripeAccountId);
  linkParams.set('refresh_url', refreshUrl);
  linkParams.set('return_url', returnUrl);
  linkParams.set('type', 'account_onboarding');

  const linkRes = await fetch('https://api.stripe.com/v1/account_links', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: linkParams.toString(),
  });

  const linkText = await linkRes.text();
  if (!linkRes.ok) {
    console.error('Stripe create account link failed:', linkText);
    return json(
      { error: 'Failed to create onboarding link', details: linkText },
      { status: 502 }
    );
  }

  const accountLink = JSON.parse(linkText);

  return json({
    url: accountLink.url,
    expires_at: accountLink.expires_at,
    stripe_account_id: stripeAccountId,
  });
});
