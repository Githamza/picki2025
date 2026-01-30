import {
  Directive,
  ElementRef,
  Input,
  OnInit,
  OnDestroy,
  inject,
  PLATFORM_ID,
  Renderer2,
  Output,
  EventEmitter,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ImageCacheService } from '../../services/image-cache.service';
import { PRODUCT_PLACEHOLDER_IMAGE } from '../utils/image-placeholder';

@Directive({
  selector: 'img[appCachedImage]',
  standalone: true,
})
export class CachedImageDirective implements OnInit, OnDestroy {
  @Input('appCachedImage') imageSrc: string | null | undefined = '';
  @Input() fallbackSrc: string = PRODUCT_PLACEHOLDER_IMAGE;
  @Input() lazyLoad = true;
  @Input() rootMargin = '100px'; // Start loading when image is 100px from viewport

  @Output() imageLoaded = new EventEmitter<void>();
  @Output() imageError = new EventEmitter<void>();

  private el = inject(ElementRef);
  private renderer = inject(Renderer2);
  private platformId = inject(PLATFORM_ID);
  private imageCacheService = inject(ImageCacheService);

  private observer: IntersectionObserver | null = null;
  private hasLoaded = false;
  private currentSrc: string | null = null;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.setImageSrc(this.imageSrc || this.fallbackSrc);
      return;
    }

    const imgElement = this.el.nativeElement as HTMLImageElement;

    // Set native lazy loading attribute
    if (this.lazyLoad) {
      this.renderer.setAttribute(imgElement, 'loading', 'lazy');
      this.renderer.setAttribute(imgElement, 'decoding', 'async');
    }

    // Add CSS for smooth loading transition
    this.renderer.setStyle(imgElement, 'transition', 'opacity 0.3s ease-in-out');

    const targetSrc = this.imageSrc || this.fallbackSrc;

    // If image is already cached, load immediately
    if (this.imageCacheService.isCached(targetSrc)) {
      this.loadImage(targetSrc);
      return;
    }

    // Use Intersection Observer for lazy loading
    if (this.lazyLoad && 'IntersectionObserver' in window) {
      // Set placeholder initially
      this.setPlaceholder();
      this.setupIntersectionObserver(targetSrc);
    } else {
      // Fallback: load immediately if no IntersectionObserver support or lazy loading disabled
      this.loadImage(targetSrc);
    }
  }

  ngOnDestroy(): void {
    this.disconnectObserver();
  }

  private setupIntersectionObserver(src: string): void {
    const options: IntersectionObserverInit = {
      root: null,
      rootMargin: this.rootMargin,
      threshold: 0.01,
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !this.hasLoaded) {
          this.loadImage(src);
          this.disconnectObserver();
        }
      });
    }, options);

    this.observer.observe(this.el.nativeElement);
  }

  private loadImage(src: string): void {
    if (this.hasLoaded && this.currentSrc === src) {
      return;
    }

    const imgElement = this.el.nativeElement as HTMLImageElement;

    // Set low opacity during load
    this.renderer.setStyle(imgElement, 'opacity', '0.5');

    // Create a temporary image to preload
    const tempImg = new Image();

    tempImg.onload = () => {
      this.setImageSrc(src);
      this.renderer.setStyle(imgElement, 'opacity', '1');
      this.imageCacheService.markAsLoaded(src);
      this.hasLoaded = true;
      this.currentSrc = src;
      this.imageLoaded.emit();
    };

    tempImg.onerror = () => {
      this.imageCacheService.markAsError(src);
      this.setImageSrc(this.fallbackSrc);
      this.renderer.setStyle(imgElement, 'opacity', '1');
      this.imageError.emit();
    };

    tempImg.src = src;
  }

  private setImageSrc(src: string): void {
    this.renderer.setAttribute(this.el.nativeElement, 'src', src);
  }

  private setPlaceholder(): void {
    // Use a small data URI for the placeholder to avoid network request
    const placeholderDataUri =
      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"%3E%3Crect fill="%23f0f0f0" width="300" height="200"/%3E%3C/svg%3E';
    this.setImageSrc(placeholderDataUri);
    this.renderer.setStyle(this.el.nativeElement, 'opacity', '0.5');
  }

  private disconnectObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
