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
      .select('*, products!inner(id, vendor_id)')
      .eq('is_active', true)
      .eq('products.vendor_id', vendorId)
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

  async createProductComplement(
    complementData: Database['public']['Tables']['product_complements']['Insert']
  ) {
    const { data, error } = await this.supabase
      .from('product_complements')
      .insert(complementData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateProductComplement(
    complementId: string,
    complementData: Database['public']['Tables']['product_complements']['Update']
  ) {
    const { data, error } = await this.supabase
      .from('product_complements')
      .update(complementData)
      .eq('id', complementId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteProductComplement(complementId: string) {
    const { error } = await this.supabase
      .from('product_complements')
      .delete()
      .eq('id', complementId);

    if (error) throw error;
  }

  async createOrderItemComplements(
    complements: Database['public']['Tables']['order_item_complements']['Insert'][]
  ) {
    const { data, error } = await this.supabase
      .from('order_item_complements')
      .insert(complements)
      .select();

    if (error) throw error;
    return data;
  }

  async getOrderItemComplements(orderItemId: number) {
    const { data, error } = await this.supabase
      .from('order_item_complements')
      .select('*')
      .eq('order_item_id', orderItemId);

    if (error) throw error;
    return data;
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

  // Orders
  async createOrder(
    orderData: Database['public']['Tables']['orders']['Insert']
  ) {
    const { data, error } = await this.supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async checkConfirmationEmailSent(orderId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('confirmation_email_sent')
      .eq('id', orderId)
      .single();

    if (error) {
      console.error('Error checking email status:', error);
      return false; // Default to false if we can't check
    }

    return data?.confirmation_email_sent || false;
  }

  async markConfirmationEmailSent(orderId: string): Promise<void> {
    const { error } = await this.supabase
      .from('orders')
      .update({
        confirmation_email_sent: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) {
      console.error('Error marking email as sent:', error);
      throw error;
    }
  }

  async checkReadyEmailSent(orderId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('ready_email_sent')
      .eq('id', orderId)
      .single();

    if (error) {
      console.error('Error checking ready email status:', error);
      return false; // Default to false if we can't check
    }

    return data?.ready_email_sent || false;
  }

  async markReadyEmailSent(orderId: string): Promise<void> {
    const { error } = await this.supabase
      .from('orders')
      .update({
        ready_email_sent: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) {
      console.error('Error marking ready email as sent:', error);
      throw error;
    }
  }

  async createOrderItems(
    items: Database['public']['Tables']['order_items']['Insert'][]
  ) {
    const { data, error } = await this.supabase
      .from('order_items')
      .insert(items)
      .select();

    if (error) throw error;
    return data;
  }

  // Note: Order management methods have been moved to SupabaseAuthService
  // This service is for anonymous/public operations only

  // Payments
  async createPayment(
    paymentData: Database['public']['Tables']['payments']['Insert']
  ) {
    const { data, error } = await this.supabase
      .from('payments')
      .insert(paymentData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Order Deliveries (prototype typing without regenerated types)
  async upsertOrderDelivery(payload: {
    order_id: string;
    provider: string;
    quote_amount_minor: number;
    currency: string;
    eta_minutes?: number | null;
    status?: string | null;
    pickup: {
      line1: string;
      postal_code: string;
      city: string;
      country_code: string;
      lat?: number | null;
      lng?: number | null;
    };
    dropoff: {
      line1: string;
      postal_code: string;
      city: string;
      country_code: string;
      lat?: number | null;
      lng?: number | null;
    };
    raw?: any;
  }) {
    // Cast to any until types are regenerated
    const client = this.supabase as unknown as SupabaseClient<any>;
    const { data, error } = await client
      .from('order_deliveries')
      .upsert(
        {
          order_id: payload.order_id,
          provider: payload.provider,
          quote_amount_minor: payload.quote_amount_minor,
          currency: payload.currency,
          eta_minutes: payload.eta_minutes ?? null,
          status: payload.status ?? null,
          pickup_line1: payload.pickup.line1,
          pickup_postal_code: payload.pickup.postal_code,
          pickup_city: payload.pickup.city,
          pickup_country_code: payload.pickup.country_code,
          pickup_lat: payload.pickup.lat ?? null,
          pickup_lng: payload.pickup.lng ?? null,
          dropoff_line1: payload.dropoff.line1,
          dropoff_postal_code: payload.dropoff.postal_code,
          dropoff_city: payload.dropoff.city,
          dropoff_country_code: payload.dropoff.country_code,
          dropoff_lat: payload.dropoff.lat ?? null,
          dropoff_lng: payload.dropoff.lng ?? null,
          raw: payload.raw ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'order_id' }
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getOrderDeliveryByOrderId(orderId: string) {
    const client = this.supabase as unknown as SupabaseClient<any>;
    const { data, error } = await client
      .from('order_deliveries')
      .select('*')
      .eq('order_id', orderId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data ?? null;
  }

  async updateOrderDeliveryAfterCreation(
    orderId: string,
    update: {
      job_id?: string | null;
      delivery_id?: string | null;
      tracking_url?: string | null;
      status?: string | null;
      raw?: any;
    }
  ) {
    const client = this.supabase as unknown as SupabaseClient<any>;
    const { data, error } = await client
      .from('order_deliveries')
      .update({
        job_id: update.job_id ?? null,
        delivery_id: update.delivery_id ?? null,
        tracking_url: update.tracking_url ?? null,
        status: update.status ?? null,
        raw: update.raw ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getPaymentByOrderId(orderId: string) {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (error) throw error;
    return data;
  }

  async updatePaymentStatus(
    paymentId: string,
    status: Database['public']['Enums']['payment_status']
  ) {
    const { data, error } = await this.supabase
      .from('payments')
      .update({ status })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Vendors
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

  // Note: Vendor management methods have been moved to SupabaseAuthService
  // This service is for anonymous/public operations only

  // Storage methods
  async uploadImage(
    file: File,
    bucket: string = 'productsophotos'
  ): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${fileExt}`;
    const filePath = fileName;

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (error) {
      throw error;
    }

    // Get the public URL
    const { data: urlData } = this.supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }

  async deleteImage(
    url: string,
    bucket: string = 'productsophotos'
  ): Promise<void> {
    // Extract filename from URL
    const urlParts = url.split('/');
    const fileName = urlParts[urlParts.length - 1];

    const { error } = await this.supabase.storage
      .from(bucket)
      .remove([fileName]);

    if (error) {
      throw error;
    }
  }

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
        is_available,
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
          price
        )
      `
      )
      .eq('vendor_id', product.vendor_id)
      .overlaps('step_ids', stepIds); // PostgreSQL array overlap operator

    if (optionsError) throw optionsError;

    // Group options by step and attach to steps
    const stepsWithOptions = steps?.map((step) => ({
      ...step,
      product_step_options:
        options?.filter((option) => option.step_ids.includes(step.id)) || [],
    }));

    return stepsWithOptions;
  }

  // Note: Business hours and vendor metadata methods have been moved to SupabaseAuthService
  // This service is for anonymous/public operations only
}
