import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { VendorService } from '../../services/vendor.service';
import { VendorNavigationService } from '../../services/vendor-navigation.service';
import { Tables } from '../../types/supabase.types';
import { toSignal } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { distinctUntilChanged, map, startWith, switchMap } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { AppState } from '../../store/models/app.state';
import * as CategoryActions from '../../store/actions/category.actions';
import { RouterOutlet } from '@angular/router';
import * as PromotionalBannersActions from '../../store/actions/promotional-banners.actions';
import * as PromotionalBannersSelectors from '../../store/selectors/promotional-banners.selectors';

type Banner = Tables<'banners'>;

@Component({
  selector: 'app-promotional-banner',
  imports: [CommonModule, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (currentBanner(); as banner) {
      <div class="promotional-banner">
        <div class="banner-container">
          <div class="banner-link" (click)="navigateToProducts()">
            <img
              [src]="banner.image_url"
              [alt]="banner.title || 'Promotional banner'"
              class="banner-image"
            />
            @if (banner.title) {
              <div class="banner-overlay">
                <h3 class="banner-title">{{ banner.title }}</h3>
              </div>
            }
          </div>
        </div>
        @if (banners().length > 1) {
          <div class="banner-indicators">
            @for (bannerItem of banners(); track (bannerItem.id ?? $index); let i = $index) {
              <button
                class="indicator"
                [class.active]="i === currentIndex()"
                (click)="goToBanner(i); $event.stopPropagation()"
                [attr.aria-label]="'Go to banner ' + (i + 1)"
              ></button>
            }
          </div>
        }
      </div>
    }
    <router-outlet></router-outlet>
  `,
  styles: [
    `
      .promotional-banner {
        position: relative;
        width: 100%;
        min-height: 300px;
        height: 300px;
        overflow: hidden;
        border-radius: 12px;
        margin-bottom: 24px;
      }

      .banner-container {
        width: 100%;
        height: 100%;
      }

      .banner-link {
        display: block;
        width: 100%;
        height: 100%;
        position: relative;
        text-decoration: none;
        cursor: pointer;
      }

      .banner-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .banner-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(
          to top,
          rgba(0, 0, 0, 0.7) 0%,
          transparent 100%
        );
        padding: 24px;
        color: white;
      }

      .banner-title {
        margin: 0;
        font-size: 24px;
        font-weight: 500;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
      }

      .banner-indicators {
        position: absolute;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 8px;
      }

      .indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        border: none;
        background-color: rgba(255, 255, 255, 0.5);
        cursor: pointer;
        transition: all 0.3s ease;
        padding: 0;
      }

      .indicator:hover {
        background-color: rgba(255, 255, 255, 0.8);
      }

      .indicator.active {
        background-color: white;
        width: 24px;
        border-radius: 4px;
      }

      @media (max-width: 768px) {
        .promotional-banner {
          min-height: 150px;
          height: 150px;
          margin-bottom: 16px;
        }

        .banner-title {
          font-size: 20px;
        }
      }
    `,
  ],
})
export class PromotionalBannerComponent {
  private vendorService = inject(VendorService);
  private vendorNavigation = inject(VendorNavigationService);
  private store = inject(Store<AppState>);

  private vendorId$ = this.vendorService.currentVendor$.pipe(
    map((vendor) => vendor?.id ?? null),
    distinctUntilChanged()
  );

  private vendorId = toSignal(this.vendorId$, { initialValue: null });

  readonly banners = toSignal(
    this.vendorId$.pipe(
      switchMap((vendorId) =>
        this.store.select(
          PromotionalBannersSelectors.selectPromotionalBannersForVendor(
            vendorId ?? undefined
          )
        )
      ),
      startWith([] as Banner[])
    ),
    { initialValue: [] as Banner[] }
  );

  readonly currentIndex = signal(0);

  readonly currentBanner = computed<Banner | null>(() => {
    const banners = this.banners();
    const index = this.currentIndex();
    return banners[index] ?? null;
  });

  constructor() {
    effect(() => {
      const vendorId = this.vendorId() ?? undefined;
      this.store.dispatch(
        PromotionalBannersActions.loadPromotionalBanners({ vendorId })
      );
      // Reset to first banner when vendor context changes
      this.currentIndex.set(0);
    });

    effect((onCleanup) => {
      const banners = this.banners();
      if (banners.length <= 1) return;

      const sub = interval(5000).subscribe(() => this.nextBanner());
      onCleanup(() => sub.unsubscribe());
    });
  }

  goToBanner(index: number) {
    this.currentIndex.set(index);
  }

  nextBanner() {
    const banners = this.banners();
    if (banners.length === 0) return;
    this.currentIndex.update((i) => (i + 1) % banners.length);
  }

  previousBanner() {
    const banners = this.banners();
    if (banners.length === 0) return;
    this.currentIndex.update((i) => (i === 0 ? banners.length - 1 : i - 1));
  }

  navigateToProducts() {
    // Clear selected category when navigating to products
    this.store.dispatch(CategoryActions.clearSelectedCategory());
    this.vendorNavigation.navigateWithVendor('promotional-banner');
  }
}
