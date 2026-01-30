import { createFeatureSelector, createSelector } from '@ngrx/store';
import { ProductState } from '../reducers/product.reducer';

export const selectProductState =
  createFeatureSelector<ProductState>('product');

export const selectAllProducts = createSelector(
  selectProductState,
  (state: ProductState) => state.products
);

export const selectProductsLoading = createSelector(
  selectProductState,
  (state: ProductState) => state.loading
);

export const selectProductsError = createSelector(
  selectProductState,
  (state: ProductState) => state.error
);

export const selectProductsLoadedAt = createSelector(
  selectProductState,
  (state: ProductState) => state.loadedAt
);

export const selectProductsLoadedVendorId = createSelector(
  selectProductState,
  (state: ProductState) => state.loadedVendorId
);

// Vendor-filtered selectors
export const selectProductsByVendor = (vendorId: string) =>
  createSelector(selectAllProducts, (products) =>
    products.filter((product) => product.vendorId === vendorId)
  );

// Get products for a specific category
export const selectProductsByCategory = (categoryId: number) =>
  createSelector(selectAllProducts, (products) =>
    products.filter((product) => product.categoryId === categoryId)
  );

// Get products for a specific vendor and category
export const selectProductsByVendorAndCategory = (
  vendorId: string,
  categoryId: number
) =>
  createSelector(selectAllProducts, (products) =>
    products.filter(
      (product) =>
        product.vendorId === vendorId && product.categoryId === categoryId
    )
  );
