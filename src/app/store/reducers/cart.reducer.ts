import { createReducer, on } from '@ngrx/store';
import {
  addToCart,
  incrementCartItem,
  decrementCartItem,
  removeCartItem,
  clearCart,
} from '../actions/cart.actions';
import { CartState } from '../models/app.state';

const initialState: CartState = {
  items: [],
};

export const cartReducer = createReducer(
  initialState,
  on(
    addToCart,
    (
      state,
      { product, quantity, comment, selectedComplements, totalPrice, metadata }
    ) => {
      // Helper function to compare complement selections
      const areComplementsEqual = (comp1?: any[], comp2?: any[]) => {
        if (!comp1 && !comp2) return true;
        if (!comp1 || !comp2) return false;
        if (comp1.length !== comp2.length) return false;

        return comp1.every((c1) =>
          comp2.some(
            (c2) =>
              c1.complement_product_id === c2.complement_product_id &&
              c1.quantity === c2.quantity
          )
        );
      };

      // Helper function to compare metadata (for multi-step products)
      const areMetadataEqual = (meta1?: any, meta2?: any) => {
        if (!meta1 && !meta2) return true;
        if (!meta1 || !meta2) return false;
        return JSON.stringify(meta1) === JSON.stringify(meta2);
      };

      const existingItem = state.items.find(
        (item) =>
          item.product.id === product.id &&
          item.comment === comment &&
          areComplementsEqual(item.selectedComplements, selectedComplements) &&
          areMetadataEqual(item.metadata, metadata)
      );

      if (existingItem) {
        return {
          ...state,
          items: state.items.map((item) =>
            item.product.id === product.id &&
            item.comment === comment &&
            areComplementsEqual(item.selectedComplements, selectedComplements) &&
            areMetadataEqual(item.metadata, metadata)
              ? {
                  ...item,
                  quantity: item.quantity + quantity,
                  // For multi-step products, scale the totalPrice proportionally
                  totalPrice:
                    item.totalPrice && totalPrice
                      ? item.totalPrice + totalPrice * quantity
                      : item.totalPrice,
                }
              : item
          ),
        };
      } else {
        return {
          ...state,
          items: [
            ...state.items,
            { product, quantity, comment, selectedComplements, totalPrice, metadata },
          ],
        };
      }
    }
  ),
  on(incrementCartItem, (state, { productId }) => ({
    ...state,
    items: state.items.map((item) =>
      item.product.id === productId
        ? {
            ...item,
            quantity: item.quantity + 1,
            // Scale totalPrice for multi-step products
            totalPrice: item.totalPrice
              ? item.totalPrice * ((item.quantity + 1) / item.quantity)
              : undefined,
          }
        : item
    ),
  })),
  on(decrementCartItem, (state, { productId }) => ({
    ...state,
    items: state.items
      .map((item) =>
        item.product.id === productId && item.quantity > 1
          ? {
              ...item,
              quantity: item.quantity - 1,
              // Scale totalPrice for multi-step products
              totalPrice: item.totalPrice
                ? item.totalPrice * ((item.quantity - 1) / item.quantity)
                : undefined,
            }
          : item
      )
      .filter((item) => item.quantity > 0),
  })),
  on(removeCartItem, (state, { productId }) => ({
    ...state,
    items: state.items.filter((item) => item.product.id !== productId),
  })),
  on(clearCart, () => initialState)
);
