import {
  ApplicationConfig,
  isDevMode,
  provideZoneChangeDetection,
  LOCALE_ID,
} from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { provideEffects } from '@ngrx/effects';
import { provideNativeDateAdapter } from '@angular/material/core';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';

import { routes } from './app.routes';
import { reducers, metaReducers } from './store/reducers';
import { BannerEffects } from './store/effects/banner.effects';
import { CategoryEffects } from './store/effects/category.effects';
import { ProductEffects } from './store/effects/product.effects';
import { productReducer } from './store/reducers/product.reducer';
import { categoryReducer } from './store/reducers/category.reducer';
import { bannerReducer } from './store/reducers/banner.reducer';
import { cartReducer } from './store/reducers/cart.reducer';

// Register French locale
registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withViewTransitions()),
    provideAnimations(),
    provideHttpClient(),
    provideNativeDateAdapter(),
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    provideStore(reducers, { metaReducers }),
    provideStoreDevtools({
      maxAge: 25, // Retains last 25 states
      logOnly: !isDevMode(), // Restrict extension to log-only mode in production
      autoPause: true, // Pauses recording actions and state changes when the extension window is not open
      trace: false, // If set to true, will include stack trace for every dispatched action
      traceLimit: 75, // maximum stack trace frames to be stored (in case trace option was provided as true)
    }),
    provideEffects([BannerEffects, CategoryEffects, ProductEffects]),
    provideStore({
      product: productReducer,
      category: categoryReducer,
      banner: bannerReducer,
      cart: cartReducer,
    }),
  ],
};
