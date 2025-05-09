import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AppState, BannerState } from '../models/app.state';

export const selectBannerState = createFeatureSelector<AppState, BannerState>(
  'banner'
);

export const selectBannerTitle = createSelector(
  selectBannerState,
  (state: BannerState) => state.title
);

export const selectBannerSubtitle = createSelector(
  selectBannerState,
  (state: BannerState) => state.subtitle
);

export const selectBannerVisibility = createSelector(
  selectBannerState,
  (state: BannerState) => state.isVisible
);
