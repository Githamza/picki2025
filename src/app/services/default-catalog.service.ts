import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { createClient, type ErrorResponse, type Photo } from 'pexels';

import { environment } from '../../environments/environment';
import type { OnboardingCatalog } from './onboarding-catalog.types';

type PexelsClient = ReturnType<typeof createClient>;
type PexelsPhotoSrcKey = keyof Photo['src'];

@Injectable({ providedIn: 'root' })
export class DefaultCatalogService {
  private readonly http = inject(HttpClient);

  private readonly pexelsClient: PexelsClient | null = environment.pexelsApiKey
    ? createClient(environment.pexelsApiKey)
    : null;

  private catalogPromise: Promise<OnboardingCatalog> | null = null;
  private readonly photoByIdPromise = new Map<number, Promise<Photo>>();

  async getDefaultCatalog(): Promise<OnboardingCatalog> {
    this.catalogPromise ??= this.loadAndHydrateCatalog();
    return this.catalogPromise;
  }

  private async loadAndHydrateCatalog(): Promise<OnboardingCatalog> {
    const baseCatalog = await firstValueFrom(
      this.http.get<OnboardingCatalog>('/onboarding/default-catalog.json')
    );

    return await this.hydrateImages(baseCatalog);
  }

  private async hydrateImages(catalog: OnboardingCatalog): Promise<OnboardingCatalog> {
    // Keep concurrency modest so we don't spam the API / network.
    const limit = 6;

    const categories = await this.mapWithConcurrency(
      catalog.categories,
      limit,
      async (category) => ({
        ...category,
        image_url: category.image_url
          ? await this.toLightweightPexelsUrl(category.image_url, 'tiny')
          : category.image_url,
      })
    );

    const products = await this.mapWithConcurrency(
      catalog.products,
      limit,
      async (product) => ({
        ...product,
        image_url: product.image_url
          ? await this.toLightweightPexelsUrl(product.image_url, 'small')
          : product.image_url,
      })
    );

    const banners = catalog.banners
      ? await this.mapWithConcurrency(catalog.banners, limit, async (banner) => ({
          ...banner,
          image_url: banner.image_url
            ? await this.toLightweightPexelsUrl(banner.image_url, 'medium')
            : banner.image_url,
        }))
      : undefined;

    return {
      ...catalog,
      categories,
      products,
      ...(banners ? { banners } : {}),
    };
  }

  private async toLightweightPexelsUrl(
    imageUrl: string,
    preferredSize: PexelsPhotoSrcKey
  ): Promise<string> {
    const photoId = this.extractPexelsPhotoId(imageUrl);
    if (!photoId) {
      return imageUrl;
    }

    // If no key is configured, fall back to the original URL.
    if (!this.pexelsClient) {
      return imageUrl;
    }

    const photo = await this.getPhotoById(photoId);

    // Use the preferred size if present, otherwise fall back in a safe order.
    return (
      photo.src[preferredSize] ??
      photo.src.small ??
      photo.src.tiny ??
      photo.src.medium ??
      imageUrl
    );
  }

  private extractPexelsPhotoId(url: string): number | null {
    // Examples:
    // https://images.pexels.com/photos/1437267/pexels-photo-1437267.jpeg?...
    const match = /\/\/images\.pexels\.com\/photos\/(\d+)\//.exec(url);
    if (!match?.[1]) {
      return null;
    }

    const id = Number(match[1]);
    return Number.isFinite(id) ? id : null;
  }

  private async getPhotoById(id: number): Promise<Photo> {
    const cached = this.photoByIdPromise.get(id);
    if (cached) {
      return await cached;
    }

    if (!this.pexelsClient) {
      throw new Error('Pexels API key is not configured.');
    }

    const promise = this.pexelsClient.photos.show({ id }).then((res) => {
      if (this.isPexelsError(res)) {
        throw new Error(res.error || `Pexels API error while fetching photo ${id}`);
      }
      return res;
    });

    this.photoByIdPromise.set(id, promise);
    return await promise;
  }

  private isPexelsError(res: Photo | ErrorResponse): res is ErrorResponse {
    return typeof (res as ErrorResponse).error === 'string';
  }

  private async mapWithConcurrency<T, R>(
    items: readonly T[],
    concurrency: number,
    mapper: (item: T, index: number) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;

    const workers = Array.from({
      length: Math.min(concurrency, items.length),
    }).map(async () => {
      while (true) {
        const current = nextIndex;
        nextIndex += 1;

        if (current >= items.length) {
          return;
        }

        results[current] = await mapper(items[current]!, current);
      }
    });

    await Promise.all(workers);
    return results;
  }
}







