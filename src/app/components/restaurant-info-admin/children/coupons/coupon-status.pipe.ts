import { Pipe, PipeTransform } from '@angular/core';
import { CouponDisplayStatus, CouponRow } from '../../../../models/coupon.model';

/**
 * Computes a coupon's display status from its raw fields, so the list and
 * detail views can show a consistent badge ("Actif", "Expiré", etc.) without
 * each component duplicating the logic.
 */
@Pipe({
  name: 'couponStatus',
})
export class CouponStatusPipe implements PipeTransform {
  transform(coupon: Pick<
    CouponRow,
    'is_active' | 'valid_from' | 'valid_until' | 'current_uses' | 'max_uses'
  >): CouponDisplayStatus {
    if (!coupon.is_active) return 'inactive';
    const now = Date.now();
    const start = Date.parse(coupon.valid_from);
    const end = Date.parse(coupon.valid_until);
    if (Number.isFinite(start) && now < start) return 'scheduled';
    if (Number.isFinite(end) && now > end) return 'expired';
    if (
      coupon.max_uses !== null &&
      coupon.current_uses >= coupon.max_uses
    ) {
      return 'exhausted';
    }
    return 'active';
  }
}
