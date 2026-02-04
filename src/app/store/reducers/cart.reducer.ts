import { createReducer, on } from '@ngrx/store';
import {
  addToCart,
  incrementCartItem,
  decrementCartItem,
  removeCartItem,
  clearCart,
  upsertDeliveryFee,
  removeDeliveryFee,
} from '../actions/cart.actions';
import { CartState } from '../models/app.state';

const DELIVERY_FEE_PRODUCT_ID = -9999;

const initialState: CartState = {
  items: [],
};

export const cartReducer = createReducer(
  initialState,
  on(
    addToCart,
    (
      state,
      { product, quantity, comment, selectedComplements, totalPrice, metadata, customisationSelections }
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

      // Helper function to compare customisation selections
      const areCustomisationsEqual = (
        custom1?: Map<number, number[]>,
        custom2?: Map<number, number[]>
      ) => {
        if (!custom1 && !custom2) return true;
        if (!custom1 || !custom2) return false;
        if (custom1.size !== custom2.size) return false;

        for (const [key, value] of custom1.entries()) {
          const value2 = custom2.get(key);
          if (!value2) return false;
          if (value.length !== value2.length) return false;
          if (!value.every((v, i) => v === value2[i])) return false;
        }
        return true;
      };

      const existingItem = state.items.find(
        (item) =>
          item.product.id === product.id &&
          item.comment === comment &&
          areComplementsEqual(item.selectedComplements, selectedComplements) &&
          areMetadataEqual(item.metadata, metadata) &&
          areCustomisationsEqual(item.customisationSelections, customisationSelections)
      );

      if (existingItem) {
        return {
          ...state,
          items: state.items.map((item) =>
            item.product.id === product.id &&
            item.comment === comment &&
            areComplementsEqual(item.selectedComplements, selectedComplements) &&
            areMetadataEqual(item.metadata, metadata) &&
            areCustomisationsEqual(item.customisationSelections, customisationSelections)
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
            { product, quantity, comment, selectedComplements, totalPrice, metadata, customisationSelections },
          ],
        };
      }
    }
  ),
  on(incrementCartItem, (state, { productId }) => {
    if (productId === DELIVERY_FEE_PRODUCT_ID) return state;
    return {
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
    };
  }),
  on(decrementCartItem, (state, { productId }) => {
    if (productId === DELIVERY_FEE_PRODUCT_ID) return state;
    return {
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
    };
  }),
  on(removeCartItem, (state, { productId }) => {
    if (productId === DELIVERY_FEE_PRODUCT_ID) return state;
    return {
      ...state,
      items: state.items.filter((item) => item.product.id !== productId),
    };
  }),
  on(upsertDeliveryFee, (state, { amount }) => {
    // If invalid/zero, remove instead.
    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        ...state,
        items: state.items.filter((item) => item.product.id !== DELIVERY_FEE_PRODUCT_ID),
      };
    }

    const feeItemIndex = state.items.findIndex(
      (item) => item.product.id === DELIVERY_FEE_PRODUCT_ID
    );

    const feeItem = {
      product: {
        id: DELIVERY_FEE_PRODUCT_ID,
        name: 'Livraison',
        price: amount,
        tvaRate: 20, // Delivery fees use standard 20% VAT in France
        imageUrl: '',
        categoryId: 0,
        description: '',
        shortDescription: '',
        longDescription: '',
        vendorId: undefined,
        isMultiStep: false,
        displayOrder: 0,
      },
      quantity: 1,
      totalPrice: amount,
      metadata: { type: 'delivery_fee' as const },
    };

    if (feeItemIndex >= 0) {
      const nextItems = [...state.items];
      nextItems[feeItemIndex] = {
        ...nextItems[feeItemIndex],
        ...feeItem,
      };
      return { ...state, items: nextItems };
    }

    return { ...state, items: [...state.items, feeItem as any] };
  }),
  on(removeDeliveryFee, (state) => ({
    ...state,
    items: state.items.filter((item) => item.product.id !== DELIVERY_FEE_PRODUCT_ID),
  })),
  on(clearCart, () => initialState)
);
