import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';
import {
  createServiceClient,
  validateAndComputeDiscount,
} from '../_shared/coupons.ts';

interface ValidateCouponBody {
  vendorId?: string;
  code?: string;
  subtotal?: number; // major units
}

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

  let body: ValidateCouponBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const vendorId = (body.vendorId || '').trim();
  const code = (body.code || '').trim();
  const subtotal = Number(body.subtotal);

  if (!vendorId || !code) {
    return json(
      { error: 'vendorId and code are required' },
      { status: 400 }
    );
  }

  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return json(
      { error: 'subtotal must be a positive number (major units)' },
      { status: 400 }
    );
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (e) {
    return json({ error: (e as Error).message }, { status: 500 });
  }

  const result = await validateAndComputeDiscount(supabase, {
    vendorId,
    code,
    subtotal,
  });

  return json(result);
});
