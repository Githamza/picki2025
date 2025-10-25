import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  PaymentStrategy,
  PaymentRequest,
  PaymentResponse,
} from '../payment-strategy.interface';
import { PayGreenPaymentOrderRequest } from '../paygreen.types';
import { PaygreenBackendService } from '../paygreen-backend.service';

@Injectable({
  providedIn: 'root',
})
export class PaygreenPaymentStrategy implements PaymentStrategy {
  readonly name = 'PayGreen';
  readonly provider = 'paygreen' as const;

  constructor(private paygreenBackend: PaygreenBackendService) {}

  createPayment(request: PaymentRequest): Observable<PaymentResponse> {
    // Use the amount directly from the request (already calculated)
    const totalAmount = request.amount;

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
      amount: this.convertAmount(totalAmount), // Use the provided amount
      return_url: returnUrl,
      reference: request.reference, // Include order reference
    };

    if (!request.vendorId) {
      throw new Error('vendorId is required for PayGreen payments');
    }
    return this.paygreenBackend
      .createPaymentOrder(request.vendorId, paymentOrderRequest)
      .pipe(
        map((response) => ({
          id: response.data.id,
          status: response.data.status,
          url: response.data.hosted_payment_url + '?lang=fr', // Use the hosted payment URL from PayGreen
          provider: this.provider,
        }))
      );
  }

  convertAmount(amount: number): number {
    return this.paygreenBackend.convertToCents(amount);
  }

  isAvailable(): boolean {
    // Check if PayGreen is properly configured
    // You can add environment variable checks here
    return true;
  }
}
