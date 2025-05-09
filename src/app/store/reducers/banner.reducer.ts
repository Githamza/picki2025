import { createReducer, on } from '@ngrx/store';
import { BannerState } from '../models/app.state';
import * as BannerActions from '../actions/banner.actions';

export const initialBannerState: BannerState = {
  title: 'Welcome to Our Application',
  subtitle: 'This is a 300px height banner component',
  isVisible: true,
};

export const bannerReducer = createReducer(
  initialBannerState,
  on(BannerActions.updateBannerTitle, (state, { title }) => ({
    ...state,
    title,
  })),
  on(BannerActions.updateBannerSubtitle, (state, { subtitle }) => ({
    ...state,
    subtitle,
  })),
  on(BannerActions.toggleBannerVisibility, (state) => ({
    ...state,
    isVisible: !state.isVisible,
  })),
  on(BannerActions.setBannerVisibility, (state, { isVisible }) => ({
    ...state,
    isVisible,
  })),
  on(BannerActions.resetBanner, () => initialBannerState)
);
