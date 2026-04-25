import { createAction, props } from '@ngrx/store';
import { Product } from '../../services/product.service';
import { ComplementSelection } from '../../models/complement.model';
import { AppliedCoupon } from '../../models/coupon.model';

export const addToCart = createAction(
  '[Cart] Add To Cart',
  props<{
    product: Product;
    quantity: number;
    comment?: string;
    selectedComplements?: ComplementSelection[];
    totalPrice?: number; // Add this for multi-step products
    metadata?: any; // Add metadata field for multi-step products
    customisationSelections?: Map<number, number[]>; // Add this for customisations
  }>()
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

export const upsertDeliveryFee = createAction(
  '[Cart] Upsert Delivery Fee',
  props<{
    amount: number;
  }>()
);

export const removeDeliveryFee = createAction('[Cart] Remove Delivery Fee');

export const applyCoupon = createAction(
  '[Cart] Apply Coupon',
  props<{ coupon: AppliedCoupon }>()
);

export const removeCoupon = createAction('[Cart] Remove Coupon');
