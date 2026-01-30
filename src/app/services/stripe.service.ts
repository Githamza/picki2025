import { Injectable, inject } from '@angular/core';
import { Observable, from, map, mergeMap, of, throwError } from 'rxjs';
import { SupabaseAuthService } from './supabase-auth.service';

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
  metadata?: Record<string, string>;
  currency?: string;
  amount_total?: number;
  customer_details?: unknown;
  line_items?: unknown;
  created?: number;
  expires_at?: number;
}

export interface StripeCheckoutCreateRequest {
  vendorId: string; // vendor UUID (server will use vendors.stripe_account_id)
  currency: string; // e.g. "EUR"
  items: Array<{
    name: string;
    quantity: number;
    price: number; // major unit (e.g. 12.5 EUR)
  }>;
  success_url: string;
  cancel_url: string;
  customer_email?: string;
  metadata?: Record<string, string>;
}

export interface StripeCheckoutGetRequest {
  sessionId: string;
}

@Injectable({
  providedIn: 'root',
})
export class StripeService {
  private readonly supabaseAuthService = inject(SupabaseAuthService);

  private invokeFunction<TResponse>(
    functionName: string,
    body: Record<string, unknown>
  ): Observable<TResponse> {
    return from(
      this.supabaseAuthService
        .getClient()
        .functions.invoke<TResponse>(functionName, { body })
    ).pipe(
      mergeMap(({ data, error }) => {
        if (error) {
          return throwError(() => new Error(error.message || String(error)));
        }
        if (!data) {
          return throwError(
            () => new Error(`Edge Function '${functionName}' returned no data`)
          );
        }
        return of(data);
      })
    );
  }

  /**
   * Create a Stripe onboarding link for a vendor.
   * This will create a Stripe Express account if one doesn't exist,
   * then return an onboarding link URL.
   * @param vendorId Vendor UUID
   * @param refreshUrl URL to redirect if link expires
   * @param returnUrl URL to redirect after onboarding
   * @returns Observable with onboarding link URL
   */
  createOnboardingLink(
    vendorId: string,
    refreshUrl: string,
    returnUrl: string
  ): Observable<{ url: string; expires_at: number; stripe_account_id: string }> {
    return this.invokeFunction<{ url: string; expires_at: number; stripe_account_id: string }>(
      'stripe-create-onboarding-link',
      { vendorId, refreshUrl, returnUrl }
    );
  }

  /**
   * Check Stripe account onboarding status and update the vendor record.
   * Call this when user returns from Stripe onboarding.
   * @param vendorId Vendor UUID
   * @returns Observable with onboarding status
   */
  checkOnboardingStatus(vendorId: string): Observable<{
    stripe_account_id: string;
    details_submitted: boolean;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    onboarding_complete: boolean;
    requirements: any;
  }> {
    return this.invokeFunction<{
      stripe_account_id: string;
      details_submitted: boolean;
      charges_enabled: boolean;
      payouts_enabled: boolean;
      onboarding_complete: boolean;
      requirements: any;
    }>('stripe-check-onboarding-status', { vendorId });
  }

  /**
   * Create a Stripe Checkout session (server uses Stripe secret key and vendor.stripe_account_id)
   * @param checkoutData Checkout session data
   * @returns Observable with checkout session
   */
  createCheckoutSession(
    checkoutData: StripeCheckoutCreateRequest
  ): Observable<StripeCheckoutSession> {
    return this.invokeFunction<StripeCheckoutSession>(
      'stripe-create-checkout-session',
      checkoutData as unknown as Record<string, unknown>
    );
  }

  /**
   * Retrieve a Stripe Checkout session (server-side call to Stripe API)
   */
  getCheckoutSession(sessionId: string): Observable<StripeCheckoutSession> {
    return this.invokeFunction<StripeCheckoutSession>(
      'stripe-get-checkout-session',
      { sessionId }
    );
  }

  /**
   * Get account details
   * Note: This requires a backend endpoint
   * @param accountId Stripe account ID
   * @returns Observable with account details
   */
  getAccount(accountId: string): Observable<any> {
    return throwError(() => new Error('Stripe account retrieval is not implemented yet'));
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
    // Frontend can't verify server STRIPE_SECRET_KEY; treat availability as "Edge Functions reachable"
    // (provider selection additionally checks vendor.stripe_account_id).
    return true;
  }
}
