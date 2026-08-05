import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, from, Observable, of, throwError } from 'rxjs';
import { map, catchError, timeout, retry, shareReplay } from 'rxjs/operators';
import { Order, OrderStatus } from '../models/order.model';
import { Address, DeliveryQuote } from './delivery/delivery.types';
import { SupabaseService } from './supabase.service';
import { SupabaseAuthService } from './supabase-auth.service';
import { Database } from '../types/supabase.types';
import { VendorService } from './vendor.service';
import { getDefaultVatRate } from '../shared/utils/vat-rates.util';

@Injectable({
  providedIn: 'root',
})
export class OrdersService {
  private supabaseService = inject(SupabaseService);
  private supabaseAuthService = inject(SupabaseAuthService);
  private vendorService = inject(VendorService);
  private ordersSubject = new BehaviorSubject<Order[]>([]);
  public orders$ = this.ordersSubject.asObservable();

  constructor() {
    this.loadOrders();

    // Reload orders when vendor changes
    this.vendorService.currentVendor$.subscribe((vendor) => {
      if (vendor) {
        this.loadOrders();
      }
    });
  }

  async loadOrders() {
    try {
      // Get current vendor
      const currentVendor = this.vendorService.getCurrentVendor();
      const vendorId = currentVendor?.id;
      console.log('[OrdersService] loadOrders vendor', {
        vendorId,
        businessName: currentVendor?.business_name,
      });

      const orders = await this.supabaseAuthService.getOrders(
        undefined,
        vendorId
      );
      const mappedOrders = orders?.map((o) => this.mapDbOrderToOrder(o)) || [];

      console.log(
        `Loaded ${mappedOrders.length} orders from database${
          vendorId ? ` for vendor ${currentVendor?.business_name}` : ''
        }:`,
        mappedOrders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
        }))
      );

      this.ordersSubject.next(mappedOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  }

  // Get current orders value
  getCurrentOrders(): Order[] {
    return this.ordersSubject.value;
  }

  // Update orders optimistically (for UI feedback)
  updateOrdersOptimistically(orders: Order[]): void {
    this.ordersSubject.next(orders);
  }

  // Debug method to check order existence (admin context: orders are only
  // readable by the vendor's authenticated session under RLS)
  async debugOrderExists(orderId: string): Promise<boolean> {
    try {
      console.log(`Checking if order ${orderId} exists...`);
      const { data, error } = await this.supabaseAuthService
        .getClient()
        .from('orders')
        .select('id, order_number, status, created_at')
        .eq('id', orderId)
        .single();

      if (error) {
        console.error(`Order ${orderId} not found:`, error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        return false;
      }

      console.log(`Order ${orderId} exists:`, data);
      return true;
    } catch (error) {
      console.error(`Error checking order ${orderId}:`, error);
      return false;
    }
  }

  // Debug method to list all order IDs (admin context, see debugOrderExists)
  async debugListAllOrderIds(): Promise<void> {
    try {
      console.log('Fetching all order IDs...');
      const { data, error } = await this.supabaseAuthService
        .getClient()
        .from('orders')
        .select('id, order_number, status, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching order IDs:', error);
        return;
      }

      console.log(`Found ${data?.length || 0} orders in database:`, data);

      // Check if the specific order exists
      const targetOrder = data?.find(
        (order) => order.id === '17258ad0-3979-46ee-b30b-edc3620339da'
      );
      if (targetOrder) {
        console.log('Target order found:', targetOrder);
      } else {
        console.log(
          'Target order 17258ad0-3979-46ee-b30b-edc3620339da NOT found in recent orders'
        );
      }
    } catch (error) {
      console.error('Error listing orders:', error);
    }
  }

  // Customer-facing order read (success page, tracking links). Orders carry
  // no anon RLS policies, so anonymous reads go through the confirm-payment
  // edge function, addressed by the order UUID only the customer holds.
  async getOrderStatusPublic(
    orderId: string
  ): Promise<{ order: Order | null; delivery: any }> {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .functions.invoke('confirm-payment', {
          body: { action: 'status', orderId },
        });

      if (error || !data?.order) {
        console.error(`Error fetching order ${orderId}:`, error ?? data);
        return { order: null, delivery: null };
      }

      return {
        order: this.mapDbOrderToOrder(data.order),
        delivery: data.delivery ?? null,
      };
    } catch (error) {
      console.error(`Error getting order ${orderId}:`, error);
      return { order: null, delivery: null };
    }
  }

  // Legacy signature used by the success page: order only.
  async getOrderById(orderId: string): Promise<Order | null> {
    const { order } = await this.getOrderStatusPublic(orderId);
    return order;
  }

  /**
   * Server-side payment confirmation. The edge function verifies the payment
   * with Stripe/PayGreen, flips the order to 'paid', records the payment,
   * advances the delivery status and claims the confirmation email.
   */
  async confirmPayment(params: {
    provider: 'stripe' | 'paygreen';
    sessionId?: string;
    poId?: string;
    vendorId?: string;
    apiUrl?: string;
    isSandbox?: boolean;
  }): Promise<{
    order: Order | null;
    delivery: any;
    payment: any;
    emailAlreadySent: boolean;
  } | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .functions.invoke('confirm-payment', {
        body: { action: 'confirm', ...params },
      });

    if (error || !data?.order) {
      console.error('confirm-payment failed:', error ?? data);
      return null;
    }

    return {
      order: this.mapDbOrderToOrder(data.order),
      delivery: data.delivery ?? null,
      payment: data.payment ?? null,
      emailAlreadySent: data.emailAlreadySent === true,
    };
  }

  async addOrder(order: Order): Promise<Order> {
    try {
      // Get current vendor ID
      const currentVendor = this.vendorService.getCurrentVendor();
      const vendorId = currentVendor?.id;

      const defaultVatRate = getDefaultVatRate(currentVendor?.country);

      const orderPayload = {
        order_number: order.orderNumber,
        customer_email: order.customer.email,
        customer_first_name: order.customer.firstName,
        customer_last_name: order.customer.lastName,
        customer_phone: order.customer.phone,
        total_amount: order.totalAmount,
        status: order.status,
        order_type: order.orderType,
        timing: order.timing,
        scheduled_time: order.scheduledTime?.toISOString() ?? null,
        table_number: order.tableNumber ?? null,
        notes: order.notes ?? null,
        pay_at_checkout: order.payAtCheckout ?? false,
        vendor_id: vendorId ?? null,
        coupon_id: order.couponId ?? null,
        coupon_code: order.couponCode ?? null,
        discount_amount: order.discountAmount ?? 0,
      };

      const itemsPayload = order.items.map((item) => ({
        // Some cart rows are "virtual" (e.g. delivery fee uses id -9999) and must not
        // be persisted as a FK to products. Keep them as order_items rows with NULL product_id.
        product_id: (() => {
          const parsed = Number.parseInt(item.productId, 10);
          if (Number.isFinite(parsed) && parsed > 0) return parsed;
          console.warn(
            '[OrdersService] Skipping product FK for non-product cart item',
            {
              orderNumber: order.orderNumber,
              productId: item.productId,
              productName: item.productName,
            }
          );
          return null;
        })(),
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: item.price, // This will now be the correct calculated price for multi-step products
        total_price: item.price * item.quantity,
        tva_rate: item.tvaRate ?? defaultVatRate, // Store TVA rate at time of purchase
        vendor_id: (item as any).vendorId || null,
        options: item.options || [], // Store multi-step metadata here
        comment: item.comment || null,
        complements: ((item as any).selectedComplements || []).map(
          (comp: any) => ({
            complement_product_id: comp.complement_product_id,
            complement_name:
              comp.complement_name ||
              `Complement ${comp.complement_product_id}`,
            quantity: comp.quantity,
            unit_price: comp.unit_price,
            total_price: comp.total_price,
          })
        ),
      }));

      // Atomic server-side creation: order + items + complements + stock
      // reservation happen in a single transaction (create_full_order rolls
      // everything back when stock is insufficient), replacing the old
      // insert-then-delete-on-failure sequence on the open order tables.
      const { data, error } = await (
        this.supabaseService.getClient() as any
      ).rpc('create_full_order', {
        p_order: orderPayload,
        p_items: itemsPayload,
      });

      if (error) {
        if (String(error.message || '').includes('INSUFFICIENT_STOCK')) {
          let insufficientItems: any[] = [];
          try {
            insufficientItems = JSON.parse(error.details || '[]');
          } catch {
            // keep empty list when detail parsing fails
          }
          console.warn(
            '[OrdersService] Insufficient stock for order:',
            insufficientItems
          );
          const stockError = new Error('INSUFFICIENT_STOCK') as any;
          stockError.insufficientItems = insufficientItems;
          throw stockError;
        }
        console.error('[OrdersService] create_full_order RPC error:', error);
        throw new Error('Order creation failed. Please try again.');
      }

      if (!data?.success || !data?.order_id) {
        throw new Error('Failed to create order');
      }

      console.log(
        '[OrdersService] Order created with stock reserved:',
        data.order_id,
        data.stock?.reservedProducts
      );

      // Reload orders
      await this.loadOrders();

      // Return the created order with the database ID
      return {
        ...order,
        id: data.order_id,
      };
    } catch (error) {
      console.error('Error adding order:', error);
      throw error;
    }
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    try {
      await this.supabaseAuthService.updateOrderStatus(
        orderId,
        status as Database['public']['Enums']['order_status']
      );

      // Restore stock when order is cancelled or refused
      if (status === 'cancelled' || status === 'refused') {
        try {
          const { error: stockError } = await (this.supabaseAuthService
            .getClient() as any)
            .rpc('restore_stock_for_order', { p_order_id: orderId });

          if (stockError) {
            console.warn(
              '[OrdersService] Stock restore warning (non-blocking):',
              stockError
            );
          } else {
            console.log('[OrdersService] Stock restored for order:', orderId);
          }
        } catch (stockError) {
          console.warn(
            '[OrdersService] Stock restore failed (non-blocking):',
            stockError
          );
        }
      }

      await this.loadOrders();
    } catch (error: any) {
      console.error('Error updating order status:', error);

      // Provide more specific error messages
      if (error.message?.includes('not found')) {
        throw new Error(
          `Commande introuvable. Elle a peut-être été supprimée.`
        );
      } else if (error.message?.includes('Failed to update')) {
        throw new Error(
          `Impossible de mettre à jour la commande. Veuillez réessayer.`
        );
      } else if (error.code === 'PGRST116') {
        throw new Error(`Commande introuvable dans la base de données.`);
      } else if (error.message?.includes('network')) {
        throw new Error(
          `Erreur de connexion. Vérifiez votre connexion internet.`
        );
      } else {
        throw error;
      }
    }
  }

  async updateOrderWithRefuseReason(orderId: string, status: OrderStatus, refuseReason: string): Promise<void> {
    try {
      await this.supabaseAuthService.updateOrderWithRefuseReason(
        orderId,
        status as Database['public']['Enums']['order_status'],
        refuseReason
      );

      // Restore stock when order is refused (this method is typically used for refused orders)
      if (status === 'cancelled' || status === 'refused') {
        try {
          const { error: stockError } = await (this.supabaseAuthService
            .getClient() as any)
            .rpc('restore_stock_for_order', { p_order_id: orderId });

          if (stockError) {
            console.warn(
              '[OrdersService] Stock restore warning (non-blocking):',
              stockError
            );
          } else {
            console.log('[OrdersService] Stock restored for refused order:', orderId);
          }
        } catch (stockError) {
          console.warn(
            '[OrdersService] Stock restore failed (non-blocking):',
            stockError
          );
        }
      }

      await this.loadOrders();
    } catch (error: any) {
      console.error('Error updating order with refuse reason:', error);

      // Provide more specific error messages
      if (error.message?.includes('not found')) {
        throw new Error(
          `Commande introuvable. Elle a peut-être été supprimée.`
        );
      } else if (error.message?.includes('Failed to update')) {
        throw new Error(
          `Impossible de mettre à jour la commande. Veuillez réessayer.`
        );
      } else if (error.code === 'PGRST116') {
        throw new Error(`Commande introuvable dans la base de données.`);
      } else if (error.message?.includes('network')) {
        throw new Error(
          `Erreur de connexion. Vérifiez votre connexion internet.`
        );
      } else {
        throw error;
      }
    }
  }

  async saveOrderDeliverySelection(params: {
    orderId: string;
    best: DeliveryQuote;
    pickup: {
      line1: string;
      postal_code: string;
      city: string;
      country_code: string;
      lat?: number | null;
      lng?: number | null;
    };
    dropoff: Address;
  }): Promise<void> {
    // Delivery quotes are written through a SECURITY DEFINER RPC: it only
    // accepts orders still awaiting payment and refuses once a courier is
    // assigned, so order_deliveries needs no anon RLS policies.
    const { error } = await (this.supabaseService.getClient() as any).rpc(
      'save_order_delivery',
      {
        p: {
          order_id: params.orderId,
          provider: params.best.providerId,
          quote_amount_minor: params.best.totalAmount,
          currency: params.best.currency,
          eta_minutes: params.best.etaMinutes ?? null,
          pickup: {
            line1: params.pickup.line1,
            postal_code: params.pickup.postal_code,
            city: params.pickup.city,
            country_code: params.pickup.country_code,
            lat: params.pickup.lat ?? null,
            lng: params.pickup.lng ?? null,
          },
          dropoff: {
            line1: params.dropoff.line1,
            postal_code: params.dropoff.postalCode,
            city: params.dropoff.city,
            country_code: params.dropoff.countryCode,
            lat: params.dropoff.coordinates?.lat ?? null,
            lng: params.dropoff.coordinates?.lng ?? null,
          },
          raw: params.best.raw ?? null,
        },
      }
    );
    if (error) throw error;
  }

  getOrdersByStatus(status: OrderStatus): Observable<Order[]> {
    return this.orders$.pipe(
      map((orders) => orders.filter((order) => order.status === status))
    );
  }

  private mapDbOrderToOrder(dbOrder: any): Order {
    const defaultVatRate = getDefaultVatRate(
      this.vendorService.getCurrentVendor()?.country
    );

    return {
      id: dbOrder.id,
      orderNumber: dbOrder.order_number,
      customer: {
        firstName: dbOrder.customer_first_name,
        lastName: dbOrder.customer_last_name,
        email: dbOrder.customer_email,
        phone: dbOrder.customer_phone || '',
      },
      items:
        dbOrder.order_items?.map((item: any) => ({
          productId: item.product_id?.toString() || '',
          productName: item.product_name,
          quantity: item.quantity,
          price: Number(item.unit_price),
          tvaRate: Number(item.tva_rate) || defaultVatRate,
          options: item.options || [],
          comment: item.comment || undefined,
          vendorId: item.vendor_id || undefined,
          metadata: item.options?.[0] || undefined, // Extract multi-step metadata from options
        })) || [],
      totalAmount: Number(dbOrder.total_amount),
      status: dbOrder.status as OrderStatus,
      orderType: dbOrder.order_type,
      timing: dbOrder.timing,
      payAtCheckout: !!dbOrder.pay_at_checkout,
      scheduledTime: dbOrder.scheduled_time
        ? new Date(dbOrder.scheduled_time)
        : undefined,
      tableNumber: dbOrder.table_number || undefined,
      createdAt: new Date(dbOrder.created_at),
      updatedAt: new Date(dbOrder.updated_at),
      notes: dbOrder.notes || undefined,
      vendorId: dbOrder.vendor_id || undefined, // Include vendor ID from database
      refuse_reason: dbOrder.refuse_reason || undefined,
      couponId: dbOrder.coupon_id || undefined,
      couponCode: dbOrder.coupon_code || undefined,
      discountAmount:
        dbOrder.discount_amount != null
          ? Number(dbOrder.discount_amount)
          : undefined,
    };
  }
}
