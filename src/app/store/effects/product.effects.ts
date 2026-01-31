import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import {
  catchError,
  map,
  tap,
  switchMap,
  withLatestFrom,
  mergeMap,
} from 'rxjs/operators';
import * as ProductActions from '../actions/product.actions';
import { ProductService, Product } from '../../services/product.service';
import { VendorService } from '../../services/vendor.service';
import { ImageCacheService } from '../../services/image-cache.service';
import {
  selectProductsLoadedAt,
  selectProductsLoadedVendorId,
} from '../selectors/product.selectors';

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class ProductEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private productService = inject(ProductService);
  private vendorService = inject(VendorService);
  private imageCacheService = inject(ImageCacheService);

  loadProducts$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProductActions.loadProducts),
      withLatestFrom(
        this.vendorService.currentVendor$,
        this.store.select(selectProductsLoadedAt),
        this.store.select(selectProductsLoadedVendorId)
      ),
      mergeMap(([action, currentVendor, loadedAt, loadedVendorId]) => {
        const vendorId = action.vendorId || currentVendor?.id;
        // Skip if same vendor was loaded recently (within cache duration)
        if (loadedAt && loadedVendorId === vendorId) {
          const timeSinceLoad = Date.now() - loadedAt;
          if (timeSinceLoad < CACHE_DURATION_MS) {
            console.log(
              `Skipping products reload - cached ${Math.round(timeSinceLoad / 1000)}s ago`
            );
            return of(ProductActions.loadProductsCacheHit());
          }
        }
        console.log('Loading products for vendor:', vendorId);
        return this.productService.getProducts(vendorId).pipe(
          tap((products: Product[]) => {
            // Preload product images in background
            const imageUrls = products
              .map((p) => p.imageUrl)
              .filter((url): url is string => !!url);
            this.imageCacheService.preloadImages(imageUrls, 4);
          }),
          map((products: Product[]) =>
            ProductActions.loadProductsSuccess({ products, vendorId })
          ),
          catchError((error) => {
            console.error('Error loading products:', error);
            const errorMessage =
              error.message || 'Failed to load products. Please try again.';
            return of(
              ProductActions.loadProductsFailure({
                error: errorMessage,
              })
            );
          })
        );
      })
    )
  );

  loadProductsByVendor$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProductActions.loadProductsByVendor),
      withLatestFrom(
        this.store.select(selectProductsLoadedAt),
        this.store.select(selectProductsLoadedVendorId)
      ),
      switchMap(([action, loadedAt, loadedVendorId]) => {
        // Skip if same vendor was loaded recently (within cache duration)
        if (loadedAt && loadedVendorId === action.vendorId) {
          const timeSinceLoad = Date.now() - loadedAt;
          if (timeSinceLoad < CACHE_DURATION_MS) {
            console.log(
              `Skipping products reload - cached ${Math.round(timeSinceLoad / 1000)}s ago`
            );
            return of(ProductActions.loadProductsCacheHit());
          }
        }
        console.log('Loading products for vendor:', action.vendorId);
        return this.productService.getProducts(action.vendorId).pipe(
          tap((products: Product[]) => {
            // Preload product images in background
            const imageUrls = products
              .map((p) => p.imageUrl)
              .filter((url): url is string => !!url);
            this.imageCacheService.preloadImages(imageUrls, 4);
          }),
          map((products: Product[]) =>
            ProductActions.loadProductsSuccess({
              products,
              vendorId: action.vendorId,
            })
          ),
          catchError((error) => {
            console.error('Error loading vendor products:', error);
            const errorMessage =
              error.message ||
              'Failed to load vendor products. Please try again.';
            return of(
              ProductActions.loadProductsFailure({
                error: errorMessage,
              })
            );
          })
        );
      })
    )
  );
}
