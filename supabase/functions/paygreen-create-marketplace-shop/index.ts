// Supabase Edge Function (Deno runtime)
// Creates a PayGreen marketplace shop for a vendor
declare const Deno: any;
// @ts-ignore - resolved by Deno at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface CreateMarketplaceShopRequest {
  vendorId: string;
  isSandbox?: boolean;
}

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

  let body: CreateMarketplaceShopRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const vendorId = (body.vendorId || '').trim();
  const isSandbox = body.isSandbox ?? false;

  if (!vendorId) {
    return json({ error: 'vendorId is required' }, { status: 400 });
  }

  // Init Supabase client
  const isLocal = Deno.env.get('LOCALLY') === 'true';
  const supabaseUrl = isLocal
    ? Deno.env.get('LOCAL_SUPABASE_URL')
    : Deno.env.get('SUPABASE_URL');
  const serviceKey = isLocal
    ? Deno.env.get('LOCAL_SUPABASE_SERVICE_ROLE_KEY')
    : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Supabase service credentials not set' }, { status: 500 });
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
    .select('id, business_name, country, paygreen_onboarding_completed')
    .eq('id', vendorId)
    .single();

  if (vendorError || !vendor) {
    return json(
      { error: 'Vendor not found', details: vendorError?.message },
      { status: 400 }
    );
  }

  // Idempotency: if already onboarded, return existing shop_id
  if (vendor.paygreen_onboarding_completed) {
    const { data: existingCreds } = await supabase
      .from('vendor_paygreen_credentials')
      .select('shop_id')
      .eq('vendor_id', vendorId)
      .eq('active', true)
      .single();

    if (existingCreds?.shop_id) {
      console.log(`Vendor ${vendorId} already onboarded, returning existing shop_id`);
      return json({ success: true, shop_id: existingCreds.shop_id });
    }
  }

  // The SIRET lives in vendor_private_info, not on the public vendors row
  const { data: privateInfo } = await supabase
    .from('vendor_private_info')
    .select('national_id')
    .eq('vendor_id', vendorId)
    .maybeSingle();
  const vendorNationalId = privateInfo?.national_id ?? null;

  // Validate national_id
  if (!vendorNationalId) {
    return json(
      { error: 'Le numéro SIRET est requis pour créer un compte PayGreen marketplace' },
      { status: 400 }
    );
  }

  // Fetch vendor_metadata for address
  const { data: metadata, error: metadataError } = await supabase
    .from('vendor_metadata')
    .select('street, city, postal_code, website')
    .eq('vendor_id', vendorId)
    .single();

  if (metadataError || !metadata) {
    return json(
      { error: 'Adresse du vendeur non trouvée. Veuillez compléter vos informations de restaurant.' },
      { status: 400 }
    );
  }

  if (!metadata.street || !metadata.city || !metadata.postal_code) {
    return json(
      { error: 'Adresse incomplète. Veuillez renseigner rue, ville et code postal dans les informations du restaurant.' },
      { status: 400 }
    );
  }

  // Get Picki platform PayGreen credentials
  const shopId = isSandbox
    ? (Deno.env.get('PICKI_PAYGREEN_SANDBOX_SHOP_ID') || '')
    : (Deno.env.get('PICKI_PAYGREEN_SHOP_ID') || '');
  const secretKey = isSandbox
    ? (Deno.env.get('PICKI_PAYGREEN_SANDBOX_SECRET_KEY') || '')
    : (Deno.env.get('PICKI_PAYGREEN_SECRET_KEY') || '');

  if (!shopId || !secretKey) {
    const mode = isSandbox ? 'sandbox' : 'production';
    return json(
      { error: `Picki platform ${mode} PayGreen credentials not configured` },
      { status: 500 }
    );
  }

  const apiUrl = isSandbox
    ? (Deno.env.get('PG_SANDBOX_API_URL') || 'https://sb-api.paygreen.fr')
    : (Deno.env.get('PG_API_URL') || 'https://api.paygreen.fr');

  try {
    // Authenticate with PayGreen using Picki platform credentials
    const authUrl = `${apiUrl}/auth/authentication/${shopId}/secret-key`;
    console.log('PayGreen auth URL:', authUrl);
    console.log('PayGreen shopId:', shopId);
    console.log('PayGreen apiUrl:', apiUrl);
    const authRes = await fetch(
      authUrl,
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
      return json({ error: 'PayGreen authentication failed', details: errBody }, { status: 502 });
    }

    const authData = await authRes.json();
    const token = authData.data.token as string;

    // Create shop via PayGreen API
    const shopBody = {
      name: vendor.business_name,
      national_id: vendorNationalId,
      commercial_name: vendor.business_name,
      address: {
        line_1: metadata.street,
        country: vendor.country || 'FR',
        city: metadata.city,
        postal_code: metadata.postal_code,
      },
      ...(metadata.website && { website_url: metadata.website }),
      activity_categories: ['FOOD'],
    };

    console.log('Creating PayGreen shop for vendor:', vendorId);

    const shopRes = await fetch(`${apiUrl}/account/shops`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(shopBody),
    });

    if (!shopRes.ok) {
      const errBody = await shopRes.text();
      console.error('PayGreen shop creation failed:', errBody);
      return json({ error: 'Failed to create PayGreen shop', details: errBody }, { status: 502 });
    }

    const shopData = await shopRes.json();
    const newShopId = shopData.data.id as string;

    console.log('PayGreen shop created:', newShopId);

    // Upsert vendor_paygreen_credentials
    const { error: upsertError } = await supabase
      .from('vendor_paygreen_credentials')
      .upsert(
        {
          vendor_id: vendorId,
          shop_id: newShopId,
          public_key: null,
          active: true,
        },
        { onConflict: 'vendor_id' }
      );

    if (upsertError) {
      console.error('Error saving PayGreen credentials:', upsertError);
      return json(
        { error: 'Shop created but failed to save credentials', shop_id: newShopId },
        { status: 500 }
      );
    }

    // Update vendor flags
    const { error: vendorUpdateError } = await supabase
      .from('vendors')
      .update({
        paygreen_onboarding_completed: true,
        paygreen_mode: 'marketplace',
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendorId);

    if (vendorUpdateError) {
      console.error('Error updating vendor flags:', vendorUpdateError);
      // Non-fatal: credentials are saved, vendor can still use payments
    }

    return json({ success: true, shop_id: newShopId });
  } catch (error) {
    console.error('Function error:', error);
    return json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
});
