import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, from, Observable, of, throwError } from 'rxjs';
import { map, catchError, timeout, retry, shareReplay } from 'rxjs/operators';
import { Order, OrderStatus } from '../models/order.model';
import { Address, DeliveryQuote } from './delivery/delivery.types';
import { SupabaseService } from './supabase.service';
import { SupabaseAuthService } from './supabase-auth.service';
import { Database } from '../types/supabase.types';
import { VendorService } from './vendor.service';

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

  // Debug method to check order existence
  async debugOrderExists(orderId: string): Promise<boolean> {
    try {
      console.log(`Checking if order ${orderId} exists...`);
      const { data, error } = await this.supabaseService
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

  // Debug method to list all order IDs
  async debugListAllOrderIds(): Promise<void> {
    try {
      console.log('Fetching all order IDs...');
      const { data, error } = await this.supabaseService
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

  // Enhanced get order method with better error handling
  async getOrderById(orderId: string): Promise<Order | null> {
    console.log(`Getting order by ID: ${orderId}`);

    try {
      // First check if order exists
      const exists = await this.debugOrderExists(orderId);
      if (!exists) {
        console.warn(`Order ${orderId} does not exist`);
        return null;
      }

      console.log(`Order ${orderId} exists, fetching full details...`);

      const { data, error } = await this.supabaseService
        .getClient()
        .from('orders')
        .select(
          `
          *,
          order_items (
            *,
            products (
              id,
              name,
              image_url
            )
          )
        `
        )
        .eq('id', orderId)
        .single();

      if (error) {
        console.error(`Error fetching order ${orderId}:`, error);
        console.error('Supabase error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        return null;
      }

      if (!data) {
        console.error(`No data returned for order ${orderId}`);
        return null;
      }

      console.log(`Successfully fetched order ${orderId}:`, {
        id: data.id,
        orderNumber: data.order_number,
        status: data.status,
        itemCount: data.order_items?.length || 0,
      });

      return this.mapDbOrderToOrder(data);
    } catch (error) {
      console.error(`Error getting order ${orderId}:`, error);

      // Check if it's the specific callback error
      if (
        error instanceof Error &&
        error.message.includes('callback is no longer runnable')
      ) {
        console.error(
          'Detected Angular lifecycle callback error. This may be due to component destruction during async operation.'
        );
      }

      return null;
    }
  }

  // Safer wrapper that returns an Observable to handle Angular lifecycle better
  getOrderByIdSafe(orderId: string): Observable<Order | null> {
    return from(this.getOrderById(orderId)).pipe(
      map((order) => {
        console.log(
          `Observable wrapper: Order ${orderId} result:`,
          order ? 'found' : 'not found'
        );
        return order;
      })
    );
  }

  // Most robust method - handles timeouts, retries, and lifecycle issues
  getOrderByIdRobust(orderId: string): Observable<Order | null> {
    console.log(`Getting order ${orderId} with robust method...`);

    return from(
      (async () => {
        try {
          // Use a simpler query first to test connectivity
          const { data: testData, error: testError } =
            await this.supabaseService
              .getClient()
              .from('orders')
              .select('id, order_number, status')
              .eq('id', orderId)
              .single();

          if (testError) {
            console.error(
              `Simple query failed for order ${orderId}:`,
              testError
            );
            throw new Error(`Order not found: ${testError.message}`);
          }

          if (!testData) {
            console.warn(`Order ${orderId} not found in database`);
            return null;
          }

          console.log(`Order ${orderId} found, fetching full details...`);

          // Now get full order details
          const { data, error } = await this.supabaseService
            .getClient()
            .from('orders')
            .select(
              `
              *,
              order_items (
                *,
                products (
                  id,
                  name,
                  image_url
                )
              )
            `
            )
            .eq('id', orderId)
            .single();

          if (error) {
            console.error(`Full query failed for order ${orderId}:`, error);
            throw new Error(`Failed to fetch order details: ${error.message}`);
          }

          return this.mapDbOrderToOrder(data);
        } catch (error) {
          console.error(`Robust method error for order ${orderId}:`, error);
          throw error;
        }
      })()
    ).pipe(
      timeout(10000), // 10 second timeout
      retry({
        count: 2,
        delay: 1000, // 1 second delay between retries
      }),
      catchError((error) => {
        console.error(`All retry attempts failed for order ${orderId}:`, error);

        if (error?.name === 'TimeoutError') {
          return throwError(
            () => new Error('Request timed out. Please try again.')
          );
        }

        if (error?.message?.includes('callback is no longer runnable')) {
          console.error(
            'Detected callback lifecycle error, returning null instead of throwing'
          );
          return of(null); // Return null instead of throwing for lifecycle errors
        }

        return throwError(() => error);
      }),
      shareReplay(1) // Share the result to avoid multiple requests
    );
  }

  async addOrder(order: Order): Promise<Order> {
    try {
      // Get current vendor ID
      const currentVendor = this.vendorService.getCurrentVendor();
      const vendorId = currentVendor?.id;

      // Create order in database
      const dbOrder = await this.supabaseService.createOrder({
        order_number: order.orderNumber,
        customer_email: order.customer.email,
        customer_first_name: order.customer.firstName,
        customer_last_name: order.customer.lastName,
        customer_phone: order.customer.phone,
        total_amount: order.totalAmount,
        status: order.status as Database['public']['Enums']['order_status'],
        order_type:
          order.orderType as Database['public']['Enums']['order_type'],
        timing: order.timing as Database['public']['Enums']['order_timing'],
        scheduled_time: order.scheduledTime?.toISOString(),
        table_number: order.tableNumber,
        notes: order.notes,
        pay_at_checkout: order.payAtCheckout ?? false,
        vendor_id: vendorId, // Include vendor ID when creating order
      });

      if (dbOrder) {
        // Create order items with proper vendor ID and comments
        const orderItems = order.items.map((item) => ({
          order_id: dbOrder.id,
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
          vendor_id: (item as any).vendorId || null, // Get vendor ID from item if available
          options: item.options || [], // Store multi-step metadata here
          comment: item.comment || null,
        }));

        const createdOrderItems = await this.supabaseService.createOrderItems(
          orderItems
        );

        // Create order item complements if any
        if (createdOrderItems) {
          const allComplements: any[] = [];

          order.items.forEach((item, index) => {
            const orderItem = createdOrderItems[index];
            if (orderItem && (item as any).selectedComplements) {
              const complements = (item as any).selectedComplements.map(
                (comp: any) => ({
                  order_item_id: orderItem.id,
                  complement_product_id: comp.complement_product_id,
                  complement_name:
                    comp.complement_name ||
                    `Complement ${comp.complement_product_id}`,
                  quantity: comp.quantity,
                  unit_price: comp.unit_price,
                  total_price: comp.total_price,
                })
              );
              allComplements.push(...complements);
            }
          });

          if (allComplements.length > 0) {
            await this.supabaseService.createOrderItemComplements(
              allComplements
            );
          }
        }

        // Atomically reserve stock for all products in the order
        // This uses row-level locking to prevent race conditions
        const { data: stockResult, error: stockError } = await (
          this.supabaseService.getClient() as any
        ).rpc('reserve_stock_for_order', { p_order_id: dbOrder.id });

        if (stockError) {
          console.error(
            '[OrdersService] Stock reservation RPC error:',
            stockError
          );
          // Delete the order since stock reservation failed
          await this.deleteOrderOnStockFailure(dbOrder.id);
          throw new Error(
            'Stock reservation failed due to database error. Please try again.'
          );
        }

        if (stockResult && !stockResult.success) {
          console.warn(
            '[OrdersService] Insufficient stock for order:',
            stockResult.insufficientItems
          );
          // Delete the order since stock is insufficient
          await this.deleteOrderOnStockFailure(dbOrder.id);

          // Create a detailed error with insufficient items info
          const error = new Error('INSUFFICIENT_STOCK') as any;
          error.insufficientItems = stockResult.insufficientItems;
          throw error;
        }

        console.log(
          '[OrdersService] Stock reserved successfully for order:',
          dbOrder.id,
          stockResult?.reservedProducts
        );

        // Reload orders
        await this.loadOrders();

        // Return the created order with the database ID
        return {
          ...order,
          id: dbOrder.id,
        };
      }

      throw new Error('Failed to create order');
    } catch (error) {
      console.error('Error adding order:', error);
      throw error;
    }
  }

  /**
   * Deletes an order when stock reservation fails.
   * This is called to clean up after atomic stock reservation detects insufficient stock.
   * The database cascades will automatically delete order_items and order_item_complements.
   */
  private async deleteOrderOnStockFailure(orderId: string): Promise<void> {
    try {
      const { error } = await this.supabaseService
        .getClient()
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (error) {
        console.error(
          '[OrdersService] Failed to delete order after stock failure:',
          error
        );
      } else {
        console.log(
          '[OrdersService] Order deleted after stock reservation failure:',
          orderId
        );
      }
    } catch (error) {
      console.error(
        '[OrdersService] Exception deleting order after stock failure:',
        error
      );
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
          const { error: stockError } = await (this.supabaseService
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
          const { error: stockError } = await (this.supabaseService
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
    await this.supabaseService.upsertOrderDelivery({
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
    });
  }

  getOrdersByStatus(status: OrderStatus): Observable<Order[]> {
    return this.orders$.pipe(
      map((orders) => orders.filter((order) => order.status === status))
    );
  }

  private mapDbOrderToOrder(dbOrder: any): Order {
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
    };
  }
}
