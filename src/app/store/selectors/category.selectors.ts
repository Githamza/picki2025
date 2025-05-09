import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AppState, CategoryState, Category } from '../models/app.state';

export const selectCategoryState = createFeatureSelector<
  AppState,
  CategoryState
>('categories');

export const selectAllCategories = createSelector(
  selectCategoryState,
  (state: CategoryState) => state.categories
);

export const selectCategoriesLoading = createSelector(
  selectCategoryState,
  (state: CategoryState) => state.loading
);

export const selectCategoriesError = createSelector(
  selectCategoryState,
  (state: CategoryState) => state.error
);

export const selectSelectedCategoryId = createSelector(
  selectCategoryState,
  (state: CategoryState) => state.selectedCategoryId
);

export const selectSelectedCategory = createSelector(
  selectAllCategories,
  selectSelectedCategoryId,
  (categories: Category[], selectedId: number | null) =>
    categories.find((category) => category.id === selectedId) || null
);
