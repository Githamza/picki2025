import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, switchMap, tap, exhaustMap } from 'rxjs/operators';
import * as CategoryActions from '../actions/category.actions';
import { CategoryService, Category } from '../../services/category.service';

@Injectable()
export class CategoryEffects {
  private actions$ = inject(Actions);
  private categoryService = inject(CategoryService);

  loadCategories$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CategoryActions.loadCategories),
      tap(() => console.log('Loading categories via service...')),
      exhaustMap(() =>
        this.categoryService.getCategories().pipe(
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
