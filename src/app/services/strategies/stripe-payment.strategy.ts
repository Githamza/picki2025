import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  PaymentStrategy,
  PaymentRequest,
  PaymentResponse,
} from '../payment-strategy.interface';
import { StripeService, StripeCheckoutCreateRequest } from '../stripe.service';
import { VendorNavigationService } from '../vendor-navigation.service';

@Injectable({
  providedIn: 'root',
})
export class StripePaymentStrategy implements PaymentStrategy {
  readonly name = 'Stripe';
  readonly provider = 'stripe' as const;

  constructor(
    private stripeService: StripeService,
    private vendorNavigation: VendorNavigationService
  ) {}

  createPayment(request: PaymentRequest): Observable<PaymentResponse> {
    if (!request.vendorId) {
      throw new Error('vendorId is required for Stripe payments');
    }

    const baseUrl = window.location.origin;

    // Use provided URLs or fall back to defaults
    const defaultSuccessPath =
      this.vendorNavigation.getVendorUrl('successPayment');
    const defaultCancelPath = this.vendorNavigation.getVendorUrl('failedPayment');
    const successUrl =
      request.returnUrl ||
      `${baseUrl}${defaultSuccessPath}?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = request.cancelUrl || `${baseUrl}${defaultCancelPath}`;

    const stripeMetadata: Record<string, string> = {
      buyer_first_name: request.buyer.firstName,
      buyer_last_name: request.buyer.lastName,
      buyer_phone: request.buyer.phone || '',
      ...(request.reference ? { orderId: request.reference } : {}),
    };

    // Only include string-ish primitive metadata; Stripe metadata must be flat strings.
    const raw = request.metadata as unknown;
    if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (!k) continue;
        if (v === null || v === undefined) continue;
        const value =
          typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
            ? String(v)
            : undefined;
        if (value !== undefined) stripeMetadata[k] = value;
      }
    }

    const checkoutRequest: StripeCheckoutCreateRequest = {
      vendorId: request.vendorId,
      currency: request.currency,
      items: request.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
      success_url: successUrl.includes('{CHECKOUT_SESSION_ID}')
        ? successUrl
        : `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      customer_email: request.buyer.email,
      metadata: stripeMetadata,
      // Convert platform fee from major units (euros) to cents for Stripe
      applicationFeeAmountCents:
        request.platformFeeAmount && request.platformFeeAmount > 0
          ? Math.round(request.platformFeeAmount * 100)
          : 0,
    };

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
