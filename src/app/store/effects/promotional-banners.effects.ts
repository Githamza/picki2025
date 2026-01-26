import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, filter, from, map, of, switchMap } from 'rxjs';
import { take } from 'rxjs/operators';

import { SupabaseAuthService } from '../../services/supabase-auth.service';
import { AppState } from '../models/app.state';
import * as PromotionalBannersActions from '../actions/promotional-banners.actions';
import { GLOBAL_VENDOR_KEY } from '../reducers/promotional-banners.reducer';
import * as PromotionalBannersSelectors from '../selectors/promotional-banners.selectors';

@Injectable()
export class PromotionalBannersEffects {
  private actions$ = inject(Actions);
  private store = inject(Store<AppState>);
  private supabaseAuthService = inject(SupabaseAuthService);

  loadPromotionalBanners$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PromotionalBannersActions.loadPromotionalBanners),
      switchMap(
        (
          action: ReturnType<
            typeof PromotionalBannersActions.loadPromotionalBanners
          >
        ) => {
          // Important: reducers run before effects.
          // That means `loading=true` will already be set for this action by the time we get here.
          // So we must NOT use "loading" as a gate, otherwise the fetch is permanently blocked.
          return this.store
            .select(
              PromotionalBannersSelectors.selectPromotionalBannersLoadedAtForVendor(
                action.vendorId
              )
            )
            .pipe(
              take(1),
              filter((loadedAt) => loadedAt == null),
              map(() => action)
            );
        }
      ),
      switchMap(({ vendorId }) => {
        const vendorIdKey = vendorId ?? GLOBAL_VENDOR_KEY;
        return from(this.supabaseAuthService.getBanners(vendorId)).pipe(
          map((banners) =>
            PromotionalBannersActions.loadPromotionalBannersSuccess({
              vendorIdKey,
              banners: (banners ?? []) as PromotionalBannersActions.PromotionalBanner[],
            })
          ),
          catchError((error: unknown) =>
            of(
              PromotionalBannersActions.loadPromotionalBannersFailure({
                vendorIdKey,
                error:
                  error instanceof Error ? error.message : 'Failed to load banners',
              })
            )
          )
        );
      })
    )
  );
}


