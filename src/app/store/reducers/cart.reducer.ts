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
  on(addToCart, (state, { product, quantity }) => {
    const existingItem = state.items.find(
      (item) => item.product.id === product.id
    );
    if (existingItem) {
      return {
        ...state,
        items: state.items.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        ),
      };
    } else {
      return {
        ...state,
        items: [...state.items, { product, quantity }],
      };
    }
  }),
  on(incrementCartItem, (state, { productId }) => ({
    ...state,
    items: state.items.map((item) =>
      item.product.id === productId
        ? { ...item, quantity: item.quantity + 1 }
        : item
    ),
  })),
  on(decrementCartItem, (state, { productId }) => ({
    ...state,
    items: state.items
      .map((item) =>
        item.product.id === productId && item.quantity > 1
          ? { ...item, quantity: item.quantity - 1 }
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
