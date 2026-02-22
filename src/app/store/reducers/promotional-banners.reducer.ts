import { createReducer, on } from '@ngrx/store';

import * as PromotionalBannersActions from '../actions/promotional-banners.actions';

export const GLOBAL_VENDOR_KEY = '__global__';

export interface PromotionalBannersState {
  bannersByVendorId: Record<string, PromotionalBannersActions.PromotionalBanner[]>;
  loadingByVendorId: Record<string, boolean>;
  errorByVendorId: Record<string, string | null>;
  loadedAtByVendorId: Record<string, number | null>;
}

export const initialPromotionalBannersState: PromotionalBannersState = {
  bannersByVendorId: {},
  loadingByVendorId: {},
  errorByVendorId: {},
  loadedAtByVendorId: {},
};

export const promotionalBannersReducer = createReducer(
  initialPromotionalBannersState,
  on(PromotionalBannersActions.loadPromotionalBanners, (state, { vendorId }) => {
    const vendorIdKey = vendorId ?? GLOBAL_VENDOR_KEY;
    return {
      ...state,
      loadingByVendorId: {
        ...state.loadingByVendorId,
        [vendorIdKey]: true,
      },
      errorByVendorId: {
        ...state.errorByVendorId,
        [vendorIdKey]: null,
      },
    };
  }),
  on(
    PromotionalBannersActions.loadPromotionalBannersSuccess,
    (state, { vendorIdKey, banners }) => ({
      ...state,
      bannersByVendorId: {
        ...state.bannersByVendorId,
        [vendorIdKey]: banners,
      },
      loadingByVendorId: {
        ...state.loadingByVendorId,
        [vendorIdKey]: false,
      },
      errorByVendorId: {
        ...state.errorByVendorId,
        [vendorIdKey]: null,
      },
      loadedAtByVendorId: {
        ...state.loadedAtByVendorId,
        [vendorIdKey]: Date.now(),
      },
    })
  ),
  on(
    PromotionalBannersActions.loadPromotionalBannersFailure,
    (state, { vendorIdKey, error }) => ({
      ...state,
      loadingByVendorId: {
        ...state.loadingByVendorId,
        [vendorIdKey]: false,
      },
      errorByVendorId: {
        ...state.errorByVendorId,
        [vendorIdKey]: error,
      },
    })
  )
);







