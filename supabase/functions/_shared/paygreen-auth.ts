import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface PayGreenAuthResult {
  token: string;
  shopId: string;
  paygreenMode: 'independent' | 'marketplace';
  vendorShopId: string | null;
  deliverySystem: string | null;
}

/**
 * Shared PayGreen authentication helper.
 * - independent mode: uses vendor's own credentials from vendor_paygreen_credentials
 * - marketplace mode: uses Picki platform credentials from env vars,
 *   and fetches the vendor's shop_id for eligible_amounts
 */
export async function getPayGreenAuth(
  vendorId: string,
  apiUrl: string,
  isSandbox: boolean
): Promise<PayGreenAuthResult> {
  const isLocal = Deno.env.get('LOCALLY') === 'true';
  const supabaseUrl = isLocal
    ? Deno.env.get('LOCAL_SUPABASE_URL')
    : Deno.env.get('SUPABASE_URL');
  const serviceKey = isLocal
    ? Deno.env.get('LOCAL_SUPABASE_SERVICE_ROLE_KEY')
    : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase service credentials not set');
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Fetch vendor's paygreen_mode and delivery_system
  const { data: vendor, error: vendorError } = await supabase
    .from('vendors')
    .select('paygreen_mode, delivery_system')
    .eq('id', vendorId)
    .single();

  if (vendorError || !vendor) {
    throw new Error('Vendor not found');
  }

  const paygreenMode = vendor.paygreen_mode as 'independent' | 'marketplace';
  const deliverySystem = vendor.delivery_system as string | null;

  // Fetch vendor's PayGreen credentials (needed for both modes)
  const { data: creds, error: credsError } = await supabase
    .from('vendor_paygreen_credentials')
    .select('shop_id, secret_key, sandbox_shop_id, sandbox_secret_key')
    .eq('vendor_id', vendorId)
    .eq('active', true)
    .single();

  if (credsError || !creds) {
    throw new Error('Vendor PayGreen credentials not found');
  }

  const vendorShopId = isSandbox ? creds.sandbox_shop_id : creds.shop_id;

  let shopId: string;
  let secretKey: string;

  if (paygreenMode === 'marketplace') {
    // Use Picki platform credentials
    shopId = isSandbox
      ? (Deno.env.get('PICKI_PAYGREEN_SANDBOX_SHOP_ID') || '')
      : (Deno.env.get('PICKI_PAYGREEN_SHOP_ID') || '');
    secretKey = isSandbox
      ? (Deno.env.get('PICKI_PAYGREEN_SANDBOX_SECRET_KEY') || '')
      : (Deno.env.get('PICKI_PAYGREEN_SECRET_KEY') || '');

    if (!shopId || !secretKey) {
      const mode = isSandbox ? 'sandbox' : 'production';
      throw new Error(`Picki platform ${mode} PayGreen credentials not configured`);
    }
  } else {
    // Use vendor's own credentials
    shopId = vendorShopId || '';
    secretKey = isSandbox ? creds.sandbox_secret_key : creds.secret_key;

    if (!shopId || !secretKey) {
      const mode = isSandbox ? 'sandbox' : 'production';
      throw new Error(`Vendor ${mode} PayGreen credentials not configured`);
    }
  }

  // Authenticate with PayGreen
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
    throw new Error(`PayGreen auth failed: ${errBody}`);
  }

  const authData = await authRes.json();
  const token = authData.data.token as string;

  return {
    token,
    shopId,
    paygreenMode,
    vendorShopId,
    deliverySystem,
  };
}
