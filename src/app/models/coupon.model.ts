import { Database } from '../types/supabase.types';

export type CouponDiscountType = Database['public']['Enums']['coupon_discount_type'];

export type CouponRow = Database['public']['Tables']['coupons']['Row'];
export type CouponInsert = Database['public']['Tables']['coupons']['Insert'];
export type CouponUpdate = Database['public']['Tables']['coupons']['Update'];

/**
 * The coupon currently applied in the customer's cart, after server validation.
 * All amounts are in major units of the vendor's currency.
 */
export interface AppliedCoupon {
  couponId: string;
  code: string;
  discountType: CouponDiscountType;
  discountAmount: number;
}

export type CouponValidationFailureReason =
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
      discountAmount: number;
    }
  | {
      valid: false;
      reason: CouponValidationFailureReason;
      minSubtotal?: number;
    };

/** UI-facing aggregated status used by the admin coupon list. */
export type CouponDisplayStatus =
  | 'active'
  | 'scheduled'
  | 'expired'
  | 'exhausted'
  | 'inactive';
