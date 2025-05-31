import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  PaymentStrategy,
  PaymentRequest,
  PaymentResponse,
} from '../payment-strategy.interface';
import { StripeService, StripeCheckoutRequest } from '../stripe.service';

@Injectable({
  providedIn: 'root',
})
export class StripePaymentStrategy implements PaymentStrategy {
  readonly name = 'Stripe';
  readonly provider = 'stripe' as const;

  constructor(private stripeService: StripeService) {}

  createPayment(request: PaymentRequest): Observable<PaymentResponse> {
    const baseUrl = window.location.origin;

    // Use provided URLs or fall back to defaults
    const successUrl =
      request.returnUrl ||
      `${baseUrl}/successPayment?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = request.cancelUrl || `${baseUrl}/failedPayment`;

    const checkoutRequest: StripeCheckoutRequest = {
      line_items: request.items.map((item) => ({
        price_data: {
          currency: request.currency.toLowerCase(),
          product_data: {
            name: item.name,
          },
          unit_amount: this.convertAmount(item.price),
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: successUrl.includes('{CHECKOUT_SESSION_ID}')
        ? successUrl
        : `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      customer_email: request.buyer.email,
      metadata: {
        buyer_first_name: request.buyer.firstName,
        buyer_last_name: request.buyer.lastName,
        buyer_phone: request.buyer.phone || '',
        vendor_id: request.vendorId || '',
        ...request.metadata,
      },
    };

    // Add marketplace-specific configuration if vendorId is provided
    if (request.vendorId) {
      checkoutRequest.payment_intent_data = {
        transfer_data: {
          destination: request.vendorId, // Connected account ID
        },
        // No application fee as per your requirements
        application_fee_amount: 0,
      };
    }

    return this.stripeService.createCheckoutSession(checkoutRequest).pipe(
      map((session) => ({
        id: session.id,
        status: session.status,
        url: session.url,
        provider: this.provider,
      }))
    );
  }

  convertAmount(amount: number): number {
    return this.stripeService.convertToCents(amount);
  }

  isAvailable(): boolean {
    return this.stripeService.isConfigured();
  }
}
