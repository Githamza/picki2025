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
export class UberDeliveryProvider implements DeliveryProvider {
  readonly id = 'uber';
  readonly name = 'Uber';

  // Keep for future real API calls
  private readonly http = inject(HttpClient);
  private readonly vendorService = inject(VendorService);

  async getQuote(request: DeliveryRequest): Promise<DeliveryQuote | null> {
    try {
      const res = await this.http
        .post(
          `${environment.backendUrl}/functions/v1/uber-direct-delivery`,
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
      // Handle backend response differences by normalizing fields
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
      console.error('Uber delivery quote error:', error);
      return null;
    }
  }

  async createDelivery(
    request: DeliveryRequest
  ): Promise<CreateDeliveryResult> {
    try {
      const res = await this.http
        .post(
          `${environment.backendUrl}/functions/v1/uber-direct-delivery`,
          {
            action: 'create',
            pickup: {
              address: request.pickup.address,
              contact: request.pickup.contact
                ? {
                    name: request.pickup.contact.name,
                    phone_number: request.pickup.contact.phone,
                  }
                : {
                    name: 'Restaurant',
                    phone_number: '+33123456789', // TODO: Get from vendor settings
                  },
            },
            dropoff: {
              address: request.dropoff.address,
              contact: request.dropoff.contact
                ? {
                    name: request.dropoff.contact.name,
                    phone_number: request.dropoff.contact.phone,
                  }
                : {
                    name: 'Customer',
                    phone_number: '+33987654321', // TODO: Get from order customer
                  },
            },
            manifest_items: [
              {
                name: request.package.description || 'Food Order',
                quantity: 1,
                size: 'medium',
              },
            ],
            // Test specifications are now handled automatically by the edge function
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
        jobId: data.jobId, // Uber may not return a separate job id; keep for typing parity
        deliveryId: data.deliveryId,
        trackingUrl: data.trackingUrl,
        raw: data.raw,
      };
    } catch (error: any) {
      console.error('Uber delivery creation error:', error);
      throw error; // Re-throw the error instead of creating a fallback
    }
  }

  async getStatus(deliveryId: string): Promise<DeliveryStatus> {
    try {
      const res = await this.http
        .post(
          `${environment.backendUrl}/functions/v1/uber-direct-delivery`,
          {
            action: 'status',
            delivery_id: deliveryId,
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

      // Map Uber status to our internal format
      const statusMap: Record<string, string> = {
        pending: 'created',
        pickup: 'en_route_to_pickup',
        pickup_complete: 'picked_up',
        dropoff: 'en_route_to_dropoff',
        delivered: 'delivered',
        canceled: 'cancelled',
        returned: 'cancelled',
      };

      const internalStatus = statusMap[data.status] || 'created';

      return {
        providerId: this.id,
        deliveryId,
        status: internalStatus as any,
        updatedAtIso: new Date().toISOString(),
        raw: data,
      };
    } catch (error) {
      console.error('Error getting Uber delivery status:', error);
      throw error; // Re-throw the error instead of creating a fallback
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
