import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';
import { Tables } from '../../types/supabase.types';
import { interval } from 'rxjs';

type Banner = Tables<'banners'>;

@Component({
  selector: 'app-promotional-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="promotional-banner" *ngIf="banners.length > 0">
      <div class="banner-container">
        <a
          [href]="currentBanner.link_url || '#'"
          class="banner-link"
          [target]="currentBanner.link_url ? '_blank' : '_self'"
        >
          <img
            [src]="currentBanner.image_url"
            [alt]="currentBanner.title || 'Promotional banner'"
            class="banner-image"
          />
          <div class="banner-overlay" *ngIf="currentBanner.title">
            <h3 class="banner-title">{{ currentBanner.title }}</h3>
          </div>
        </a>
      </div>
      <div class="banner-indicators" *ngIf="banners.length > 1">
        <button
          *ngFor="let banner of banners; let i = index"
          class="indicator"
          [class.active]="i === currentIndex"
          (click)="goToBanner(i)"
          [attr.aria-label]="'Go to banner ' + (i + 1)"
        ></button>
      </div>
    </div>
  `,
  styles: [
    `
      .promotional-banner {
        position: relative;
        width: 100%;
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
          height: 200px;
          margin-bottom: 16px;
        }

        .banner-title {
          font-size: 20px;
        }
      }
    `,
  ],
})
export class PromotionalBannerComponent implements OnInit {
  private supabaseService = inject(SupabaseService);

  banners: Banner[] = [];
  currentIndex = 0;
  private intervalSubscription?: any;

  get currentBanner(): Banner {
    return this.banners[this.currentIndex] || ({} as Banner);
  }

  async ngOnInit() {
    await this.loadBanners();

    // Auto-rotate banners every 5 seconds if there are multiple
    if (this.banners.length > 1) {
      this.intervalSubscription = interval(5000).subscribe(() => {
        this.nextBanner();
      });
    }
  }

  ngOnDestroy() {
    if (this.intervalSubscription) {
      this.intervalSubscription.unsubscribe();
    }
  }

  async loadBanners() {
    try {
      this.banners = (await this.supabaseService.getBanners()) || [];
    } catch (error) {
      console.error('Error loading banners:', error);
      this.banners = [];
    }
  }

  goToBanner(index: number) {
    this.currentIndex = index;
  }

  nextBanner() {
    this.currentIndex = (this.currentIndex + 1) % this.banners.length;
  }

  previousBanner() {
    this.currentIndex =
      this.currentIndex === 0 ? this.banners.length - 1 : this.currentIndex - 1;
  }
}
