import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Order } from '../models/order.model';
import { environment } from '../../environments/environment';
import { DomainService } from './domain.service';
import { VendorService } from './vendor.service';
import { firstValueFrom } from 'rxjs';

export interface VendorEmailInfo {
  businessName: string;
  currency: string;
  paymentProvider: string;
  siret?: string;
  tvaNumber?: string;
  address?: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class EmailService {
  private supabaseService = inject(SupabaseService);
  private domainService = inject(DomainService);
  private vendorService = inject(VendorService);

  /**
   * Get vendor information for email
   */
  private async getVendorEmailInfo(vendorId?: string): Promise<VendorEmailInfo | null> {
    try {
      const vendor = this.vendorService.getCurrentVendor();
      if (!vendor) {
        console.warn('No current vendor found for email');
        return null;
      }

      // Get restaurant info which includes address and contact
      const restaurantInfo = await firstValueFrom(
        this.vendorService.getRestaurantInfo(vendorId || vendor.id)
      );

      return {
        businessName: vendor.business_name,
        currency: vendor.currency || 'EUR',
        paymentProvider: vendor.paymentprovider || 'STRIPE',
        // SIRET and TVA number can be added to vendor_metadata table if needed
        siret: (vendor as any).siret || undefined,
        tvaNumber: (vendor as any).tva_number || undefined,
        address: restaurantInfo?.address ? {
          street: restaurantInfo.address.street,
          city: restaurantInfo.address.city,
          postalCode: restaurantInfo.address.postal_code,
          country: restaurantInfo.address.country,
        } : undefined,
        contact: restaurantInfo?.contact ? {
          phone: restaurantInfo.contact.phone,
          email: restaurantInfo.contact.email,
          website: restaurantInfo.contact.website,
        } : undefined,
      };
    } catch (error) {
      console.error('Error getting vendor email info:', error);
      return null;
    }
  }

  async sendOrderConfirmationEmail(
    order: Order,
    trackingUrl?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(
        'Sending order confirmation email for order:',
        order.orderNumber
      );
      console.log('Customer email:', order.customer.email);
      console.log('Tracking URL:', trackingUrl);

      // Get vendor information
      const vendorInfo = await this.getVendorEmailInfo(order.vendorId);
      console.log('Vendor info for email:', vendorInfo);

      // Prepare the request body with enhanced data
      const requestBody = {
        to: order.customer.email,
        orderDetails: {
          orderNumber: order.orderNumber,
          customer: {
            ...order.customer,
            name: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
          },
          items: order.items.map(item => ({
            name: item.productName,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.price / item.quantity,
            totalPrice: item.price,
            price: item.price,
            tvaRate: item.tvaRate ?? 10,
            options: item.options,  // Pass full metadata for pro-rata TVA calculation
          })),
          totalAmount: order.totalAmount,
          status: order.status,
          orderType: order.orderType,
          timing: order.timing,
          scheduledTime: order.scheduledTime,
          notes: order.notes,
          createdAt: order.createdAt,
          payAtCheckout: order.payAtCheckout || false,
          currency: vendorInfo?.currency || 'EUR',
        },
        vendorInfo: vendorInfo,
        trackingUrl: trackingUrl,
        emailType: 'confirmation',
      };

      console.log(
        'Request body being sent:',
        JSON.stringify(requestBody, null, 2)
      );

      // Use direct fetch instead of Supabase client due to body serialization issues
      const functionUrl = `${environment.supabase.url}/functions/v1/send-order-confirmation`;

      try {
        console.log('Calling edge function directly...');

        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${environment.supabase.anonKey}`,
            apikey: environment.supabase.anonKey,
          },
          body: JSON.stringify(requestBody),
        });

        const responseText = await response.text();
        console.log('Response status:', response.status);
        console.log('Response text:', responseText);

        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Failed to parse response:', parseError);
          return {
            success: false,
            error: 'Invalid response from email service',
          };
        }

        if (!response.ok) {
          console.error('Edge function error:', data);
          return {
            success: false,
            error: data.error || `Email service error: ${response.status}`,
          };
        }

        // Check for edge function errors in the response
        if (data && typeof data === 'object' && 'success' in data) {
          if (data.success === false) {
            console.error('Edge function returned error:', data.error);
            console.error('Edge function error details:', data.received);
            return {
              success: false,
              error: data.error || 'Failed to send email',
            };
          }
        }

        // Success!
        console.log('Email sent successfully:', data);
        return { success: true };
      } catch (fetchError) {
        console.error('Edge function fetch error:', fetchError);
        throw fetchError;
      }
    } catch (error) {
      console.error('Failed to send confirmation email:', error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendOrderReadyEmail(
    order: Order,
    trackingUrl?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Sending order ready email for order:', order.orderNumber);
      console.log('Customer email:', order.customer.email);
      console.log('Tracking URL:', trackingUrl);

      // Get vendor information
      const vendorInfo = await this.getVendorEmailInfo(order.vendorId);
      console.log('Vendor info for ready email:', vendorInfo);

      // Prepare the request body with enhanced data
      const requestBody = {
        to: order.customer.email,
        orderDetails: {
          orderNumber: order.orderNumber,
          customer: {
            ...order.customer,
            name: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
          },
          items: order.items.map(item => ({
            name: item.productName,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.price / item.quantity,
            totalPrice: item.price,
            price: item.price,
            tvaRate: item.tvaRate ?? 10,
            options: item.options,  // Pass full metadata for pro-rata TVA calculation
          })),
          totalAmount: order.totalAmount,
          status: order.status,
          orderType: order.orderType,
          timing: order.timing,
          scheduledTime: order.scheduledTime,
          notes: order.notes,
          createdAt: order.createdAt,
          payAtCheckout: order.payAtCheckout || false,
          currency: vendorInfo?.currency || 'EUR',
        },
        vendorInfo: vendorInfo,
        trackingUrl: trackingUrl,
        emailType: 'ready',
      };

      console.log(
        'Request body being sent:',
        JSON.stringify(requestBody, null, 2)
      );

      // Use direct fetch instead of Supabase client due to body serialization issues
      const functionUrl = `${environment.supabase.url}/functions/v1/send-order-confirmation`;

      try {
        console.log('Calling edge function for ready notification...');

        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${environment.supabase.anonKey}`,
            apikey: environment.supabase.anonKey,
          },
          body: JSON.stringify(requestBody),
        });

