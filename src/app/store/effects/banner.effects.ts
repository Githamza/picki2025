import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { tap } from 'rxjs/operators';
import * as BannerActions from '../actions/banner.actions';

@Injectable()
export class BannerEffects {
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

  constructor(private actions$: Actions) {}
}
