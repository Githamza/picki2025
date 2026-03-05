import { Injectable, inject, signal } from '@angular/core';
import {
  VendorService,
  type RestaurantInfo,
} from '../../services/vendor.service';

@Injectable()
export class RestaurantInfoDataService {
  private vendorService = inject(VendorService);

  restaurantInfo = signal<RestaurantInfo | null>(null);
  bannerUrl = signal('');
  bannerTitle = signal('');
  isLoaded = signal(false);

  async loadRestaurantInfo(): Promise<void> {
    this.isLoaded.set(false);

    this.vendorService.getRestaurantInfo().subscribe(async (info) => {
      if (info) {
        let banner = '';
        let title = '';
        try {
          const bannerData = await this.vendorService.getVendorBanner(info.vendor.id);
          banner = bannerData?.image_url || '';
          title = bannerData?.title || '';
        } catch (error) {
          console.warn('Could not load vendor banner:', error);
        }
        this.restaurantInfo.set(info);
        this.bannerUrl.set(banner);
        this.bannerTitle.set(title);
      }
      this.isLoaded.set(true);
    });
  }

  async refreshVendor(): Promise<void> {
    this.vendorService.clearCache();
    await this.vendorService.loadVendors();
    await this.loadRestaurantInfo();
  }
}
