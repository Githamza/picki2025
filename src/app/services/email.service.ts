import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Order } from '../models/order.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class EmailService {
  private supabaseService = inject(SupabaseService);

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

      // Prepare the request body
      const requestBody = {
        to: order.customer.email,
        orderDetails: {
          orderNumber: order.orderNumber,
          customer: order.customer,
          items: order.items,
          totalAmount: order.totalAmount,
          status: order.status,
          orderType: order.orderType,
          timing: order.timing,
          scheduledTime: order.scheduledTime,
          notes: order.notes,
        },
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

      // Prepare the request body
      const requestBody = {
        to: order.customer.email,
        orderDetails: {
          orderNumber: order.orderNumber,
          customer: order.customer,
          items: order.items,
          totalAmount: order.totalAmount,
          status: order.status,
          orderType: order.orderType,
          timing: order.timing,
          scheduledTime: order.scheduledTime,
          notes: order.notes,
        },
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

  /**
   * Generate tracking URL for the order
   * @param orderId The order ID
   * @param vendorSlug The vendor slug
   * @returns The tracking URL
   */
  generateTrackingUrl(orderId: string, vendorSlug?: string): string {
    const baseUrl = window.location.origin;

    if (vendorSlug) {
      // If vendor slug is provided, use the vendor-specific route
      // Format: /vendorSlug/successPayment?orderId=xxx
      return `${baseUrl}/${vendorSlug}/successPayment?orderId=${orderId}`;
    } else {
      // Try to extract vendor from current URL if not provided
      const currentPath = window.location.pathname;
      const vendorMatch = currentPath.match(/^\/([^\/]+)\//);

      if (vendorMatch && vendorMatch[1]) {
        const extractedVendorSlug = vendorMatch[1];
        return `${baseUrl}/${extractedVendorSlug}/successPayment?orderId=${orderId}`;
      }

      // Fallback to non-vendor specific URL (though this should rarely happen)
      return `${baseUrl}/successPayment?orderId=${orderId}`;
    }
  }

  /**
   * Test edge function connectivity
   */

  /**
   * Manually test edge function URL
   */
}
