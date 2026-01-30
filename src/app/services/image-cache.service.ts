import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface CachedImage {
  url: string;
  loadedAt: number;
  status: 'loading' | 'loaded' | 'error';
}

@Injectable({
  providedIn: 'root',
})
export class ImageCacheService {
  private readonly CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes
  private imageCache = new Map<string, CachedImage>();
  private loadingImages = new Map<string, Promise<void>>();
  private preloadedUrls = new Set<string>();

  private cacheStats$ = new BehaviorSubject<{ cached: number; preloaded: number }>({
    cached: 0,
    preloaded: 0,
  });

  /**
   * Check if an image URL is already cached and valid
   */
  isCached(url: string): boolean {
    if (!url) return false;
    const cached = this.imageCache.get(url);
    if (!cached) return false;

    const isExpired = Date.now() - cached.loadedAt > this.CACHE_DURATION_MS;
    if (isExpired) {
      this.imageCache.delete(url);
      return false;
    }

    return cached.status === 'loaded';
  }

  /**
   * Mark an image as loaded (called when image onload fires)
   */
  markAsLoaded(url: string): void {
    if (!url) return;

    this.imageCache.set(url, {
      url,
      loadedAt: Date.now(),
      status: 'loaded',
    });
    this.updateStats();
  }

  /**
   * Mark an image as having an error
   */
  markAsError(url: string): void {
    if (!url) return;

    this.imageCache.set(url, {
      url,
      loadedAt: Date.now(),
      status: 'error',
    });
  }

  /**
   * Preload a single image
   */
  preloadImage(url: string): Promise<void> {
    if (!url || this.isCached(url) || this.preloadedUrls.has(url)) {
      return Promise.resolve();
    }

    // Check if already loading
    const existingLoad = this.loadingImages.get(url);
    if (existingLoad) {
      return existingLoad;
    }

    const loadPromise = new Promise<void>((resolve) => {
      const img = new Image();

      img.onload = () => {
        this.markAsLoaded(url);
        this.preloadedUrls.add(url);
        this.loadingImages.delete(url);
        this.updateStats();
        resolve();
      };

      img.onerror = () => {
        this.markAsError(url);
        this.loadingImages.delete(url);
        resolve(); // Resolve anyway to not block batch preloading
      };

      img.src = url;
    });

    this.loadingImages.set(url, loadPromise);
    return loadPromise;
  }

  /**
   * Preload multiple images in parallel with optional concurrency limit
   */
  preloadImages(urls: string[], concurrency = 4): Promise<void[]> {
    const validUrls = urls.filter((url) => url && !this.isCached(url));

    if (validUrls.length === 0) {
      return Promise.resolve([]);
    }

    // Use chunked loading to avoid overwhelming the browser
    return this.loadInChunks(validUrls, concurrency);
  }

  private async loadInChunks(urls: string[], chunkSize: number): Promise<void[]> {
    const results: void[] = [];

    for (let i = 0; i < urls.length; i += chunkSize) {
      const chunk = urls.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(chunk.map((url) => this.preloadImage(url)));
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Clear all cached images
   */
  clearCache(): void {
    this.imageCache.clear();
    this.preloadedUrls.clear();
    this.loadingImages.clear();
    this.updateStats();
  }

  /**
   * Clear expired cache entries
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [url, cached] of this.imageCache.entries()) {
      if (now - cached.loadedAt > this.CACHE_DURATION_MS) {
        this.imageCache.delete(url);
        this.preloadedUrls.delete(url);
      }
    }
    this.updateStats();
  }

  /**
   * Get cache statistics observable
   */
  getCacheStats(): Observable<{ cached: number; preloaded: number }> {
    return this.cacheStats$.asObservable();
  }

  /**
   * Get current cache size
   */
  getCacheSize(): number {
    return this.imageCache.size;
  }

  private updateStats(): void {
    this.cacheStats$.next({
      cached: this.imageCache.size,
      preloaded: this.preloadedUrls.size,
    });
  }
}
