import { InjectionToken } from '@angular/core';
import { DeliveryProvider } from './delivery-provider.interface';

// Multi provider token allowing multiple concrete implementations to register
export const DELIVERY_PROVIDERS = new InjectionToken<DeliveryProvider[]>(
  'DELIVERY_PROVIDERS'
);