        const responseText = await response.text();
        console.log('Response status:', response.status);
        console.log('Response text:', responseText);

        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Failed to parse response:', parseError);
          return {
            success: false,
            error: 'Invalid response from email service',
          };
        }

        if (!response.ok) {
          console.error('Edge function error:', data);
          return {
            success: false,
            error: data.error || `Email service error: ${response.status}`,
          };
        }

        // Check for edge function errors in the response
        if (data && typeof data === 'object' && 'success' in data) {
          if (data.success === false) {
            console.error('Edge function returned error:', data.error);
            console.error('Edge function error details:', data.received);
            return {
              success: false,
              error: data.error || 'Failed to send email',
            };
          }
        }

        // Success!
        console.log('Ready email sent successfully:', data);
        return { success: true };
      } catch (fetchError) {
        console.error('Edge function fetch error:', fetchError);
        throw fetchError;
      }
    } catch (error) {
      console.error('Failed to send ready email:', error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendOrderRefusedEmail(
    order: Order,
    refuseReason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Sending order refused email for order:', order.orderNumber);
      console.log('Customer email:', order.customer.email);
      console.log('Refuse reason:', refuseReason);

      const vendorInfo = await this.getVendorEmailInfo(order.vendorId);

      const requestBody = {
        to: order.customer.email,
        orderDetails: {
          orderNumber: order.orderNumber,
          customer: {
            ...order.customer,
            name: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
          },
          items: order.items.map(item => ({
            name: item.productName,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.price / item.quantity,
            totalPrice: item.price,
            price: item.price,
            tvaRate: item.tvaRate ?? 10,
            options: item.options,
          })),
          totalAmount: order.totalAmount,
          status: 'refused',
          orderType: order.orderType,
          timing: order.timing,
          scheduledTime: order.scheduledTime,
          notes: order.notes,
          createdAt: order.createdAt,
          payAtCheckout: order.payAtCheckout || false,
          currency: vendorInfo?.currency || 'EUR',
        },
        vendorInfo: vendorInfo,
        refuseReason: refuseReason || '',
        emailType: 'refused',
      };

      const functionUrl = `${environment.supabase.url}/functions/v1/send-order-confirmation`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${environment.supabase.anonKey}`,
          apikey: environment.supabase.anonKey,
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        return { success: false, error: 'Invalid response from email service' };
      }

      if (!response.ok) {
        return { success: false, error: data.error || `Email service error: ${response.status}` };
      }

      if (data?.success === false) {
        return { success: false, error: data.error || 'Failed to send email' };
      }

      console.log('Refused email sent successfully:', data);
      return { success: true };
    } catch (error) {
      console.error('Failed to send refused email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate tracking URL for the order
   * @param orderId The order ID
   * @param vendorSlug The vendor slug
   * @returns The tracking URL
   */
  generateTrackingUrl(orderId: string, vendorSlug?: string): string {
    const baseUrl = window.location.origin;
    const hostname = this.domainService.getHostname();
    const isCustomDomain = this.domainService.isCustomDomain(hostname);

    // On vendor custom domains, the success route is NOT vendor-prefixed.
    if (isCustomDomain) {
      return `${baseUrl}/successPayment?orderId=${orderId}`;
    }

    // On pikiapp domains, prefer /vendor/:vendorSlug/successPayment.
    const resolvedSlug =
      vendorSlug ||
      (() => {
        const currentPath = window.location.pathname;
        // Supported shapes:
        // - /vendor/<slug>/...
        // - /<slug>/... (legacy)
        const matchVendorPrefixed =
          currentPath.match(/^\/vendor\/([^\/]+)(\/|$)/);
        if (matchVendorPrefixed?.[1]) return matchVendorPrefixed[1];

        const matchLegacy = currentPath.match(/^\/([^\/]+)(\/|$)/);
        if (matchLegacy?.[1] && matchLegacy[1] !== 'vendor') return matchLegacy[1];

        return undefined;
      })();

    if (resolvedSlug) {
      return `${baseUrl}/vendor/${resolvedSlug}/successPayment?orderId=${orderId}`;
    }

    // Fallback (should rarely happen): avoid /successPayment redirect on pikiapp domains.
    return `${baseUrl}/?orderId=${orderId}`;
  }

  /**
   * Test edge function connectivity
   */

  /**
   * Manually test edge function URL
   */
}
