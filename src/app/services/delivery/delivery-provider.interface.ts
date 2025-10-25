import {
  CancellationResult,
  CreateDeliveryResult,
  DeliveryQuote,
  DeliveryRequest,
  DeliveryStatus,
} from './delivery.types';

export interface DeliveryProvider {
  readonly id: string; // machine id, e.g., 'uber', 'stuart'
  readonly name: string; // human friendly name

  // Return a quote for a delivery request. Return null if the provider cannot serve the request.
  getQuote(request: DeliveryRequest): Promise<DeliveryQuote | null>;

  // Create a delivery based on a request (and optionally a previously obtained quote)
  createDelivery(
    request: DeliveryRequest,
    priorQuote?: DeliveryQuote
  ): Promise<CreateDeliveryResult>;

  // Fetch current status for a delivery
  getStatus(deliveryId: string): Promise<DeliveryStatus>;

  // Attempt to cancel a delivery
  cancelDelivery(
    deliveryId: string,
    reason?: string
  ): Promise<CancellationResult>;
}
