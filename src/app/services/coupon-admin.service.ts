import { Injectable, inject } from '@angular/core';
import { SupabaseAuthService } from './supabase-auth.service';
import {
  CouponInsert,
  CouponRow,
  CouponUpdate,
} from '../models/coupon.model';

/**
 * Vendor-side CRUD for coupons. Uses the authenticated Supabase client so the
 * server-side RLS policies (vendor_admin_users.id = auth.uid()) enforce that
 * an admin can only see and mutate their own vendor's coupons.
 */
@Injectable({ providedIn: 'root' })
export class CouponAdminService {
  private readonly auth = inject(SupabaseAuthService);

  async list(vendorId: string): Promise<CouponRow[]> {
    const { data, error } = await this.auth
      .getClient()
      .from('coupons')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load coupons: ${error.message}`);
    }
    return (data ?? []) as CouponRow[];
  }

  async create(input: CouponInsert): Promise<CouponRow> {
    const normalized: CouponInsert = {
      ...input,
      code: input.code.trim().toUpperCase(),
    };

    const { data, error } = await this.auth
      .getClient()
      .from('coupons')
      .insert(normalized)
      .select()
      .single();

    if (error) {
      throw this.toFriendlyError(error);
    }
    return data as CouponRow;
  }

  async update(id: string, patch: CouponUpdate): Promise<CouponRow> {
    const normalized: CouponUpdate = {
      ...patch,
      ...(patch.code !== undefined
        ? { code: patch.code.trim().toUpperCase() }
        : {}),
    };

    const { data, error } = await this.auth
      .getClient()
      .from('coupons')
      .update(normalized)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw this.toFriendlyError(error);
    }
    return data as CouponRow;
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    await this.update(id, { is_active: isActive });
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.auth
      .getClient()
      .from('coupons')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete coupon: ${error.message}`);
    }
  }

  private toFriendlyError(error: { message: string; code?: string }): Error {
    if (error.code === '23505') {
      return new Error('Ce code existe déjà pour ce restaurant.');
    }
    if (error.code === '23514') {
      return new Error(
        'Valeurs invalides : vérifiez le pourcentage (1-100) ou le montant fixe.'
      );
    }
    return new Error(`Opération impossible : ${error.message}`);
  }
}
