import { ActionReducerMap, MetaReducer } from '@ngrx/store';
import { AppState } from '../models/app.state';
import { bannerReducer } from './banner.reducer';
import { categoryReducer } from './category.reducer';
import { environment } from '../../../environments/environment';

export const reducers: ActionReducerMap<AppState> = {
  banner: bannerReducer,
  categories: categoryReducer,
  // Add more reducers here as needed
};

export const metaReducers: MetaReducer<AppState>[] = !environment?.production
  ? []
  : [];
