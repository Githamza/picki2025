import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import {
  catchError,
  map,
  switchMap,
  tap,
  exhaustMap,
  withLatestFrom,
} from 'rxjs/operators';
import * as CategoryActions from '../actions/category.actions';
import { CategoryService, Category } from '../../services/category.service';
import { VendorService } from '../../services/vendor.service';

@Injectable()
export class CategoryEffects {
  private actions$ = inject(Actions);
  private categoryService = inject(CategoryService);
  private vendorService = inject(VendorService);

  loadCategories$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CategoryActions.loadCategories),
      withLatestFrom(this.vendorService.currentVendor$),
      tap(([action, currentVendor]) => {
        const vendorId = action.vendorId || currentVendor?.id;
        console.log('Loading categories for vendor:', vendorId);
      }),
      exhaustMap(([action, currentVendor]) => {
        const vendorId = action.vendorId || currentVendor?.id;

        // If we have a vendor ID, load vendor-specific categories
        if (vendorId) {
          return this.categoryService.getCategoriesByVendor(vendorId).pipe(
            map((categories: Category[]) =>
              CategoryActions.loadCategoriesSuccess({ categories })
            ),
            catchError((error) => {
              console.error('Error loading vendor categories:', error);
              const errorMessage =
                error.message ||
                'Failed to load vendor categories. Please try again.';
              return of(
                CategoryActions.loadCategoriesFailure({
                  error: errorMessage,
                })
              );
            })
          );
        }

        // Otherwise, load all categories
        return this.categoryService.getCategories().pipe(
          map((categories: Category[]) =>
            CategoryActions.loadCategoriesSuccess({ categories })
          ),
          catchError((error) => {
            console.error('Error loading categories:', error);
            const errorMessage =
              error.message || 'Failed to load categories. Please try again.';
            return of(
              CategoryActions.loadCategoriesFailure({
                error: errorMessage,
              })
            );
          })
        );
      })
    )
  );

  loadCategoriesByVendor$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CategoryActions.loadCategoriesByVendor),
      tap((action) =>
        console.log('Loading categories for vendor:', action.vendorId)
      ),
      switchMap((action) =>
        this.categoryService.getCategoriesByVendor(action.vendorId).pipe(
          map((categories: Category[]) =>
            CategoryActions.loadCategoriesSuccess({ categories })
          ),
          catchError((error) => {
            console.error('Error loading vendor categories:', error);
            const errorMessage =
              error.message ||
              'Failed to load vendor categories. Please try again.';
            return of(
              CategoryActions.loadCategoriesFailure({
                error: errorMessage,
              })
            );
          })
        )
      )
    )
  );

  // Example of a non-dispatching effect that runs after successful category loading
  logCategoryChanges$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          CategoryActions.loadCategoriesSuccess,
          CategoryActions.selectCategory
        ),
        tap((action) => {
          if (action.type === CategoryActions.loadCategoriesSuccess.type) {
            console.log('Categories loaded successfully via service');
          } else if (action.type === CategoryActions.selectCategory.type) {
            console.log(`Category selected action dispatched: ${action.type}`);
          }
        })
      ),
    { dispatch: false }
  );
}
