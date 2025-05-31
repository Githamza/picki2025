import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  PaymentStrategy,
  PaymentRequest,
  PaymentResponse,
} from '../payment-strategy.interface';
import {
  PaygreenService,
  PayGreenPaymentOrderRequest,
} from '../paygreen.service';

@Injectable({
  providedIn: 'root',
})
export class PaygreenPaymentStrategy implements PaymentStrategy {
  readonly name = 'PayGreen';
  readonly provider = 'paygreen' as const;

  constructor(private paygreenService: PaygreenService) {}

  createPayment(request: PaymentRequest): Observable<PaymentResponse> {
    // Calculate total amount from items
    const totalAmount = request.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // Generate return URLs if not provided
    const baseUrl = window.location.origin;
    const returnUrl = request.returnUrl || `${baseUrl}/successPayment`;
    const cancelUrl = request.cancelUrl || `${baseUrl}/failedPayment`;

    const paymentOrderRequest: PayGreenPaymentOrderRequest = {
      ttl: 600, // 10 minutes
      auto_capture: false,
      buyer: {
        object: 'buyer',
        email: request.buyer.email,
        firstName: request.buyer.firstName,
        lastName: request.buyer.lastName,
        phone: request.buyer.phone,
      },
      currency: request.currency.toLowerCase(),
      merchant_initiated: false,
      mode: 'instant',
      partial_allowed: false,
      plbs: false,
      amount: this.convertAmount(totalAmount), // Use calculated total
      return_url: returnUrl,
      reference: request.reference, // Include order reference
    };

    return this.paygreenService.createPaymentOrder(paymentOrderRequest).pipe(
      map((response) => ({
        id: response.data.id,
        status: response.data.status,
        url: response.data.hosted_payment_url, // Use the hosted payment URL from PayGreen
        provider: this.provider,
      }))
    );
  }

  convertAmount(amount: number): number {
    return this.paygreenService.convertToCents(amount);
  }

  isAvailable(): boolean {
    // Check if PayGreen is properly configured
    // You can add environment variable checks here
    return true;
  }
}
