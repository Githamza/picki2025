import { createAction, props } from '@ngrx/store';

export const updateBannerTitle = createAction(
  '[Banner] Update Title',
  props<{ title: string }>()
);

export const updateBannerSubtitle = createAction(
  '[Banner] Update Subtitle',
  props<{ subtitle: string }>()
);

export const toggleBannerVisibility = createAction(
  '[Banner] Toggle Visibility'
);

export const setBannerVisibility = createAction(
  '[Banner] Set Visibility',
  props<{ isVisible: boolean }>()
);

export const resetBanner = createAction('[Banner] Reset');
