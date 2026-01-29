import { Injectable, OnDestroy } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Database } from '../types/supabase.types';

@Injectable({
  providedIn: 'root',
})
export class SupabaseAuthService implements OnDestroy {
  private static instance: SupabaseClient<Database> | null = null;
  private static serviceInstance: SupabaseAuthService | null = null;
  private supabaseAuth!: SupabaseClient<Database>;
  private currentVendorId: string = '';

  constructor() {
    // Ensure only one service instance is created (true singleton)
    if (SupabaseAuthService.serviceInstance) {
      return SupabaseAuthService.serviceInstance;
    }

    // Ensure only one Supabase auth client instance is created
    if (!SupabaseAuthService.instance) {
      SupabaseAuthService.instance = createClient<Database>(
        environment.supabase.url,
        environment.supabase.anonKey,
        {
          auth: {
            autoRefreshToken: true,
            // Persist session in localStorage
            persistSession: true,
            // Detect session in URL (for OAuth flows)
            detectSessionInUrl: true,
            // Storage key for session persistence - AUTHENTICATED USERS
            storageKey: 'supabase.admin.token',
            // Storage implementation (uses localStorage by default)
            storage:
              typeof window !== 'undefined' ? window.sessionStorage : undefined,
            // Add flow type to prevent lock conflicts
            flowType: 'pkce',
          },
        }
      );
    }

    this.supabaseAuth = SupabaseAuthService.instance;
    SupabaseAuthService.serviceInstance = this;
  }
  getCurrentVendorId(): string {
    return this.currentVendorId;
  }
  setCurrentVendorId(vendorId: string): void {
    this.currentVendorId = vendorId;
  }
  // Get the Supabase auth client instance
  getClient(): SupabaseClient<Database> {
    return this.supabaseAuth;
  }

  /**
   * Cleanup method when service is destroyed
   * This will be called when the application is destroyed
   */
  ngOnDestroy(): void {
    // Reset static instances for potential re-initialization
    SupabaseAuthService.serviceInstance = null;
    SupabaseAuthService.instance = null;
  }

  // Auth-specific methods
  async signUp(
    email: string,
    password: string,
    userData: {
      firstName: string;
      lastName: string;
      phone?: string;
    }
  ) {
    const { data: authData, error: authError } =
      await this.supabaseAuth.auth.signUp({
        email,
        password,
      });

    if (authError) throw authError;

    if (authData.user) {
      const { error: profileError } = await this.supabaseAuth
        .from('users')
        .insert({
          id: authData.user.id,
          email,
          first_name: userData.firstName,
          last_name: userData.lastName,
          phone: userData.phone,
        });

      if (profileError) throw profileError;
    }

    return authData;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await this.supabaseAuth.auth.signOut();
    if (error) throw error;
  }

  async getCurrentUser() {
    const {
      data: { user },
    } = await this.supabaseAuth.auth.getUser();
    return user;
  }

  async getSession() {
    const { data, error } = await this.supabaseAuth.auth.getSession();
    if (error) throw error;
    return data;
  }

  // Auth state change listener
  onAuthStateChange(callback: (event: string, session: any) => void) {
    console.log('onAuthStateChange called');
    //add timeout
    return this.supabaseAuth.auth.onAuthStateChange(callback);
  }

  // Admin user operations (require authentication)
  async getAdminUserData(userId: string): Promise<any> {
    const { data, error } = await this.supabaseAuth
      .from('vendor_admin_users')
      .select(
        `
        *,
        vendors (
          id,
          business_name,
          logo_url,
          is_active,
          enabled_order_types,
          online_payments_enabled,
          delivery_system,
          own_delivery_price
        )
      `
      )
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  async getVendorByAdminEmail(email: string): Promise<{
    vendor: any;
    adminUser: any;
  } | null> {
    const { data, error } = await this.supabaseAuth
      .from('vendor_admin_users')
      .select(
        `
        *,
        vendors (
          id,
          business_name,
          logo_url,
          is_active,
          enabled_order_types,
          online_payments_enabled,
          delivery_system,
          own_delivery_price
        )
      `
      )
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No admin user found for this email
      }
      throw error;
    }

    if (!data) return null;

    return {
      vendor: data.vendors,
      adminUser: data,
    };
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.supabaseAuth
      .from('vendor_admin_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('user_id', userId);
  }

