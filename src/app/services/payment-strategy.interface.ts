import { Observable } from 'rxjs';

export interface PaymentRequest {
  amount: number; // Amount in euros
  currency: string;
  buyer: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  returnUrl?: string; // Success return URL
  cancelUrl?: string; // Cancel/failure return URL
  metadata?: any;
  vendorId?: string; // For marketplace payments
  reference?: string; // Reference to the created order
  // Amount Picki retains from this payment (e.g. delivery fee).
  // In major currency units (e.g. euros). Stripe converts to cents internally.
  // When set, Stripe Connect routes this amount to Picki's platform account
  // and the remainder (amount - platformFeeAmount) goes to the vendor.
  platformFeeAmount?: number;
}

export interface PaymentResponse {
  id: string;
  status: string;
  url?: string; // For redirect-based payments
  clientSecret?: string; // For Stripe Payment Intents
  provider: 'paygreen' | 'stripe';
}

export interface PaymentStrategy {
  readonly name: string;
  readonly provider: 'paygreen' | 'stripe';

  /**
   * Create a payment session
   * @param request Payment request data
   * @returns Observable with payment response
   */
  createPayment(request: PaymentRequest): Observable<PaymentResponse>;

  /**
   * Convert amount to the provider's expected format
   * @param amount Amount in euros
   * @returns Converted amount
   */
  convertAmount(amount: number): number;

  /**
   * Check if the strategy is available/configured
   * @returns True if strategy can be used
   */
  isAvailable(): boolean;
}
