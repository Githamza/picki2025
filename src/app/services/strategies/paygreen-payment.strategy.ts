import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  PaymentStrategy,
  PaymentRequest,
  PaymentResponse,
} from '../payment-strategy.interface';
import { PayGreenPaymentOrderRequest } from '../paygreen.types';
import { PaygreenBackendService } from '../paygreen-backend.service';
import { VendorNavigationService } from '../vendor-navigation.service';

@Injectable({
  providedIn: 'root',
})
export class PaygreenPaymentStrategy implements PaymentStrategy {
  readonly name = 'PayGreen';
  readonly provider = 'paygreen' as const;

  constructor(
    private paygreenBackend: PaygreenBackendService,
    private vendorNavigation: VendorNavigationService
  ) {}

  createPayment(request: PaymentRequest): Observable<PaymentResponse> {
    // Use the amount directly from the request (already calculated)
    const totalAmount = request.amount;

    // Generate return URLs if not provided
    const baseUrl = window.location.origin;
    const defaultReturnPath = this.vendorNavigation.getVendorUrl('successPayment');
    const defaultCancelPath = this.vendorNavigation.getVendorUrl('failedPayment');
    const returnUrl = request.returnUrl || `${baseUrl}${defaultReturnPath}`;
    const cancelUrl = request.cancelUrl || `${baseUrl}${defaultCancelPath}`;

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

    // Pass delivery cost for marketplace mode split
    const deliveryAmountMinor = request.metadata?.delivery?.amountMinor as number | undefined;

    const couponInput = request.couponCode
      ? {
          code: request.couponCode,
          subtotal: request.productsSubtotal ?? request.amount,
        }
      : undefined;

    return this.paygreenBackend
      .createPaymentOrder(
        request.vendorId,
        paymentOrderRequest,
        deliveryAmountMinor,
        couponInput
      )
      .pipe(
        map((response) => ({
          id: response.data.id,
          status: response.data.status,
          url: response.data.hosted_payment_url + '?lang=fr', // Use the hosted payment URL from PayGreen
          provider: this.provider,
          couponId: response.coupon_id ?? null,
          couponCode: response.coupon_code ?? null,
          discountAmount: response.discount_amount ?? 0,
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
