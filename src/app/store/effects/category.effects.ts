import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import * as CategoryActions from '../actions/category.actions';

@Injectable()
export class CategoryEffects {
  // For a real app, this would call a service to fetch categories from an API
  // For now, we'll simulate a successful API call with mock data
  loadCategories$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CategoryActions.loadCategories),
      tap(() => console.log('Loading categories...')),
      // Simulate API call delay and success
      switchMap(() =>
        // We use addMockCategories instead of loadCategoriesSuccess to reuse our mock data
        of(CategoryActions.addMockCategories())
      )
    )
  );

  constructor(private actions$: Actions) {}
}
