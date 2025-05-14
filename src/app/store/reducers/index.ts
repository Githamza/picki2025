import { ActionReducerMap, MetaReducer } from '@ngrx/store';
import { AppState } from '../models/app.state';
import { bannerReducer } from './banner.reducer';
import { categoryReducer } from './category.reducer';
import { environment } from '../../../environments/environment';
import { productReducer } from './product.reducer';

export const reducers: ActionReducerMap<AppState> = {
  banner: bannerReducer,
  category: categoryReducer,
  product: productReducer,
  // Add more reducers here as needed
};

export const metaReducers: MetaReducer<AppState>[] = !environment?.production
  ? []
  : [];
