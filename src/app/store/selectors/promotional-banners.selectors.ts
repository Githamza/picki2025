import { createFeatureSelector, createSelector } from '@ngrx/store';

import { AppState } from '../models/app.state';
import {
  GLOBAL_VENDOR_KEY,
  PromotionalBannersState,
} from '../reducers/promotional-banners.reducer';

export const selectPromotionalBannersState = createFeatureSelector<
  AppState,
  PromotionalBannersState
>('promotionalBanners');

export const selectPromotionalBannersByVendorId = createSelector(
  selectPromotionalBannersState,
  (state) => state.bannersByVendorId
);

export const selectPromotionalBannersLoadingByVendorId = createSelector(
  selectPromotionalBannersState,
  (state) => state.loadingByVendorId
);

export const selectPromotionalBannersErrorByVendorId = createSelector(
  selectPromotionalBannersState,
  (state) => state.errorByVendorId
);

export const selectPromotionalBannersLoadedAtByVendorId = createSelector(
  selectPromotionalBannersState,
  (state) => state.loadedAtByVendorId
);

export const selectPromotionalBannersForVendor = (vendorId?: string) =>
  createSelector(selectPromotionalBannersByVendorId, (bannersByVendorId) => {
    const vendorIdKey = vendorId ?? GLOBAL_VENDOR_KEY;
    return bannersByVendorId[vendorIdKey] ?? [];
  });

export const selectPromotionalBannersLoadingForVendor = (vendorId?: string) =>
  createSelector(
    selectPromotionalBannersLoadingByVendorId,
    (loadingByVendorId) => {
      const vendorIdKey = vendorId ?? GLOBAL_VENDOR_KEY;
      return loadingByVendorId[vendorIdKey] ?? false;
    }
  );

export const selectPromotionalBannersErrorForVendor = (vendorId?: string) =>
  createSelector(selectPromotionalBannersErrorByVendorId, (errorByVendorId) => {
    const vendorIdKey = vendorId ?? GLOBAL_VENDOR_KEY;
    return errorByVendorId[vendorIdKey] ?? null;
  });

export const selectPromotionalBannersLoadedAtForVendor = (vendorId?: string) =>
  createSelector(
    selectPromotionalBannersLoadedAtByVendorId,
    (loadedAtByVendorId) => {
      const vendorIdKey = vendorId ?? GLOBAL_VENDOR_KEY;
      return loadedAtByVendorId[vendorIdKey] ?? null;
    }
  );







