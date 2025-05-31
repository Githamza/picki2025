import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PayGreenPaymentRequest {
  orderId: string;
  amount: number; // Amount in cents
  currency: string;
  buyer: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
  returnUrl: string;
  cancelUrl: string;
  metadata?: any;
}

export interface PayGreenPaymentResponse {
  id: string;
  url: string;
  status: string;
}

export interface PayGreenPaymentOrderRequest {
  ttl?: number; // Time to live in seconds
  auto_capture: boolean;
  buyer: {
    object: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  currency: string;
  merchant_initiated: boolean;
  mode: string; // 'instant' or other modes
  partial_allowed: boolean;
  return_url: string;
  plbs: boolean;
  amount: number; // Amount in the smallest currency unit
  reference?: string; // Order reference ID
}

export interface PayGreenPaymentOrderResponse {
  data: {
    id: string;
    object: string;
    amount: number;
    status: string;
    currency: string;
    hosted_payment_url: string;
    expires_at: string;
    buyer: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      phone_number?: string;
      created_at: string;
    };
    platforms: string[];
    shop_name: string;
    created_at: string;
  };
  timestamp: string;
}

export interface PayGreenAuthResponse {
  data: {
    token: string;
  };
  timestamp: string;
}

export interface PayGreenPaymentDetailsResponse {
  data: {
    id: string;
    object: string;
    amount: number;
    status: string;
    currency: string;
    hosted_payment_url: string;
    expires_at: string;
    buyer: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      phone_number?: string;
      created_at: string;
    };
    platforms: string[];
    shop_name: string;
    created_at: string;
    metadata?: any;
    reference?: string; // Order reference
  };
  timestamp: string;
}

export interface PayGreenCaptureResponse {
  data: {
    id: string;
    object: string;
    amount: number;
    status: string;
    currency: string;
    captured_at: string;
    operations: Array<{
      id: string;
      type: string;
      amount: number;
      status: string;
      captured_at?: string;
    }>;
  };
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class PaygreenService {
  private apiUrl = environment.PayGreenUrl;
  private shopId = environment.PayGreenShopId;
  token: string = '';

  constructor(private http: HttpClient) {}

  /**
   * Convert amount from euros to cents
   * @param amount Amount in euros
   * @returns Amount in cents
   */
  convertToCents(amount: number): number {
    return Math.round(amount * 100);
  }

  /**
   * Generate a unique order ID
   * @returns Unique order ID
   */
  generateOrderId(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `ORDER_${timestamp}_${random}`;
  }

  /**
   * Create a payment order with PayGreen
   * @param paymentOrder Payment order request data
   * @returns Observable with payment order response
   */
  createPaymentOrder(
    paymentOrder: PayGreenPaymentOrderRequest
  ): Observable<PayGreenPaymentOrderResponse> {
    return this.authenticate().pipe(
      switchMap((authResponse: PayGreenAuthResponse) => {
        this.token = authResponse.data.token;

        const headers = new HttpHeaders({
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        });

        // Ensure buyer object has the required 'object' property
        const payload: PayGreenPaymentOrderRequest = {
          ttl: paymentOrder.ttl || 600, // Default 10 minutes
          auto_capture: paymentOrder.auto_capture,
          buyer: {
            ...paymentOrder.buyer,
            object: 'buyer', // Ensure this is always set to 'buyer'
          },
          currency: paymentOrder.currency.toLowerCase(), // Ensure lowercase currency
          merchant_initiated: paymentOrder.merchant_initiated,
          mode: paymentOrder.mode,
          partial_allowed: paymentOrder.partial_allowed,
          plbs: paymentOrder.plbs,
          amount: paymentOrder.amount,
          return_url: paymentOrder.return_url,
          reference: paymentOrder.reference,
        };

        return this.http.post<PayGreenPaymentOrderResponse>(
          `${this.apiUrl}/payment/payment-orders`,
          payload,
          { headers }
        );
      })
    );
  }

  authenticate(): Observable<PayGreenAuthResponse> {
    const headers = new HttpHeaders({
      Authorization: `${environment.PayGreenPrivateKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });
    return this.http.post<PayGreenAuthResponse>(
      `${this.apiUrl}/auth/authentication/${this.shopId}/secret-key`,
      {},
      { headers }
    );
  }

  /**
   * Retrieve payment order details by ID
   * @param paymentId PayGreen payment order ID
   * @returns Observable with payment order details
   */
  getPaymentOrder(
    paymentId: string
  ): Observable<PayGreenPaymentDetailsResponse> {
    return this.authenticate().pipe(
      switchMap((authResponse: PayGreenAuthResponse) => {
        this.token = authResponse.data.token;

        const headers = new HttpHeaders({
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        });

        return this.http.get<PayGreenPaymentDetailsResponse>(
          `${this.apiUrl}/payment/payment-orders/${paymentId}`,
          { headers }
        );
      })
    );
  }

  /**
   * Capture an authorized payment
   * @param paymentId PayGreen payment order ID
   * @returns Observable with capture response
   */
  capturePayment(paymentId: string): Observable<PayGreenCaptureResponse> {
    return this.authenticate().pipe(
      switchMap((authResponse: PayGreenAuthResponse) => {
        this.token = authResponse.data.token;

        const headers = new HttpHeaders({
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        });

        return this.http.post<PayGreenCaptureResponse>(
          `${this.apiUrl}/payment/payment-orders/${paymentId}/capture`,
          {},
          { headers }
        );
      })
    );
  }
}
