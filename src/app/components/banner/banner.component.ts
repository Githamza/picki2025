import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { AsyncPipe, NgIf, NgOptimizedImage } from '@angular/common';
import { Observable } from 'rxjs';
import { AppState } from '../../store/models/app.state';
import * as BannerActions from '../../store/actions/banner.actions';
import * as BannerSelectors from '../../store/selectors/banner.selectors';

@Component({
  selector: 'app-banner',
  templateUrl: './banner.component.html',
  styleUrls: ['./banner.component.scss'],
  standalone: true,
  imports: [AsyncPipe, NgIf, NgOptimizedImage],
})
export class BannerComponent implements OnInit {
  title$: Observable<string>;
  subtitle$: Observable<string>;
  isVisible$: Observable<boolean>;

  constructor(private store: Store<AppState>) {
    this.title$ = this.store.select(BannerSelectors.selectBannerTitle);
    this.subtitle$ = this.store.select(BannerSelectors.selectBannerSubtitle);
    this.isVisible$ = this.store.select(BannerSelectors.selectBannerVisibility);
  }

  ngOnInit(): void {
    // Example of dispatching an action
    // this.store.dispatch(BannerActions.updateBannerTitle({ title: 'Updated Title' }));
  }

  toggleVisibility(): void {
    this.store.dispatch(BannerActions.toggleBannerVisibility());
  }

  updateTitle(newTitle: string): void {
    this.store.dispatch(BannerActions.updateBannerTitle({ title: newTitle }));
  }

  updateSubtitle(newSubtitle: string): void {
    this.store.dispatch(
      BannerActions.updateBannerSubtitle({ subtitle: newSubtitle })
    );
  }

  resetBanner(): void {
    this.store.dispatch(BannerActions.resetBanner());
  }
}
