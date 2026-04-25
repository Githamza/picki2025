import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type CouponDiscountType = 'percentage' | 'fixed';

export interface CouponValidationInput {
  vendorId: string;
  code: string;
  subtotal: number; // major units (e.g. 12.50 EUR)
}

export type CouponValidationFailure =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'EXPIRED'
  | 'EXHAUSTED'
  | 'BELOW_MIN_SUBTOTAL';

export type CouponValidationResult =
  | {
      valid: true;
      couponId: string;
      code: string;
      discountType: CouponDiscountType;
      discountAmount: number; // major units, rounded to 2 decimals
    }
  | {
      valid: false;
      reason: CouponValidationFailure;
      minSubtotal?: number;
    };

interface CouponRow {
  id: string;
  code: string;
  vendor_id: string;
  is_active: boolean;
  discount_type: CouponDiscountType;
  discount_value: number | null;
  discount_percent: number | null;
  valid_from: string;
  valid_until: string;
  max_uses: number | null;
  current_uses: number;
  min_subtotal: number | null;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Build a service-role Supabase client. Mirrors the env-var resolution used
 * across the project's edge functions (LOCALLY toggle + LOCAL_SUPABASE_*).
 */
export function createServiceClient(): SupabaseClient {
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

  return createClient(supabaseUrl, serviceKey);
}

/**
 * Validate a coupon code against a subtotal and compute the resolved discount,
 * without mutating the counter (idempotent). Used by both validate-coupon and
 * the checkout edge functions for server-side recomputation.
 */
export async function validateAndComputeDiscount(
  supabase: SupabaseClient,
  { vendorId, code, subtotal }: CouponValidationInput
): Promise<CouponValidationResult> {
  const normalizedCode = (code || '').toString().trim().toUpperCase();
  const safeSubtotal = Number.isFinite(subtotal) && subtotal > 0 ? subtotal : 0;

  if (!vendorId || !normalizedCode || safeSubtotal <= 0) {
    return { valid: false, reason: 'NOT_FOUND' };
  }

  // Note: code uniqueness is per (vendor_id, code), so this returns at most one row.
  const { data, error } = await supabase
    .from('coupons')
    .select(
      'id, code, vendor_id, is_active, discount_type, discount_value, discount_percent, valid_from, valid_until, max_uses, current_uses, min_subtotal'
    )
    .eq('vendor_id', vendorId)
    .eq('code', normalizedCode)
    .maybeSingle();

  if (error) {
    console.error('[coupons] lookup failed:', error);
    return { valid: false, reason: 'NOT_FOUND' };
  }
  if (!data) {
    return { valid: false, reason: 'NOT_FOUND' };
  }

  const coupon = data as CouponRow;

  if (!coupon.is_active) {
    return { valid: false, reason: 'INACTIVE' };
  }

  const now = Date.now();
  const validFromMs = Date.parse(coupon.valid_from);
  const validUntilMs = Date.parse(coupon.valid_until);
  if (
    !Number.isFinite(validFromMs) ||
    !Number.isFinite(validUntilMs) ||
    now < validFromMs ||
    now > validUntilMs
  ) {
    return { valid: false, reason: 'EXPIRED' };
  }

  if (
    coupon.max_uses !== null &&
    coupon.current_uses >= coupon.max_uses
  ) {
    return { valid: false, reason: 'EXHAUSTED' };
  }

  if (
    coupon.min_subtotal !== null &&
    safeSubtotal < Number(coupon.min_subtotal)
  ) {
    return {
      valid: false,
      reason: 'BELOW_MIN_SUBTOTAL',
      minSubtotal: Number(coupon.min_subtotal),
    };
  }

  let discount = 0;
  if (coupon.discount_type === 'percentage' && coupon.discount_percent !== null) {
    discount = round2((safeSubtotal * Number(coupon.discount_percent)) / 100);
  } else if (coupon.discount_type === 'fixed' && coupon.discount_value !== null) {
    discount = round2(Math.min(Number(coupon.discount_value), safeSubtotal));
  }

  if (discount <= 0) {
    return { valid: false, reason: 'NOT_FOUND' };
  }

  return {
    valid: true,
    couponId: coupon.id,
    code: coupon.code,
    discountType: coupon.discount_type,
    discountAmount: discount,
  };
}
