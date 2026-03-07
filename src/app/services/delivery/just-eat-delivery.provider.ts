import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DeliveryProvider } from './delivery-provider.interface';
import {
  CancellationResult,
  CreateDeliveryResult,
  DeliveryQuote,
  DeliveryRequest,
  DeliveryStatus,
} from './delivery.types';
import { normalizeCurrencyCode } from './delivery.util';
import { environment } from '../../../environments/environment';
import { VendorService } from '../vendor.service';

// Just Eat DaaS response from the estimate (quote) edge function call
interface JustEatQuoteResponse {
  totalAmountMinor: number;
  currency: string;
  etaMinutes?: number;
  raw?: {
    requestId?: string;
    dynamicDeliveryFee?: number;
    dynamicDeliveryFeeRule?: string;
    estimatedEarliestCollectTime?: string;
    estimatedEarliestDeliverTime?: string;
    [key: string]: unknown;
  };
}

// Just Eat DaaS response from the create (delivery) edge function call
interface JustEatCreateResponse {
  deliveryId: string;
  jobId: null;
  trackingUrl: string | null;
  raw?: unknown;
}

// Just Eat DaaS response from the status edge function call
interface JustEatStatusResponse {
  status: string;
  updatedAtIso: string;
  trackingUrl?: string | null;
  raw?: unknown;
}

// Just Eat DaaS response from the cancel edge function call
interface JustEatCancelResponse {
  cancelled: boolean;
  message?: string;
  raw?: unknown;
}

@Injectable()
export class JustEatDeliveryProvider implements DeliveryProvider {
  readonly id = 'just-eat';
  readonly name = 'Just Eat';

  private readonly http = inject(HttpClient);
  private readonly vendorService = inject(VendorService);

  private get edgeFnHeaders() {
    return {
      'Content-Type': 'application/json',
      apikey: environment.supabase.anonKey,
      Authorization: `Bearer ${environment.supabase.anonKey}`,
    };
  }

  async getQuote(request: DeliveryRequest): Promise<DeliveryQuote | null> {
    try {
      const res = (await this.http
        .post<JustEatQuoteResponse>(
          `${environment.backendUrl}/functions/v1/just-eat-delivery`,
          {
            action: 'quote',
            vendorId: request.vendorId,
            dropoff: {
              address: request.dropoff.address,
              contact: request.dropoff.contact
                ? {
                    name: request.dropoff.contact.name,
                    phone: request.dropoff.contact.phone,
                    email: request.dropoff.contact.email,
                  }
                : undefined,
              coordinates: request.dropoff.address.coordinates,
            },
          },
          { headers: this.edgeFnHeaders }
        )
        .toPromise()) as JustEatQuoteResponse | undefined;

      if (!res) return null;

      const totalAmountMinor = Number(res.totalAmountMinor ?? 0);
      const currency = normalizeCurrencyCode(
        res.currency ?? this.vendorService.getCurrentCurrency()
      );

      return {
        providerId: this.id,
        providerName: this.name,
        totalAmount: totalAmountMinor,
        currency,
        etaMinutes: res.etaMinutes,
        serviceLevel: request.serviceLevel ?? 'instant',
        // raw contains requestId — critical for the create step
        raw: res.raw,
      };
    } catch (error) {
      console.error('[JustEat] getQuote error:', error);
      return null;
    }
  }

  async createDelivery(
    request: DeliveryRequest,
    priorQuote?: DeliveryQuote
  ): Promise<CreateDeliveryResult> {
    // The requestId from the estimate step is the required identifier for dispatch.
    // It lives in priorQuote.raw.requestId.
    const requestId = (priorQuote?.raw as any)?.requestId;
    if (!requestId) {
      throw new Error(
        '[JustEat] Cannot create delivery without a prior quote requestId. ' +
          'Call getQuote() first and pass the result to createDelivery().'
      );
    }

    const res = (await this.http
      .post<JustEatCreateResponse>(
        `${environment.backendUrl}/functions/v1/just-eat-delivery`,
        {
          action: 'create',
          requestId,
          vendorId: request.vendorId,
          // vendorOrderId and orderValue are populated by orders-manager at dispatch time
        },
        { headers: this.edgeFnHeaders }
      )
      .toPromise()) as JustEatCreateResponse;

    return {
      providerId: this.id,
      providerName: this.name,
      jobId: undefined,
      deliveryId: res.deliveryId,
      trackingUrl: res.trackingUrl ?? undefined,
      raw: res.raw,
    };
  }

  async getStatus(deliveryId: string): Promise<DeliveryStatus> {
    try {
      const res = (await this.http
        .post<JustEatStatusResponse>(
          `${environment.backendUrl}/functions/v1/just-eat-delivery`,
          {
            action: 'status',
            deliveryId,
          },
          { headers: this.edgeFnHeaders }
        )
        .toPromise()) as JustEatStatusResponse;

      return {
        providerId: this.id,
        deliveryId,
        status: (res.status as any) ?? 'created',
        updatedAtIso: res.updatedAtIso ?? new Date().toISOString(),
        raw: res.raw,
      };
    } catch (error) {
      console.error('[JustEat] getStatus error:', error);
      return {
        providerId: this.id,
        deliveryId,
        status: 'created',
        updatedAtIso: new Date().toISOString(),
        raw: {},
      };
    }
  }

  async cancelDelivery(
    deliveryId: string,
    reason?: string
  ): Promise<CancellationResult> {
    try {
      const res = (await this.http
        .post<JustEatCancelResponse>(
          `${environment.backendUrl}/functions/v1/just-eat-delivery`,
          {
            action: 'cancel',
            deliveryId,
          },
          { headers: this.edgeFnHeaders }
        )
        .toPromise()) as JustEatCancelResponse;

      return {
        providerId: this.id,
        deliveryId,
        cancelled: res.cancelled ?? true,
        raw: { ...(res.raw as Record<string, unknown>), reason },
      };
    } catch (error) {
      console.error('[JustEat] cancelDelivery error:', error);
      return {
        providerId: this.id,
        deliveryId,
        cancelled: true,
        raw: { reason },
      };
    }
  }
}
