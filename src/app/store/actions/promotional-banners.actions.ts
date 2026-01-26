import { createAction, props } from '@ngrx/store';

import { Tables } from '../../types/supabase.types';

export type PromotionalBanner = Tables<'banners'>;

export const loadPromotionalBanners = createAction(
  '[Promotional Banners] Load',
  props<{ vendorId?: string }>()
);

export const loadPromotionalBannersSuccess = createAction(
  '[Promotional Banners] Load Success',
  props<{ vendorIdKey: string; banners: PromotionalBanner[] }>()
);

export const loadPromotionalBannersFailure = createAction(
  '[Promotional Banners] Load Failure',
  props<{ vendorIdKey: string; error: string }>()
);






