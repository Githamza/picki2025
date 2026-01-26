import { ActionReducerMap, MetaReducer } from '@ngrx/store';
import { AppState } from '../models/app.state';
import { bannerReducer } from './banner.reducer';
import { categoryReducer } from './category.reducer';
import { environment } from '../../../environments/environment';
import { productReducer } from './product.reducer';
import { cartReducer } from './cart.reducer';
import { multiStepProductReducer } from './multi-step-product.reducer';
import { promotionalBannersReducer } from './promotional-banners.reducer';

export const reducers: ActionReducerMap<AppState> = {
  banner: bannerReducer,
  promotionalBanners: promotionalBannersReducer,
  category: categoryReducer,
  product: productReducer,
  multiStepProduct: multiStepProductReducer,
  cart: cartReducer,
  // Add more reducers here as needed
};

export const metaReducers: MetaReducer<AppState>[] = !environment?.production
  ? []
  : [];
