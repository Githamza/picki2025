import { createSelector, createFeatureSelector } from '@ngrx/store';
import { CartState } from '../models/app.state';
import { CartMultiStepMetadata } from '../../models/multi-step-product.model';

export const selectCart = createFeatureSelector<CartState>('cart');

export const selectCartItems = createSelector(
  selectCart,
  (state) => state.items
);

export const selectAppliedCoupon = createSelector(
  selectCart,
  (state) => state.coupon
);

export const selectCartTotalCount = createSelector(selectCartItems, (items) =>
  items
    .filter(
      (item) =>
        item.product.id !== -9999 &&
        (item.metadata as any)?.type !== 'delivery_fee' &&
        !item.product.isAccessory
    )
    .reduce((total, item) => total + item.quantity, 0)
);

export const selectFoodItems = createSelector(selectCartItems, (items) =>
  items.filter(
    (item) => item.product.id !== -9999 && !item.product.isAccessory
  )
);

export const selectAccessoryItems = createSelector(selectCartItems, (items) =>
  items.filter((item) => item.product.isAccessory === true)
);

export const selectCartQuantityByProductId = (productId: number) =>
  createSelector(selectCartItems, (items) => {
    let total = 0;
    for (const item of items) {
      // Count direct matches
      if (item.product.id === productId) {
        total += item.quantity;
      }
      // Count products embedded inside multi-step menus
      const metadata = item.metadata as CartMultiStepMetadata | undefined;
      if (metadata?.stepSelections) {
        for (const step of metadata.stepSelections) {
          for (const option of step.selectedOptions) {
            if (option.productId === productId) {
              total += item.quantity;
            }
          }
        }
      }
    }
    return total;
  });

export const selectCartQuantityMap = createSelector(
  selectCartItems,
  (items): Map<number, number> => {
    const map = new Map<number, number>();
    for (const item of items) {
      // Count direct product
      const currentDirect = map.get(item.product.id) || 0;
      map.set(item.product.id, currentDirect + item.quantity);

      // Count products embedded inside multi-step menus
      const metadata = item.metadata as CartMultiStepMetadata | undefined;
      if (metadata?.stepSelections) {
        for (const step of metadata.stepSelections) {
          for (const option of step.selectedOptions) {
            if (option.productId) {
              const current = map.get(option.productId) || 0;
              map.set(option.productId, current + item.quantity);
            }
          }
        }
      }
    }
    return map;
  }
);
