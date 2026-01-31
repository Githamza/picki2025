import { createReducer, on } from '@ngrx/store';
import * as ProductActions from '../actions/product.actions';
import { Product } from '../../services/product.service';

export interface ProductState {
  products: Product[];
  loading: boolean;
  error: string | null;
  loadedAt: number | null;
  loadedVendorId: string | null;
}

export const initialProductState: ProductState = {
  products: [],
  loading: false,
  error: null,
  loadedAt: null,
  loadedVendorId: null,
};

export const productReducer = createReducer(
  initialProductState,
  on(ProductActions.loadProducts, ProductActions.loadProductsByVendor, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(ProductActions.loadProductsSuccess, (state, { products, vendorId }) => ({
    ...state,
    products,
    loading: false,
    loadedAt: Date.now(),
    loadedVendorId: vendorId ?? null,
  })),
  on(ProductActions.loadProductsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(ProductActions.loadProductsCacheHit, (state) => ({
    ...state,
    loading: false,
  }))
);
