import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Database } from '../types/supabase.types';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient<Database>;

  constructor() {
    this.supabase = createClient<Database>(
      environment.supabase.url,
      environment.supabase.anonKey
    );
  }

  // Get the Supabase client instance
  getClient(): SupabaseClient<Database> {
    return this.supabase;
  }

  // Categories
  async getCategories() {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) throw error;
    return data;
  }

  // Products
  async getProducts(categoryId?: number) {
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
        )
      `
      )
      .eq('is_available', true);

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;
    return data;
  }

  async getAllProducts() {
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
      .order('name');

    if (error) throw error;
    return data;
  }

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
      .single();

    if (error) throw error;
    return data;
  }

  // Banners
  async getBanners() {
    const { data, error } = await this.supabase
      .from('banners')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

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

  async getOrders(status?: Database['public']['Enums']['order_status']) {
    let query = this.supabase.from('orders').select(`
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
    const { data: existingOrder, error: checkError } = await this.supabase
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
    const { data, error } = await this.supabase
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
    const { data, error } = await this.supabase.from('vendors').select('*');

    if (error) throw error;
    return data;
  }

  async updateVendorStatus(vendorId: string, isActive: boolean) {
    const { data, error } = await this.supabase
      .from('vendors')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendorId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Auth helpers (for future implementation)
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
      await this.supabase.auth.signUp({
        email,
        password,
      });

    if (authError) throw authError;

    if (authData.user) {
      const { error: profileError } = await this.supabase.from('users').insert({
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
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  async getCurrentUser() {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    return user;
  }
}
