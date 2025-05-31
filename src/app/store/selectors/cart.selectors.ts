import { createSelector, createFeatureSelector } from '@ngrx/store';
import { CartState } from '../models/app.state';

export const selectCart = createFeatureSelector<CartState>('cart');

export const selectCartItems = createSelector(
  selectCart,
  (state) => state.items
);

export const selectCartTotalCount = createSelector(selectCartItems, (items) =>
  items.reduce((total, item) => total + item.quantity, 0)
);