  async createAdminUser(userData: any) {
    const { data, error } = await this.supabaseAuth
      .from('vendor_admin_users')
      .insert(userData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Orders management (admin operations)
  async getOrders(
    status?: Database['public']['Enums']['order_status'],
    vendorId?: string
  ) {
    let query = this.supabaseAuth.from('orders').select(`
        *,
        order_items (
          *,
          products (
            id,
            name,
            image_url
          )
        )
      `);

    if (status) {
      query = query.eq('status', status);
    }

    // Filter orders by vendor_id directly on the orders table
    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

    const { data, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) throw error;

    return data;
  }

  async updateOrderStatus(
    orderId: string,
    status: Database['public']['Enums']['order_status']
  ) {
    // First check if the order exists
    const { data: existingOrder, error: checkError } = await this.supabaseAuth
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        throw new Error(`Order with ID ${orderId} not found`);
      }
      throw checkError;
    }

    // Update the order status and updated_at timestamp
    const { data, error } = await this.supabaseAuth
      .from('orders')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error(
          `Failed to update order ${orderId}. Order may have been deleted.`
        );
      }
      throw error;
    }

    return data;
  }

  async updateOrderWithRefuseReason(
    orderId: string,
    status: Database['public']['Enums']['order_status'],
    refuseReason: string
  ) {
    // First check if the order exists
    const { data: existingOrder, error: checkError } = await this.supabaseAuth
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        throw new Error(`Order with ID ${orderId} not found`);
      }
      throw checkError;
    }

    // Update the order status, refuse_reason, and updated_at timestamp
    const { data, error } = await this.supabaseAuth
      .from('orders')
      .update({
        status,
        refuse_reason: refuseReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error(
          `Failed to update order ${orderId}. Order may have been deleted.`
        );
      }
      throw error;
    }

    return data;
  }

  // Vendor management (admin operations)
  async updateVendorStatus(vendorId: string, isActive: boolean) {
    const { data, error } = await this.supabaseAuth
      .from('vendors')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendorId)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      throw new Error(`Vendor with ID ${vendorId} not found`);
    }

    return data;
  }

  async updateVendorLogo(vendorId: string, logoUrl: string) {
    const { data, error } = await this.supabaseAuth
      .from('vendors')
      .update({
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendorId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateVendorEnabledOrderTypes(
    vendorId: string,
    enabledOrderTypes: Database['public']['Enums']['order_type'][]
  ) {
    const { data, error } = await this.supabaseAuth
      .from('vendors')
      .update({
        enabled_order_types: enabledOrderTypes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendorId)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      throw new Error(`Vendor with ID ${vendorId} not found`);
    }

    return data;
  }

  async updateVendorOnlinePaymentsEnabled(vendorId: string, enabled: boolean) {
    const { data, error } = await this.supabaseAuth
      .from('vendors')
      .update({
        online_payments_enabled: enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendorId)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      throw new Error(`Vendor with ID ${vendorId} not found`);
    }

    return data;
  }

  async updateVendorDeliverySettings(
    vendorId: string,
    settings: {
      deliverySystem: 'picki' | 'own';
      ownDeliveryPrice: number;
    }
  ) {
    const { deliverySystem, ownDeliveryPrice } = settings;

    const { data, error } = await this.supabaseAuth
      .from('vendors')
      .update({
        delivery_system: deliverySystem,
        own_delivery_price: ownDeliveryPrice,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendorId)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      throw new Error(`Vendor with ID ${vendorId} not found`);
    }

    return data;
  }

  async updateVendorDailyStockReset(vendorId: string, enabled: boolean) {
    const { data, error } = await this.supabaseAuth
      .from('vendors')
      .update({
        daily_stock_reset_enabled: enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendorId)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      throw new Error(`Vendor with ID ${vendorId} not found`);
    }

    return data;
  }

  // Business Hours (admin operations)
  async getBusinessHours(vendorId: string) {
    console.log(
      '🕐 SupabaseAuthService.getBusinessHours called for vendorId:',
      vendorId
    );

    try {
      console.log('🔄 Executing Supabase query: business_hours table');
      const { data, error } = await this.supabaseAuth
        .from('business_hours')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('day_of_week');

      if (error) {
        console.error('❌ Supabase error in getBusinessHours:', {
          error: error,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        throw error;
      }

      console.log('✅ Supabase getBusinessHours successful:', {
        dataLength: data?.length || 0,
        data: data,
      });

      return data;
    } catch (error) {
      console.error('❌ Exception in SupabaseAuthService.getBusinessHours:', {
        error: error,
        message: (error as any)?.message,
        stack: (error as any)?.stack,
        vendorId: vendorId,
      });
      throw error;
    }
  }

  async updateBusinessHours(
    vendorId: string,
    dayOfWeek: number,
    businessHours: {
      open_time?: string | null;
      close_time?: string | null;
      is_closed?: boolean;
    }
  ) {
    const { data, error } = await this.supabaseAuth
      .from('business_hours')
      .upsert(
        {
          vendor_id: vendorId,
          day_of_week: dayOfWeek,
          ...businessHours,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'vendor_id,day_of_week',
        }
      )
      .select();

    if (error) throw error;
    return data;
  }

  async createBusinessHours(businessHours: {
    vendor_id: string;
    day_of_week: number;
    open_time?: string | null;
    close_time?: string | null;
    is_closed?: boolean;
  }) {
    const { data, error } = await this.supabaseAuth
      .from('business_hours')
      .insert(businessHours)
      .select();

    if (error) throw error;
    return data;
  }

  // Initialize default business hours for a vendor (all days closed)
  async initializeDefaultBusinessHours(vendorId: string): Promise<void> {
    const defaultHours = [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      defaultHours.push({
        vendor_id: vendorId,
        day_of_week: dayOfWeek,
        is_closed: true,
        open_time: null,
        close_time: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const { error } = await this.supabaseAuth
      .from('business_hours')
      .upsert(defaultHours, {
        onConflict: 'vendor_id,day_of_week',
      });

    if (error) throw error;
  }

  // Vendor Metadata (admin operations)
  async getVendorMetadata(vendorId: string) {
    console.log(
      '📋 SupabaseAuthService.getVendorMetadata called for vendorId:',
      vendorId
    );

    try {
      console.log('🔄 Executing Supabase query: vendor_metadata table');
      const { data, error } = await this.supabaseAuth
        .from('vendor_metadata')
        .select('*')
        .eq('vendor_id', vendorId);

      if (error) {
        console.error('❌ Supabase error in getVendorMetadata:', {
          error: error,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        throw error;
      }

      console.log('✅ Supabase getVendorMetadata successful:', {
        dataLength: data?.length || 0,
        data: data,
      });

      // Return the first row if it exists, otherwise return null
      const result = data && data.length > 0 ? data[0] : null;

      console.log('📊 getVendorMetadata result:', {
        hasResult: !!result,
        resultKeys: result ? Object.keys(result) : [],
      });

      return result;
    } catch (error) {
      console.error('❌ Exception in SupabaseAuthService.getVendorMetadata:', {
        error: error,
        message: (error as any)?.message,
        stack: (error as any)?.stack,
        vendorId: vendorId,
      });
      throw error;
    }
  }

  async upsertVendorMetadata(metadata: {
    vendor_id: string;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    street?: string | null;
    city?: string | null;
    postal_code?: string | null;
    country?: string | null;
  }) {
    const { data, error } = await this.supabaseAuth
      .from('vendor_metadata')
      .upsert(metadata, {
        onConflict: 'vendor_id',
      })
      .select();

    if (error) throw error;
    return data;
  }

  // Initialize default vendor metadata for a vendor
  async initializeDefaultVendorMetadata(vendorId: string): Promise<void> {
    const defaultMetadata = {
      vendor_id: vendorId,
      phone: null,
      email: null,
      website: null,
      street: null,
      city: null,
      postal_code: null,
      country: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await this.supabaseAuth
      .from('vendor_metadata')
      .upsert(defaultMetadata, {
        onConflict: 'vendor_id',
      });

    if (error) throw error;
  }

  async updateVendorMetadata(
    vendorId: string,
    metadata: {
      phone?: string | null;
      email?: string | null;
      website?: string | null;
      street?: string | null;
      city?: string | null;
      postal_code?: string | null;
      country?: string | null;
    }
  ) {
    const { data, error } = await this.supabaseAuth
      .from('vendor_metadata')
      .update(metadata)
      .eq('vendor_id', vendorId)
      .select();

    if (error) throw error;
    return data;
  }

  // Product management (admin operations)
  async updateProductAvailability(productId: number, isAvailable: boolean) {
    const { data, error } = await this.supabaseAuth
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

  // Banner management (admin operations)
  async getBanners(vendorId?: string) {
    let query = this.supabaseAuth
      .from('banners')
      .select('*')
      .eq('is_active', true);

    if (vendorId) {
      // Get vendor-specific banners OR global banners (vendor_id is null)
      query = query.eq('vendor_id', vendorId);
    }

    const { data, error } = await query.order('display_order');

    if (error) throw error;
    return data;
  }

  // Order delivery management (admin operations)
  async getOrderDeliveryByOrderId(orderId: string) {
    const client = this.supabaseAuth as unknown as SupabaseClient<any>;
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
    const client = this.supabaseAuth as unknown as SupabaseClient<any>;
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

  // Email management (admin operations)
  async checkReadyEmailSent(orderId: string): Promise<boolean> {
    const { data, error } = await this.supabaseAuth
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
    const { error } = await this.supabaseAuth
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

  // Payment management (admin operations)
  async getPaymentByOrderId(orderId: string) {
    const { data, error } = await this.supabaseAuth
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
    const { data, error } = await this.supabaseAuth
      .from('payments')
      .update({ status })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Category management (admin operations)
  async createCategory(categoryData: any) {
    const vendorId = this.getCurrentVendorId();
    
    const { data, error } = await this.supabaseAuth
      .from('categories')
      .insert({
        name: categoryData.name,
        description: categoryData.description,
        image_url: categoryData.image_url || null,
        is_active: categoryData.is_active ?? true,
        display_order: categoryData.display_order ?? 0,
        vendorId: vendorId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateCategory(categoryId: number, categoryData: any) {
    const { data, error } = await this.supabaseAuth
      .from('categories')
      .update({
        name: categoryData.name,
        description: categoryData.description,
        image_url: categoryData.image_url || null,
        is_active: categoryData.is_active,
        display_order: categoryData.display_order,
      })
      .eq('id', categoryId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteCategory(categoryId: number) {
    // First check if category has products
    const { data: products, error: checkError } = await this.supabaseAuth
      .from('products')
      .select('id')
      .eq('category_id', categoryId)
      .limit(1);

    if (checkError) {
      console.error('Error checking category products:', checkError);
      throw checkError;
    }

    if (products && products.length > 0) {
      throw new Error('Cannot delete category with existing products');
    }

    const { error } = await this.supabaseAuth
      .from('categories')
      .delete()
      .eq('id', categoryId);

    if (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  async updateProductCategory(productId: number, categoryId: number | null) {
    const { data, error } = await this.supabaseAuth
      .from('products')
      .update({ category_id: categoryId })
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      console.error('Error updating product category:', error);
      throw error;
    }

    return data;
  }

  async reorderCategories(categoryIds: number[]) {
    // Update display_order for each category based on its position in the array
    const updates = categoryIds.map((categoryId, index) =>
      this.supabaseAuth
        .from('categories')
        .update({ display_order: index + 1 })
        .eq('id', categoryId)
    );

    // Execute all updates in parallel
    const results = await Promise.all(updates);

    // Check for any errors
    const errors = results.filter((result: any) => result.error);
    if (errors.length > 0) {
      console.error('Error reordering categories:', errors);
      throw new Error('Failed to reorder categories');
    }
  }

  // Product step management (admin operations)
  async deleteMenuSteps(menuId: number) {
    // First, get all step IDs for this menu
    const { data: steps } = await this.supabaseAuth
      .from('product_steps')
      .select('id')
      .eq('product_id', menuId);

    if (steps && steps.length > 0) {
      const stepIds = steps.map((step: any) => step.id);

      // Delete step options first (foreign key constraint)
      await this.supabaseAuth
        .from('product_step_options')
        .delete()
        .in(
          'step_ids',
          stepIds.map((id: any) => [id])
        );

      // Then delete steps
      await this.supabaseAuth
        .from('product_steps')
        .delete()
        .eq('product_id', menuId);
    }
  }

  async createMenuStep(menuId: number, stepData: any) {
    const { data, error } = await this.supabaseAuth
      .from('product_steps')
      .insert({
        product_id: menuId,
        name: stepData.name,
        step_type: stepData.step_type,
        description: stepData.description,
        is_required: stepData.is_required,
        min_selections: stepData.min_selections,
        max_selections: stepData.max_selections,
        display_order: stepData.display_order,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating step:', error);
      throw error;
    }

    return data;
  }

  async createStepOptions(stepId: number, products: any[], vendorId: string) {
    const optionsToInsert = products.map((product, index) => ({
      product_id: product.id,
      name: product.name,
      price_adjustment: product.price_adjustment || 0,
      display_order: index + 1,
      option_type: 'product' as const,
      description: product.description || null,
      image_url: product.image_url || null,
      step_ids: [stepId],
      vendor_id: vendorId,
    }));

    const { error } = await this.supabaseAuth
      .from('product_step_options')
      .insert(optionsToInsert);

    if (error) {
      console.error('Error creating step options:', error);
      throw error;
    }
  }
}
