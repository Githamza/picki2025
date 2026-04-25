import { Injectable, inject } from '@angular/core';
import { Observable, from, mergeMap, of, throwError } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { CouponValidationResult } from '../models/coupon.model';

/**
 * Customer-side coupon validation. Calls the `validate-coupon` edge function
 * which uses the service role to read the (RLS-protected) coupons table and
 * returns either a resolved discount amount or a typed failure reason. The
 * result is idempotent and DOES NOT increment the coupon counter.
 */
@Injectable({ providedIn: 'root' })
export class CouponService {
  private readonly supabase = inject(SupabaseService);

  validate(input: {
    vendorId: string;
    code: string;
    subtotal: number;
  }): Observable<CouponValidationResult> {
    return from(
      this.supabase
        .getClient()
        .functions.invoke<CouponValidationResult>('validate-coupon', {
          body: {
            vendorId: input.vendorId,
            code: input.code,
            subtotal: input.subtotal,
          },
        })
    ).pipe(
      mergeMap(({ data, error }) => {
        if (error) {
          return throwError(() => new Error(error.message || String(error)));
        }
        if (!data) {
          return throwError(
            () => new Error("Le service de validation des coupons est indisponible.")
          );
        }
        return of(data);
      })
    );
  }
}
