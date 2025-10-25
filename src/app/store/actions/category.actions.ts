import { createAction, props } from '@ngrx/store';
import { Category } from '../models/app.state';

// Load categories
export const loadCategories = createAction(
  '[Category] Load Categories',
  props<{ vendorId?: string }>()
);

export const loadCategoriesSuccess = createAction(
  '[Category] Load Categories Success',
  props<{ categories: Category[] }>()
);

export const loadCategoriesFailure = createAction(
  '[Category] Load Categories Failure',
  props<{ error: string }>()
);

// Load categories by vendor
export const loadCategoriesByVendor = createAction(
  '[Category] Load Categories By Vendor',
  props<{ vendorId: string }>()
);

// Select category
export const selectCategory = createAction(
  '[Category] Select Category',
  props<{ categoryId: number }>()
);

// Add mock categories (for demo purposes)
export const addMockCategories = createAction('[Category] Add Mock Categories');
