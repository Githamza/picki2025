import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  PaymentStrategy,
  PaymentRequest,
  PaymentResponse,
} from './payment-strategy.interface';
import { PaygreenPaymentStrategy } from './strategies/paygreen-payment.strategy';
import { StripePaymentStrategy } from './strategies/stripe-payment.strategy';
import { HttpClient } from '@angular/common/http';
import { PaygreenBackendService } from './paygreen-backend.service';
import { map } from 'rxjs/operators';
import { StripeService } from './stripe.service';
import { VendorService } from './vendor.service';

export type PaymentProvider = 'paygreen' | 'stripe';

export interface PaymentDetails {
  id: string;
  amount: number; // Amount in the main currency unit (not cents)
  originalAmount?: number; // Original amount before any modifications
  currency: string;
  status: string;
  reference?: string; // Order reference or identifier
  description?: string;
  metadata?: any;

  // Customer/Buyer information
  customerEmail?: string;
  customerName?: {
    firstName?: string;
    lastName?: string;
  };
  customerId?: string;

  // URLs
  returnUrl?: string;
  cancelUrl?: string;
  hostedPaymentUrl?: string;

  // Timestamps
  createdAt?: string;
  expiresAt?: string;
  authorizedAt?: string;
  capturedAt?: string;

  // Payment method and transaction details
  platforms?: string[]; // Available payment platforms
  transactions?: PaymentTransaction[];

  // Shop/Merchant information
  shopId?: string;
  shopName?: string;

  // Configuration
  autoCapture?: boolean;
  partialAllowed?: boolean;
  mode?: string; // 'instant', 'subscription', etc.

  // Items (for order details)
  items?: any[];

  // Fees and costs
  fees?: number;
  paymentProviderFees?: number;
}

export interface PaymentTransaction {
  id: string;
  amount: number;
  status: string;
  operations?: PaymentOperation[];
  createdAt?: string;
  updatedAt?: string;
  hasDispute?: boolean;
}

export interface PaymentOperation {
  id: string;
  platform: string;
  type: string;
  amount: number;
  authorizedAmount?: number;
  status: string;
  authorizationCode?: string;
  createdAt?: string;
  authorizedAt?: string;
  capturedAt?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private readonly paygreenStrategy = inject(PaygreenPaymentStrategy);
  private readonly stripeStrategy = inject(StripePaymentStrategy);
  private readonly http = inject(HttpClient);
  private readonly paygreenBackend = inject(PaygreenBackendService);
  private readonly stripeService = inject(StripeService);
  private readonly vendorService = inject(VendorService);

  // Default payment provider - can be changed manually
  private currentProvider: PaymentProvider = 'paygreen';

  private readonly strategies = new Map<PaymentProvider, PaymentStrategy>([
    ['paygreen', this.paygreenStrategy],
    ['stripe', this.stripeStrategy],
  ]);

  /**
   * Get the current active payment strategy
   * @returns Current payment strategy
   */
  getCurrentStrategy(): PaymentStrategy {
    const strategy = this.strategies.get(this.currentProvider);
    if (!strategy) {
      throw new Error(`Payment strategy '${this.currentProvider}' not found`);
    }
    return strategy;
  }

  /**
   * Get current payment provider
   * @returns Current provider name
   */
  getCurrentProvider(): PaymentProvider {
    return this.currentProvider;
  }

  /**
   * Switch payment provider manually
   * @param provider Payment provider to switch to
   */
  setPaymentProvider(provider: PaymentProvider): void {
    if (!this.strategies.has(provider)) {
      throw new Error(`Payment provider '${provider}' is not supported`);
    }

    const strategy = this.strategies.get(provider)!;
    if (!strategy.isAvailable()) {
      throw new Error(
        `Payment provider '${provider}' is not properly configured`
      );
    }

    this.currentProvider = provider;
    console.log(`Payment provider switched to: ${strategy.name}`);
  }

  /**
   * Create a payment using the current strategy
   * @param request Payment request data
   * @returns Observable with payment response
   */
  createPayment(request: PaymentRequest): Observable<PaymentResponse> {
    const strategy = this.getCurrentStrategy();

    if (!strategy.isAvailable()) {
      throw new Error(`Payment provider '${strategy.name}' is not available`);
    }

    console.log(`Processing payment with ${strategy.name}`, {
      amount: request.amount,
      currency: request.currency,
      provider: strategy.provider,
    });

    return strategy.createPayment(request);
  }

  /**
   * Get all available payment strategies
   * @returns Array of available strategies
   */
  getAvailableStrategies(): PaymentStrategy[] {
    return Array.from(this.strategies.values()).filter((strategy) =>
      strategy.isAvailable()
    );
  }

  /**
   * Check if a specific provider is available
   * @param provider Provider to check
   * @returns True if provider is available
   */
  isProviderAvailable(provider: PaymentProvider): boolean {
    const strategy = this.strategies.get(provider);
    return strategy ? strategy.isAvailable() : false;
  }

  /**
   * Convert amount using current strategy
   * @param amount Amount in the vendor currency main unit
   * @returns Converted amount
   */
  convertAmount(amount: number): number {
    return this.getCurrentStrategy().convertAmount(amount);
  }

