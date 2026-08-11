import { Injectable, OnDestroy } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Database } from '../types/supabase.types';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService implements OnDestroy {
  private static instance: SupabaseClient<Database> | null = null;
  private static serviceInstance: SupabaseService | null = null;
  private supabase!: SupabaseClient<Database>;

  constructor() {
    // Ensure only one service instance is created (true singleton)
    if (SupabaseService.serviceInstance) {
      return SupabaseService.serviceInstance;
    }

    // Ensure only one Supabase client instance is created for ANONYMOUS operations
    if (!SupabaseService.instance) {
      SupabaseService.instance = createClient<Database>(
        environment.supabase.url,
        environment.supabase.anonKey,
        {
          auth: {
            autoRefreshToken: false, // Disable for anonymous operations
            // Persist session in localStorage
            persistSession: true,
            // Detect session in URL (for OAuth flows)
            detectSessionInUrl: false, // Disable for anonymous operations
            // Storage key for session persistence - ANONYMOUS USERS
            storageKey: 'supabase.anonymous.token',
            // Storage implementation (uses localStorage by default)
            storage:
              typeof window !== 'undefined' ? window.sessionStorage : undefined,
            // Add flow type to prevent lock conflicts
            flowType: 'pkce',
          },
        }
      );
    }

    this.supabase = SupabaseService.instance;
    SupabaseService.serviceInstance = this;
  }

  // Get the Supabase client instance
  getClient(): SupabaseClient<Database> {
    return this.supabase;
  }

  /**
   * Cleanup method when service is destroyed
   * This will be called when the application is destroyed
   */
  ngOnDestroy(): void {
    // Reset static instances for potential re-initialization
    SupabaseService.serviceInstance = null;
    SupabaseService.instance = null;
  }

  // Categories
  async getCategories() {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order')
      

    if (error) throw error;
    return data;
  }

  // Get categories that have products for a specific vendor
  async getCategoriesByVendor(vendorId: string) {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .eq('vendorId', vendorId)
      .order('display_order');

    if (error) throw error;
    return data;
  }

  // Products
  async getProducts(
    categoryId?: number,
    vendorId?: string,
    includeSteps: boolean = false
  ) {
    let query = this.supabase
      .from('products')
      .select(
        `
        *,
        categories (
          id,
          name,
          icon
        ),
        product_options (
          id,
          name,
          price_adjustment,
          is_available
        )${
          includeSteps
            ? `,
        product_steps (
          id,
          name,
          display_order,
          product_step_options (
            id,
            name,
            price_adjustment,
            product_id
          )
        )`
            : ''
        }
      `
      )
      .eq('is_available', true)
      .or('no_catalogable.is.false,no_catalogable.is.null');

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  async getAllProducts(vendorId?: string, includeSteps: boolean = false) {
    let query = this.supabase
      .from('products')
      .select(
        `
        *,
        categories (
          id,
          name,
          icon
        ),
        product_options (
          id,
          name,
          price_adjustment,
          is_available
        )${
          includeSteps
            ? `,
        product_steps (
          id,
          name,
          display_order,
          product_step_options (
            id,
            name,
            price_adjustment,
            product_id
          )
        )`
            : ''
        }
      `
      )
      .eq('is_available', true)
      .or('no_catalogable.is.false,no_catalogable.is.null');

    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  // NEW: Menus -------------------------------------------------------------
  // async getMenus(categoryId?: number, vendorId?: string) {
  //   // Cast to any because generated types don't include the `menus` table yet
  //   const supa = this.supabase as unknown as SupabaseClient<any>;
  //
  //   // @ts-ignore
  //   let query = supa
  //     .from('menus')
  //     .select(
  //       `
  //         *,
  //         categories ( id, name, icon )
  //       `
  //     )
  //     .eq('is_active', true);
  //
  //   if (categoryId) {
  //     query = query.eq('category_id', categoryId);
  //   }
  //
  //   if (vendorId) {
  //     query = query.eq('vendor_id', vendorId);
  //   }
  //
  //   const { data, error } = await query.order('name');
  //
  //   if (error) throw error;
  //   return data;
  // }

  async updateProductAvailability(productId: number, isAvailable: boolean) {
    const { data, error } = await this.supabase
      .from('products')
      .update({
        is_available: isAvailable,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getProductById(id: number) {
    const { data, error } = await this.supabase
      .from('products')
      .select(
        `
        *,
        categories (
          id,
          name,
          icon
        ),
        product_options (
          id,
          name,
          price_adjustment,
          is_available
        )
      `
      )
      .eq('id', id)
      .eq('is_available', true)
      .or('no_catalogable.is.false,no_catalogable.is.null')
      .single();

    if (error) throw error;
    return data;
  }

  // Product Complements
  async getProductComplements(productId: number) {
    const { data, error } = await this.supabase
      .from('product_complements')
      .select(
        `
        *,
        complement_product:products!complement_product_id (
          id,
          name,
          price,
          image_url,
          short_description,
          is_available
        )
      `
      )
      .eq('product_id', productId)
      .order('display_order');

    if (error) throw error;
    return data;
  }

  async getProductWithComplements(productId: number) {
    const { data, error } = await this.supabase
      .from('products')
      .select(
        `
        *,
        categories (
          id,
          name,
          icon
        ),
        product_options (
          id,
          name,
          price_adjustment,
          is_available
        ),
        product_complements (
          *,
          complement_product:products!complement_product_id (
            id,
            name,
            price,
            image_url,
            short_description,
            is_available
          )
        )
      `
      )
      .eq('id', productId)
      .eq('is_available', true)
      .or('no_catalogable.is.false,no_catalogable.is.null')
      .single();

    if (error) throw error;
    return data;
  }

  // Complement writes are admin operations; they live on SupabaseAuthService
  // (authenticated client) so RLS can scope them to the vendor's own admins.

  async getAccessories(vendorId: string, orderType?: string) {
    let query = this.supabase
      .from('products')
      .select('*')
      .eq('is_accessory', true)
      .eq('is_available', true)
      .eq('vendor_id', vendorId);

    if (orderType) {
      query = query.contains('applicable_order_types', [orderType]);
    }

    const { data, error } = await query.order('display_order');

    if (error) throw error;
    return data;
  }

  // Upsell pool (SPEC-UPSELL.md): available one-tap products whose category
  // carries an upsellable type. Multi-step products are excluded because the
  // suggestion surfaces add directly to the cart without a step flow.
  async getUpsellProducts(
    vendorId: string,
    categoryTypes: readonly string[],
    orderType?: string
  ) {
    // orderType is optional like getAccessories': the dining preference is
    // only collected at checkout, so browsing-time pools are unfiltered.
    let query = this.supabase
      .from('products')
      .select('*, category:categories!inner(category_type)')
      .eq('vendor_id', vendorId)
      .eq('is_available', true)
      .eq('is_multi_step', false)
      .in('category.category_type', [...categoryTypes]);

    if (orderType) {
      query = query.contains('applicable_order_types', [orderType]);
    }

    const { data, error } = await query.order('display_order');

    if (error) throw error;
    return data;
  }

  // Menus (multi-step products) whose step options reference the given
  // product, cheapest first (SPEC-UPSELL.md convert-to-menu). step_ids is an
  // int[] with no FK, so the walk is three queries: options -> steps -> menus.
  async getMenusContainingProduct(productId: number, vendorId: string) {
    const { data: options, error: optionsError } = await this.supabase
      .from('product_step_options')
      .select('step_ids')
      .eq('product_id', productId)
      .eq('vendor_id', vendorId);
    if (optionsError) throw optionsError;

    const stepIds = [
      ...new Set((options ?? []).flatMap((o) => o.step_ids ?? [])),
    ];
    if (stepIds.length === 0) return [];

    const { data: steps, error: stepsError } = await this.supabase
      .from('product_steps')
      .select('product_id')
      .in('id', stepIds);
    if (stepsError) throw stepsError;

    const menuIds = [
      ...new Set(
        (steps ?? [])
          .map((s) => s.product_id)
          .filter((id): id is number => id !== null)
      ),
    ];
    if (menuIds.length === 0) return [];

    const { data: menus, error: menusError } = await this.supabase
      .from('products')
      .select('*')
      .in('id', menuIds)
      .eq('is_available', true)
      .eq('is_multi_step', true)
      .order('price');
    if (menusError) throw menusError;
    return menus;
  }

  // Banners
  async getBanners(vendorId?: string) {
    let query = this.supabase.from('banners').select('*').eq('is_active', true);

    if (vendorId) {
      // Get vendor-specific banners OR global banners (vendor_id is null)
      query = query.eq('vendor_id', vendorId);
    }

    const { data, error } = await query.order('display_order');

    if (error) throw error;
    return data;
  }

  // Order/payment/delivery writes and customer order reads moved to the
  // create_full_order / save_order_delivery RPCs and the confirm-payment
  // edge function; the order tables have no anon RLS policies.
  async getVendors() {
    const { data, error } = await this.supabase
      .from('vendors')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;
    return data;
  }

  async getAllVendors() {
    try {
      console.log(' DEBUG: Getting all vendors...');
      const { data, error } = await this.supabase.from('vendors').select('*');
      // Removed .eq('is_active', true) to allow loading inactive vendors

      console.log('🔍 DEBUG: Supabase response:', { data, error });

      if (error) {
        console.error('❌ DEBUG: Supabase error:', error);
        throw error;
      }

      console.log('✅ DEBUG: Vendors retrieved:', data?.length || 0);
      return data;
    } catch (error) {
      console.error('❌ DEBUG: Error getting all vendors:', error);
      throw error;
    }
  }

  async getVendorByCustomDomain(customDomain: string) {
    try {
      const normalized = (customDomain || '').trim().toLowerCase();
      if (!normalized) return null;

      // Column name requested is "customDomain" (case-sensitive in Postgres when quoted).
      // We use ilike for case-insensitive match.
      const { data, error } = await this.supabase
        .from('vendors')
        .select('*')
        .ilike('customDomain', normalized)
        .maybeSingle();

      if (error) {
        console.error('❌ Error getting vendor by custom domain:', error);
        throw error;
      }

      return data ?? null;
    } catch (error) {
      console.error('❌ Exception getting vendor by custom domain:', error);
      throw error;
    }
  }

  // Note: Vendor management methods have been moved to SupabaseAuthService
  // This service is for anonymous/public operations only

  // Storage methods
  // Image upload/delete moved to SupabaseAuthService: storage writes are
  // admin operations and storage RLS requires an authenticated session.

  // Note: Auth methods have been moved to SupabaseAuthService
  // This service is for anonymous/public operations only

  // Product Steps
  async getProductSteps(productId: number) {
    // First get the product to know its vendor
    const { data: product } = await this.supabase
      .from('products')
      .select('vendor_id')
      .eq('id', productId)
      .single();

    if (!product || !product.vendor_id)
      throw new Error('Product not found or missing vendor');

    // Get product steps for this product
    const { data: steps, error: stepsError } = await this.supabase
      .from('product_steps')
      .select('*')
      .eq('product_id', productId)
      .order('display_order');

    if (stepsError) throw stepsError;

    // Get all options for this vendor that apply to any of these steps
    const stepIds = steps?.map((step) => step.id) || [];

    const { data: options, error: optionsError } = await this.supabase
      .from('product_step_options')
      .select(
        `
        id,
        name,
        price_adjustment,
        display_order,
        product_id,
        image_url,
        option_type,
        description,
        step_ids,
        vendor_id,
        option_product:products!product_step_options_product_id_fkey (
          id,
          name,
          image_url,
          price,
          no_catalogable,
          is_available,
          stock_quantity
        )
      `
      )
      .eq('vendor_id', product.vendor_id)
      .overlaps('step_ids', stepIds); // PostgreSQL array overlap operator

    if (optionsError) throw optionsError;

    // Filter out options where the linked product has no_catalogable = true
    const visibleOptions = options?.filter((option: any) => {
      // Keep component-type options (no linked product)
      if (option.option_type !== 'product' || !option.product_id) return true;
      // For product-type options, exclude if no_catalogable
      return !option.option_product?.no_catalogable;
    }) || [];

    // Group options by step and attach to steps
    const stepsWithOptions = steps?.map((step) => ({
      ...step,
      product_step_options:
        visibleOptions.filter((option) => option.step_ids.includes(step.id)),
    }));

    return stepsWithOptions;
  }

  // Note: Business hours and vendor metadata methods have been moved to SupabaseAuthService
  // This service is for anonymous/public operations only
}
