import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GooglePlacesService } from '../../../services/google-places.service';
import { Coordinates } from '../../../services/delivery/delivery.types';

@Component({
  selector: 'app-map-location-viewer',
  imports: [CommonModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="viewer">
      <div class="map" #map></div>

      <button
        mat-stroked-button
        type="button"
        class="layer"
        (click)="toggleMapType()"
      >
        <mat-icon>layers</mat-icon>
        {{ mapTypeLabel() }}
      </button>
    </div>
  `,
  styles: [
    `
      .viewer {
        position: relative;
        width: 100%;
        height: 260px;
        border-radius: 16px;
        overflow: hidden;
        background: var(--mat-sys-surface);
        box-shadow: var(--mat-sys-elevation-level1);
      }

      .map {
        position: absolute;
        inset: 0;
      }

      .layer {
        position: absolute;
        right: 12px;
        top: 12px;
        background: var(--mat-sys-surface);
      }
    `,
  ],
})
export class MapLocationViewerComponent implements AfterViewInit {
  readonly coordinates = input.required<Coordinates>();
  readonly zoom = input<number>(16);

  private readonly placesLoader = inject(GooglePlacesService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly mapEl = viewChild.required<ElementRef<HTMLDivElement>>('map');
  private readonly _map = signal<google.maps.Map | null>(null);
  private readonly _marker = signal<google.maps.Marker | null>(null);
  private readonly _mapTypeId = signal<'roadmap' | 'hybrid'>('roadmap');

  readonly mapTypeLabel = computed(() =>
    this._mapTypeId() === 'roadmap' ? 'Satellite' : 'Plan'
  );

  constructor() {
    effect(() => {
      const map = this._map();
      const marker = this._marker();
      const coords = this.coordinates();
      if (!map || !marker) return;
      map.setCenter(coords);
      marker.setPosition(coords);
    });
  }

  async ngAfterViewInit(): Promise<void> {
    await this.placesLoader.load();
    const coords = this.coordinates();

    const map = new google.maps.Map(this.mapEl().nativeElement, {
      center: coords,
      zoom: this.zoom(),
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      disableDefaultUI: true,
      clickableIcons: false,
      mapTypeId: this._mapTypeId(),
    });

    const marker = new google.maps.Marker({
      map,
      position: coords,
      title: 'Position de livraison',
    });

    this.destroyRef.onDestroy(() => {
      marker.setMap(null);
    });

    this._map.set(map);
    this._marker.set(marker);
  }

  toggleMapType(): void {
    const map = this._map();
    if (!map) return;
    const next = this._mapTypeId() === 'roadmap' ? 'hybrid' : 'roadmap';
    this._mapTypeId.set(next);
    map.setMapTypeId(next);
  }
}


