import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import {
  catchError,
  map,
  exhaustMap,
  tap,
  switchMap,
  withLatestFrom,
} from 'rxjs/operators';
import * as ProductActions from '../actions/product.actions';
import { ProductService, Product } from '../../services/product.service';
import { VendorService } from '../../services/vendor.service';

@Injectable()
export class ProductEffects {
  private actions$ = inject(Actions);
  private productService = inject(ProductService);
  private vendorService = inject(VendorService);

  loadProducts$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProductActions.loadProducts),
      withLatestFrom(this.vendorService.currentVendor$),
      tap(([action, currentVendor]) => {
        const vendorId = action.vendorId || currentVendor?.id;
        console.log('Loading products for vendor:', vendorId);
      }),
      exhaustMap(([action, currentVendor]) => {
        const vendorId = action.vendorId || currentVendor?.id;
        return this.productService.getProducts(vendorId).pipe(
          map((products: Product[]) =>
            ProductActions.loadProductsSuccess({ products })
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
      tap((action) =>
        console.log('Loading products for vendor:', action.vendorId)
      ),
      switchMap((action) =>
        this.productService.getProducts(action.vendorId).pipe(
          map((products: Product[]) =>
            ProductActions.loadProductsSuccess({ products })
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
        )
      )
    )
  );
}
