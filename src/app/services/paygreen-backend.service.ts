import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PayGreenPaymentOrderRequest } from './paygreen.types';
import { PaygreenConfigService } from './paygreen-config.service';

export interface PayGreenPaymentOrderResponseBackend {
  data: {
    id: string;
    hosted_payment_url: string;
    status: string;
  } & Record<string, unknown>;
  timestamp?: string;
  // Server-resolved coupon fields, echoed by create-paygreen-order.
  coupon_id?: string | null;
  coupon_code?: string | null;
  discount_amount?: number;
}

@Injectable({
  providedIn: 'root',
})
export class PaygreenBackendService {
  private readonly http = inject(HttpClient);
  private readonly backendUrl = environment.backendUrl;
  private readonly paygreenConfig = inject(PaygreenConfigService);

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      apikey: environment.supabase.anonKey,
      Authorization: `Bearer ${environment.supabase.anonKey}`,
    });
  }

  /**
   * Convert amount from euros to cents
   */
  convertToCents(amount: number): number {
    return Math.round(amount * 100);
  }

  /**
   * Create a hosted payment order through the server (Edge function).
   * The server re-validates `couponCode` (if any) and adjusts the final
   * payment amount accordingly. The client never controls the discount.
   *
   * @param vendorId ID of the vendor whose credentials should be used
   * @param paymentOrder Raw PayGreen PaymentOrder payload (amount already converted to cents)
   * @param deliveryAmountMinor Delivery cost in cents (for marketplace split)
   * @param coupon Optional coupon code + products subtotal in major units
   */
  createPaymentOrder(
    vendorId: string,
    paymentOrder: PayGreenPaymentOrderRequest,
    deliveryAmountMinor?: number,
    coupon?: { code: string; subtotal: number }
  ): Observable<PayGreenPaymentOrderResponseBackend> {
    return this.http.post<PayGreenPaymentOrderResponseBackend>(
      `${this.backendUrl}/functions/v1/create-paygreen-order`,
      {
        vendorId,
        paymentOrder,
        apiUrl: this.paygreenConfig.getApiUrl(),
        isSandbox: this.paygreenConfig.useSandboxCredentials(),
        ...(deliveryAmountMinor != null && { deliveryAmountMinor }),
        ...(coupon ? { couponCode: coupon.code, subtotal: coupon.subtotal } : {}),
      },
      { headers: this.getHeaders() }
    );
  }

  /**
   * Retrieve payment order details
   */
  getPaymentOrder(vendorId: string, paymentId: string) {
    const params = new URLSearchParams({ 
      vendorId, 
      paymentId,
      apiUrl: this.paygreenConfig.getApiUrl(),
      isSandbox: String(this.paygreenConfig.useSandboxCredentials()),
    }).toString();
    return this.http.get<any>(
      `${this.backendUrl}/functions/v1/get-paygreen-order?${params}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Create a marketplace shop for a vendor via PayGreen API
   */
  createMarketplaceShop(vendorId: string): Observable<{ success: boolean; shop_id: string }> {
    return this.http.post<{ success: boolean; shop_id: string }>(
      `${this.backendUrl}/functions/v1/paygreen-create-marketplace-shop`,
      {
        vendorId,
        isSandbox: this.paygreenConfig.useSandboxCredentials(),
      },
      { headers: this.getHeaders() }
    );
  }

  /**
   * Capture an authorised payment
   */
  capturePayment(vendorId: string, paymentId: string) {
    return this.http.post<any>(
      `${this.backendUrl}/functions/v1/capture-paygreen-order`,
      { 
        vendorId, 
        paymentId,
        apiUrl: this.paygreenConfig.getApiUrl(),
        isSandbox: this.paygreenConfig.useSandboxCredentials(),
      },
      { headers: this.getHeaders() }
    );
  }
}
