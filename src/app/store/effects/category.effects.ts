import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import {
  catchError,
  map,
  switchMap,
  tap,
  exhaustMap,
  withLatestFrom,
  filter,
} from 'rxjs/operators';
import * as CategoryActions from '../actions/category.actions';
import { CategoryService, Category } from '../../services/category.service';
import { VendorService } from '../../services/vendor.service';
import { ImageCacheService } from '../../services/image-cache.service';
import {
  selectCategoriesLoadedAt,
  selectCategoriesLoadedVendorId,
} from '../selectors/category.selectors';

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class CategoryEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private categoryService = inject(CategoryService);
  private vendorService = inject(VendorService);
  private imageCacheService = inject(ImageCacheService);

  loadCategories$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CategoryActions.loadCategories),
      withLatestFrom(
        this.vendorService.currentVendor$,
        this.store.select(selectCategoriesLoadedAt),
        this.store.select(selectCategoriesLoadedVendorId)
      ),
      filter(([action, currentVendor, loadedAt, loadedVendorId]) => {
        const vendorId = action.vendorId || currentVendor?.id;
        // Skip if same vendor was loaded recently (within cache duration)
        if (loadedAt && loadedVendorId === vendorId) {
          const timeSinceLoad = Date.now() - loadedAt;
          if (timeSinceLoad < CACHE_DURATION_MS) {
            console.log(
              `Skipping categories reload - cached ${Math.round(timeSinceLoad / 1000)}s ago`
            );
            return false;
          }
        }
        return true;
      }),
      tap(([action, currentVendor]) => {
        const vendorId = action.vendorId || currentVendor?.id;
        console.log('Loading categories for vendor:', vendorId);
      }),
      exhaustMap(([action, currentVendor]) => {
        const vendorId = action.vendorId || currentVendor?.id;

        // If we have a vendor ID, load vendor-specific categories
        if (vendorId) {
          return this.categoryService.getCategoriesByVendor(vendorId).pipe(
            tap((categories: Category[]) => {
              // Preload category images in background
              const imageUrls = categories
                .map((c) => c.imageUrl)
                .filter((url): url is string => !!url);
              this.imageCacheService.preloadImages(imageUrls, 4);
            }),
            map((categories: Category[]) =>
              CategoryActions.loadCategoriesSuccess({ categories, vendorId })
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
          tap((categories: Category[]) => {
            // Preload category images in background
            const imageUrls = categories
              .map((c) => c.imageUrl)
              .filter((url): url is string => !!url);
            this.imageCacheService.preloadImages(imageUrls, 4);
          }),
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
      withLatestFrom(
        this.store.select(selectCategoriesLoadedAt),
        this.store.select(selectCategoriesLoadedVendorId)
      ),
      filter(([action, loadedAt, loadedVendorId]) => {
        // Skip if same vendor was loaded recently (within cache duration)
        if (loadedAt && loadedVendorId === action.vendorId) {
          const timeSinceLoad = Date.now() - loadedAt;
          if (timeSinceLoad < CACHE_DURATION_MS) {
            console.log(
              `Skipping categories reload - cached ${Math.round(timeSinceLoad / 1000)}s ago`
            );
            return false;
          }
        }
        return true;
      }),
      tap(([action]) =>
        console.log('Loading categories for vendor:', action.vendorId)
      ),
      switchMap(([action]) =>
        this.categoryService.getCategoriesByVendor(action.vendorId).pipe(
          tap((categories: Category[]) => {
            // Preload category images in background
            const imageUrls = categories
              .map((c) => c.imageUrl)
              .filter((url): url is string => !!url);
            this.imageCacheService.preloadImages(imageUrls, 4);
          }),
          map((categories: Category[]) =>
            CategoryActions.loadCategoriesSuccess({
              categories,
              vendorId: action.vendorId,
            })
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
