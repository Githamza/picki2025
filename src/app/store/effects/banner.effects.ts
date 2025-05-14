import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { tap, withLatestFrom, filter } from 'rxjs/operators';
import * as BannerActions from '../actions/banner.actions';
import * as BannerSelectors from '../selectors/banner.selectors';
import { AppState } from '../models/app.state';

@Injectable()
export class BannerEffects {
  private actions$ = inject(Actions);
  private store = inject(Store<AppState>);

  // Example effect that logs banner actions to the console
  logBannerActions$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          BannerActions.updateBannerTitle,
          BannerActions.updateBannerSubtitle,
          BannerActions.toggleBannerVisibility,
          BannerActions.setBannerVisibility,
          BannerActions.resetBanner
        ),
        tap((action) => console.log('Banner action dispatched:', action))
      ),
    { dispatch: false }
  );

  // Effect that only executes when the banner is visible
  // This demonstrates using withLatestFrom to combine the action with state
  visibleBannerUpdates$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          BannerActions.updateBannerTitle,
          BannerActions.updateBannerSubtitle
        ),
        withLatestFrom(
          this.store.select(BannerSelectors.selectBannerVisibility)
        ),
        filter(([_, isVisible]) => isVisible),
        tap(([action, _]) => console.log('Visible banner updated:', action))
      ),
    { dispatch: false }
  );

  // Example of an effect that demonstrates conditional logic
  // This is a more advanced pattern showing combining streams
  resetBannerTracking$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(BannerActions.resetBanner),
        withLatestFrom(
          this.store.select(BannerSelectors.selectBannerTitle),
          this.store.select(BannerSelectors.selectBannerSubtitle)
        ),
        tap(([_, oldTitle, oldSubtitle]) => {
          console.log('Banner reset from:', {
            previousTitle: oldTitle,
            previousSubtitle: oldSubtitle,
          });
        })
      ),
    { dispatch: false }
  );
}
