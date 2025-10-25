// Core, provider-agnostic delivery domain types

export type CurrencyCode = 'EUR' | 'USD' | 'GBP';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Address {
  line1: string;
  line2?: string;
  postalCode: string;
  city: string;
  countryCode: string; // ISO 3166-1 alpha-2 (e.g., 'FR')
  coordinates?: Coordinates;
}

export interface Contact {
  name: string;
  phone: string;
  email?: string;
  // Optional language code for localized messages (e.g., 'fr', 'en')
  languageCode?: string;
}

export interface DeliveryStop {
  address: Address;
  contact?: Contact;
  notes?: string;
}

export interface PackageDimensionsCm {
  length: number; // cm
  width: number; // cm
  height: number; // cm
}

export interface PackageDetails {
  description?: string;
  weightKg?: number;
  dimensionsCm?: PackageDimensionsCm;
  isFragile?: boolean;
  requiresSignature?: boolean;
  valueAmount?: number;
  valueCurrency?: CurrencyCode;
}

export type DeliveryServiceLevel = 'instant' | 'same_day' | 'scheduled';

export interface DeliveryRequest {
  pickup: DeliveryStop;
  dropoff: DeliveryStop;
  package: PackageDetails;
  serviceLevel?: DeliveryServiceLevel;
  // When service level is 'scheduled', scheduleAt is required
  scheduleAtIso?: string; // ISO 8601 string
  // Optional vendor context to allow provider functions to ensure per-vendor hooks
  vendorId?: string;
}

export interface DeliveryQuote {
  providerId: string; // e.g., 'uber', 'stuart'
  providerName: string; // Human friendly name
  totalAmount: number; // in minor currency units (e.g., cents)
  currency: CurrencyCode;
  etaMinutes?: number; // Estimated time to deliver (from now)
  expiresAtIso?: string; // Quote validity cutoff
  serviceLevel: DeliveryServiceLevel;
  raw?: unknown; // Provider-specific payload for auditing
}

export interface DeliveryComparisonOption extends DeliveryQuote {
  score: number; // Higher is better according to chosen strategy
}

export interface CreateDeliveryResult {
  providerId: string;
  providerName: string;
  // Stuart returns both: jobId (job root id) and deliveryId (deliveries[0].id)
  jobId?: string;
  deliveryId: string; // Provider delivery identifier
  trackingUrl?: string;
  raw?: unknown;
}

export type DeliveryStatusCode =
  | 'created'
  | 'assigned'
  | 'en_route_to_pickup'
  | 'arrived_at_pickup'
  | 'picked_up'
  | 'en_route_to_dropoff'
  | 'delivered'
  | 'cancelled'
  | 'failed';

export interface DeliveryStatus {
  providerId: string;
  deliveryId: string;
  status: DeliveryStatusCode;
  updatedAtIso: string;
  raw?: unknown;
}

export interface CancellationResult {
  providerId: string;
  deliveryId: string;
  cancelled: boolean;
  refundAmountMinor?: number;
  currency?: CurrencyCode;
  raw?: unknown;
}

// Strategy for comparing quotes across providers
export interface DeliveryScoringInput {
  amountMinor: number;
  etaMinutes?: number;
}

export type DeliveryScoringStrategy = (input: DeliveryScoringInput) => number;

export const defaultScoringStrategy: DeliveryScoringStrategy = (input) => {
  // Basic score: prioritize lower cost and faster ETA.
  // Normalize cost and ETA to a simple inverse score.
  const costScore = input.amountMinor > 0 ? 1_000_000 / input.amountMinor : 0;
  const etaScore =
    input.etaMinutes && input.etaMinutes > 0 ? 10_000 / input.etaMinutes : 0;
  return costScore + etaScore;
};
