import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface StripeExpressAccount {
  id: string;
  type: 'express';
  country: string;
  email?: string;
  business_type?: 'individual' | 'company';
}

export interface StripeAccountLink {
  object: 'account_link';
  created: number;
  expires_at: number;
  url: string;
}

export interface StripeCheckoutSession {
  id: string;
  object: 'checkout.session';
  url: string;
  payment_status: string;
  status: string;
}

export interface StripeCheckoutRequest {
  line_items: Array<{
    price_data: {
      currency: string;
      product_data: {
        name: string;
      };
      unit_amount: number;
    };
    quantity: number;
  }>;
  mode: 'payment';
  success_url: string;
  cancel_url: string;
  customer_email?: string;
  payment_intent_data?: {
    transfer_data?: {
      destination: string; // Connected account ID
    };
    application_fee_amount?: number;
  };
  metadata?: Record<string, string>;
}

@Injectable({
  providedIn: 'root',
})
export class StripeService {
  private apiUrl = environment.backendUrl || 'http://localhost:3000'; // Your backend URL

  constructor(private http: HttpClient) {}

  /**
   * Create a Stripe Express account for a vendor
   * Note: This requires a backend endpoint
   * @param accountData Account creation data
   * @returns Observable with account details
   */
  createExpressAccount(accountData: {
    email: string;
    country: string;
    business_type?: 'individual' | 'company';
  }): Observable<StripeExpressAccount> {
    return this.http.post<StripeExpressAccount>(
      `${this.apiUrl}/stripe/create-express-account`,
      accountData
    );
  }

  /**
   * Create an account link for vendor onboarding
   * Note: This requires a backend endpoint
   * @param accountId Stripe account ID
   * @param refreshUrl URL to redirect if link expires
   * @param returnUrl URL to redirect after onboarding
   * @returns Observable with account link
   */
  createAccountLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string
  ): Observable<StripeAccountLink> {
    return this.http.post<StripeAccountLink>(
      `${this.apiUrl}/stripe/account-link`,
      {
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      }
    );
  }

  /**
   * Create a Stripe Checkout session for marketplace payment
   * Note: This requires a backend endpoint for security
   * @param checkoutData Checkout session data
   * @returns Observable with checkout session
   */
  createCheckoutSession(
    checkoutData: StripeCheckoutRequest
  ): Observable<StripeCheckoutSession> {
    return this.http.post<StripeCheckoutSession>(
      `${this.apiUrl}/stripe/create-checkout-session`,
      checkoutData
    );
  }

  /**
   * Get account details
   * Note: This requires a backend endpoint
   * @param accountId Stripe account ID
   * @returns Observable with account details
   */
  getAccount(accountId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/stripe/account/${accountId}`);
  }

  /**
   * Convert amount from euros to cents (Stripe format)
   * @param amount Amount in euros
   * @returns Amount in cents
   */
  convertToCents(amount: number): number {
    return Math.round(amount * 100);
  }

  /**
   * Check if Stripe is properly configured
   * @returns True if Stripe can be used
   */
  isConfigured(): boolean {
    return !!(environment.stripePublishableKey && this.apiUrl);
  }
}
