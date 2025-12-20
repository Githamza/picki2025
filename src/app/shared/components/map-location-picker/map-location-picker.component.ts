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
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GooglePlacesService } from '../../../services/google-places.service';
import { Coordinates } from '../../../services/delivery/delivery.types';

@Component({
  selector: 'app-map-location-picker',
  imports: [CommonModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="picker">
      <div class="map" #map></div>

      <div class="pin" aria-hidden="true">
        <mat-icon>place</mat-icon>
      </div>

      <button
        mat-stroked-button
        type="button"
        class="gps"
        (click)="requestBrowserLocation()"
      >
        <mat-icon>my_location</mat-icon>
        Utiliser ma position
      </button>

      <button
        mat-stroked-button
        type="button"
        class="layer"
        (click)="toggleMapType()"
      >
        <mat-icon>layers</mat-icon>
        {{ mapTypeLabel() }}
      </button>

      @if (error()) {
        <div class="error" role="alert">{{ error() }}</div>
      }
    </div>
  `,
  styles: [
    `
      .picker {
        position: relative;
        width: 100%;
        height: 320px;
        border-radius: 16px;
        overflow: hidden;
        background: var(--mat-sys-surface);
        box-shadow: var(--mat-sys-elevation-level1);
      }

      .map {
        position: absolute;
        inset: 0;
      }

      .pin {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -100%);
        pointer-events: none;
        color: var(--mat-sys-primary);
        filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.35));
      }

      .gps {
        position: absolute;
        left: 12px;
        top: 12px;
        background: var(--mat-sys-surface);
      }

      .layer {
        position: absolute;
        right: 12px;
        top: 12px;
        background: var(--mat-sys-surface);
      }

      .error {
        position: absolute;
        left: 12px;
        right: 12px;
        bottom: 12px;
        padding: 8px 12px;
        border-radius: 12px;
        background: color-mix(in srgb, var(--mat-sys-error) 12%, transparent);
        color: var(--mat-sys-on-surface);
        font-size: 12px;
      }
    `,
  ],
})
export class MapLocationPickerComponent implements AfterViewInit {
  // Inputs
  readonly center = input<Coordinates | null>(null);
  readonly zoom = input<number>(16);

  // Outputs
  readonly centerChange = output<Coordinates>();

  private readonly placesLoader = inject(GooglePlacesService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly mapEl = viewChild.required<ElementRef<HTMLDivElement>>('map');

  readonly error = signal<string | null>(null);
  private readonly _map = signal<google.maps.Map | null>(null);
  private readonly _mapTypeId = signal<'roadmap' | 'hybrid'>('roadmap');

  readonly mapTypeLabel = computed(() =>
    this._mapTypeId() === 'roadmap' ? 'Satellite' : 'Plan'
  );

  private readonly targetCenter = computed<Coordinates>(() => {
    return this.center() ?? { lat: 48.8566, lng: 2.3522 }; // Paris fallback
  });

  constructor() {
    // Keep map centered when external center changes (e.g. after geolocation)
    effect(() => {
      const map = this._map();
      const center = this.center();
      if (!map || !center) return;
      map.setCenter(center);
    });
  }

  async ngAfterViewInit(): Promise<void> {
    await this.placesLoader.load();

    const map = new google.maps.Map(this.mapEl().nativeElement, {
      center: this.targetCenter(),
      zoom: this.zoom(),
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      mapTypeId: this._mapTypeId(),
    });

    const idleListener = map.addListener('idle', () => {
      const c = map.getCenter();
      if (!c) return;
      this.centerChange.emit({ lat: c.lat(), lng: c.lng() });
    });

    this.destroyRef.onDestroy(() => {
      idleListener.remove();
    });

    this._map.set(map);
  }

  toggleMapType(): void {
    const map = this._map();
    if (!map) return;
    const next = this._mapTypeId() === 'roadmap' ? 'hybrid' : 'roadmap';
    this._mapTypeId.set(next);
    map.setMapTypeId(next);
  }

  requestBrowserLocation(): void {
    this.error.set(null);

    if (!navigator.geolocation) {
      this.error.set("La géolocalisation n'est pas disponible sur ce navigateur.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        const map = this._map();
        if (map) {
          map.setCenter(coords);
          map.setZoom(17);
        }
        this.centerChange.emit(coords);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          this.error.set(
            'Autorisation refusée. Activez la localisation pour partager votre position.'
          );
          return;
        }
        this.error.set(
          "Impossible d'obtenir votre position. Réessayez ou utilisez l'adresse."
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 10_000 }
    );
  }
}

