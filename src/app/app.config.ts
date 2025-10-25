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
import {
  HashLocationStrategy,
  LocationStrategy,
  registerLocaleData,
} from '@angular/common';
import localeFr from '@angular/common/locales/fr';

import { routes } from './app.routes';
import { reducers, metaReducers } from './store/reducers';
import { BannerEffects } from './store/effects/banner.effects';
import { CategoryEffects } from './store/effects/category.effects';
import { ProductEffects } from './store/effects/product.effects';
import { MultiStepProductEffects } from './store/effects/multi-step-product.effects';
import { productReducer } from './store/reducers/product.reducer';
import { categoryReducer } from './store/reducers/category.reducer';
import { bannerReducer } from './store/reducers/banner.reducer';
import { cartReducer } from './store/reducers/cart.reducer';
import { multiStepProductReducer } from './store/reducers/multi-step-product.reducer';
import { DELIVERY_PROVIDERS } from './services/delivery/delivery.tokens';
import { UberDeliveryProvider } from './services/delivery/uber-delivery.provider';
import { StuartDeliveryProvider } from './services/delivery/stuart-delivery.provider';
import { environment } from '../environments/environment';

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
    provideEffects([
      BannerEffects,
      CategoryEffects,
      ProductEffects,
      MultiStepProductEffects,
    ]),
    provideStore({
      product: productReducer,
      category: categoryReducer,
      banner: bannerReducer,
      cart: cartReducer,
      multiStepProduct: multiStepProductReducer,
    }),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: !isDevMode(),
      connectInZone: true,
    }),
    // Conditionally register delivery providers based on env override
    ...(environment.deliveryProviderOverride === 'uber' ||
    environment.deliveryProviderOverride === 'all' ||
    environment.deliveryProviderOverride === 'auto'
      ? [
          {
            provide: DELIVERY_PROVIDERS,
            useClass: UberDeliveryProvider,
            multi: true,
          },
        ]
      : []),
    ...(environment.deliveryProviderOverride === 'stuart' ||
    environment.deliveryProviderOverride === 'all' ||
    environment.deliveryProviderOverride === 'auto'
      ? [
          {
            provide: DELIVERY_PROVIDERS,
            useClass: StuartDeliveryProvider,
            multi: true,
          },
        ]
      : []),
  ],
};
