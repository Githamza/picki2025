import { createAction, props } from '@ngrx/store';
import { Product } from '../../services/product.service'; // Assuming Product interface is here

// Load products
export const loadProducts = createAction(
  '[Product] Load Products',
  props<{ vendorId?: string }>()
);

export const loadProductsSuccess = createAction(
  '[Product] Load Products Success',
  props<{ products: Product[]; vendorId?: string }>()
);

export const loadProductsFailure = createAction(
  '[Product] Load Products Failure',
  props<{ error: string }>()
);

// Load products by vendor
export const loadProductsByVendor = createAction(
  '[Product] Load Products By Vendor',
  props<{ vendorId: string }>()
);

// Cache hit - data already loaded, skip fetching
export const loadProductsCacheHit = createAction(
  '[Product] Load Products Cache Hit'
);