  /**
   * Retrieve PayGreen payment details
   * @param paymentId PayGreen payment ID (po_id)
   * @returns Observable with payment details
   */
  getPayGreenPayment(
    vendorId: string,
    paymentId: string
  ): Observable<PaymentDetails> {
    console.log('Retrieving PayGreen payment:', paymentId);

    if (!vendorId) {
      console.error('vendorId missing for getPayGreenPayment');
    }
    return this.paygreenBackend
      .getPaymentOrder(vendorId!, paymentId)
      .pipe(
        map((response) =>
          this.mapPayGreenResponse(response.data.data ?? response.data)
        )
      );
  }

  /**
   * Retrieve Stripe checkout session details
   * @param sessionId Stripe checkout session ID
   * @returns Observable with payment details
   */
  getStripeSession(sessionId: string): Observable<PaymentDetails> {
    console.log('Retrieving Stripe session:', sessionId);

    return this.stripeService.getCheckoutSession(sessionId).pipe(
      map((session: any) => this.mapStripeResponse(session))
    );
  }

  /**
   * Map PayGreen API response to PaymentDetails
   */
  private mapPayGreenResponse(response: any): PaymentDetails {
    return {
      id: response.id,
      amount: response.amount / 100, // PayGreen amounts are in cents
      originalAmount: response.original_amount
        ? response.original_amount / 100
        : undefined,
      currency: response.currency.toUpperCase(),
      status: response.status,
      reference: response.reference,
      description: response.description,
      metadata: response.metadata,

      // Customer information
      customerEmail: response.buyer?.email,
      customerName: response.buyer
        ? {
            firstName: response.buyer.first_name,
            lastName: response.buyer.last_name,
          }
        : undefined,
      customerId: response.buyer?.id,

      // URLs
      returnUrl: response.return_url,
      cancelUrl: response.cancel_url,
      hostedPaymentUrl: response.hosted_payment_url,

      // Timestamps
      createdAt: response.created_at,
      expiresAt: response.expires_at,

      // Payment configuration
      platforms: response.platforms,
      autoCapture: response.auto_capture,
      partialAllowed: response.partial_allowed,
      mode: response.mode,

      // Shop information
      shopId: response.shop_id,
      shopName: response.shop_name || response.shop_commercial_name,

      // Fees
      fees: response.fees ? response.fees / 100 : undefined,
      paymentProviderFees: response.paygreen_fees
        ? response.paygreen_fees / 100
        : undefined,

      // Transactions
      transactions: response.transactions?.map((transaction: any) => ({
        id: transaction.id,
        amount: transaction.amount / 100,
        status: transaction.status,
        createdAt: transaction.created_at,
        updatedAt: transaction.updated_at,
        hasDispute: transaction.has_dispute,
        operations: transaction.operations?.map((operation: any) => ({
          id: operation.id,
          platform:
            operation.payment_config?.platform ||
            operation.instrument?.platform,
          type: operation.type,
          amount: operation.amount / 100,
          authorizedAmount: operation.authorized_amount
            ? operation.authorized_amount / 100
            : undefined,
          status: operation.status,
          authorizationCode: operation.authorization_code,
          createdAt: operation.created_at,
          authorizedAt: operation.authorized_at,
          capturedAt: operation.captured_at,
        })),
      })),
    };
  }

  /**
   * Map Stripe API response to PaymentDetails
   */
  private mapStripeResponse(response: any): PaymentDetails {
    return {
      id: response.id,
      amount: response.amount_total / 100, // Stripe amounts are in cents
      currency: response.currency.toUpperCase(),
      status: response.payment_status,
      reference: response.client_reference_id,
      metadata: response.metadata,

      // Customer information
      customerEmail: response.customer_details?.email,
      customerName: response.customer_details
        ? {
            firstName: response.customer_details.name?.split(' ')[0],
            lastName: response.customer_details.name
              ?.split(' ')
              .slice(1)
              .join(' '),
          }
        : undefined,
      customerId: response.customer,

      // URLs
      returnUrl: response.success_url,
      cancelUrl: response.cancel_url,
      hostedPaymentUrl: response.url,

      // Timestamps
      createdAt: response.created
        ? new Date(response.created * 1000).toISOString()
        : undefined,
      expiresAt: response.expires_at
        ? new Date(response.expires_at * 1000).toISOString()
        : undefined,

      // Payment configuration
      mode: response.mode,

      // Items from line_items if available
      items: response.line_items?.data || response.display_items,
    };
  }

  /**
   * Capture a PayGreen payment
   * @param paymentId PayGreen payment ID (po_id)
   * @returns Observable with capture response
   */
  capturePayGreenPayment(vendorId: string, paymentId: string): Observable<any> {
    console.log('Capturing PayGreen payment:', paymentId);
    return this.paygreenBackend.capturePayment(vendorId, paymentId);
  }

  /**
   * Generic capture payment method that determines the provider
   * @param paymentId Payment ID
   * @param provider Payment provider ('paygreen' | 'stripe')
   * @returns Observable with capture response
   */
  capturePayment(
    vendorId: string,
    paymentId: string,
    provider: PaymentProvider = 'paygreen'
  ): Observable<any> {
    console.log(`Capturing payment ${paymentId} with provider ${provider}`);

    switch (provider) {
      case 'paygreen':
        return this.capturePayGreenPayment(vendorId, paymentId);
      case 'stripe':
        // For Stripe, capture should be handled on the backend
        // This is a placeholder - implement backend API call
        console.warn('Stripe payment capture should be handled on the backend');
        return of({
          success: false,
          message: 'Stripe capture not implemented',
        });
      default:
        throw new Error(`Unsupported payment provider: ${provider}`);
    }
  }
}
