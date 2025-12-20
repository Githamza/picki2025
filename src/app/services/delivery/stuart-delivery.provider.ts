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
import {
  computeDistanceKm,
  estimateEtaMinutes,
  normalizeCurrencyCode,
  deriveEtaMinutesFromRaw,
} from './delivery.util';
import { environment } from '../../../environments/environment';
import { VendorService } from '../vendor.service';

@Injectable()
export class StuartDeliveryProvider implements DeliveryProvider {
  readonly id = 'stuart';
  readonly name = 'Stuart';

  private readonly http = inject(HttpClient);
  private readonly vendorService = inject(VendorService);

  async getQuote(request: DeliveryRequest): Promise<DeliveryQuote | null> {
    try {
      const res = await this.http
        .post(
          `${environment.backendUrl}/functions/v1/stuart-delivery`,
          {
            action: 'quote',
            pickup: { address: request.pickup.address },
            dropoff: { address: request.dropoff.address },
          },
          {
            headers: {
              'Content-Type': 'application/json',
              apikey: environment.supabase.anonKey,
              Authorization: `Bearer ${environment.supabase.anonKey}`,
            },
          }
        )
        .toPromise();
      const data = res as any;
      if (!data) return null;
      let totalAmountMinor = Number(data?.totalAmountMinor);
      if (!totalAmountMinor || totalAmountMinor <= 0) {
        const fee = Number(data?.fee ?? data?.raw?.fee);
        if (fee && fee > 0) totalAmountMinor = fee;
      }
      const currency = normalizeCurrencyCode(
        data?.currency ??
          data?.currency_type ??
          data?.raw?.currency_type ??
          data?.raw?.currency ??
          this.vendorService.getCurrentCurrency()
      );
      const etaSource =
        typeof data?.etaMinutes === 'number' && data.etaMinutes > 0
          ? data.etaMinutes
          : undefined;
      const etaMinutes =
        etaSource ?? deriveEtaMinutesFromRaw(data?.raw) ?? undefined;
      return {
        providerId: this.id,
        providerName: this.name,
        totalAmount: totalAmountMinor,
        currency,
        etaMinutes,
        serviceLevel: request.serviceLevel ?? 'instant',
        raw: data.raw,
      };
    } catch (error: any) {
      // Never use fallback quotes - always return null on any error
      console.error('Stuart delivery quote error:', error);
      return null;
    }
  }

  async createDelivery(
    request: DeliveryRequest
  ): Promise<CreateDeliveryResult> {
    try {
      const res = await this.http
        .post(
          `${environment.backendUrl}/functions/v1/stuart-delivery`,
          {
            action: 'create',
            pickup: { address: request.pickup.address },
            dropoff: { address: request.dropoff.address },
            externalOrderId: undefined,
            vendorId: (request as any).vendorId || undefined,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              apikey: environment.supabase.anonKey,
              Authorization: `Bearer ${environment.supabase.anonKey}`,
            },
          }
        )
        .toPromise();
      const data = res as any;
      return {
        providerId: this.id,
        providerName: this.name,
        jobId: data.jobId,
        deliveryId: data.deliveryId,
        trackingUrl: data.trackingUrl,
        raw: data.raw,
      };
    } catch (error: any) {
      console.error('Stuart delivery creation error:', error);
      throw error; // Re-throw the error instead of creating a fallback
    }
  }

  async getStatus(deliveryId: string): Promise<DeliveryStatus> {
    try {
      const res = (await this.http
        .post(
          `${environment.backendUrl}/functions/v1/stuart-delivery`,
          {
            action: 'status',
            pickup: { address: {} },
            dropoff: { address: {} },
            // Call with jobId; fallback to deliveryId for backward compatibility (server handles both)
            jobId: deliveryId as any as string,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              apikey: environment.supabase.anonKey,
              Authorization: `Bearer ${environment.supabase.anonKey}`,
            },
          }
        )
        .toPromise()) as any;
      return {
        providerId: this.id,
        deliveryId,
        status: res.status,
        updatedAtIso: res.updatedAtIso || new Date().toISOString(),
        raw: res.raw,
      };
    } catch {
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
    return {
      providerId: this.id,
      deliveryId,
      cancelled: true,
      refundAmountMinor: 0,
      currency: normalizeCurrencyCode(this.vendorService.getCurrentCurrency()),
      raw: { reason },
    };
  }
}
