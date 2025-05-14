import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, exhaustMap, tap } from 'rxjs/operators';
import * as ProductActions from '../actions/product.actions';
import { ProductService, Product } from '../../services/product.service';

@Injectable()
export class ProductEffects {
  private actions$ = inject(Actions);
  private productService = inject(ProductService);

  loadProducts$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProductActions.loadProducts),
      tap(() => console.log('Loading products via service...')),
      exhaustMap(() =>
        this.productService.getProducts().pipe(
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
        )
      )
    )
  );
}
