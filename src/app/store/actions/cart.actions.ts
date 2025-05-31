import { createAction, props } from '@ngrx/store';
import { Product } from '../../services/product.service';

export const addToCart = createAction(
  '[Cart] Add To Cart',
  props<{ product: Product; quantity: number }>()
);

export const incrementCartItem = createAction(
  '[Cart] Increment Cart Item',
  props<{ productId: number }>()
);

export const decrementCartItem = createAction(
  '[Cart] Decrement Cart Item',
  props<{ productId: number }>()
);

export const removeCartItem = createAction(
  '[Cart] Remove Cart Item',
  props<{ productId: number }>()
);

export const clearCart = createAction('[Cart] Clear Cart');
