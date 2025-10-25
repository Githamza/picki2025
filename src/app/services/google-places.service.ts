import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

declare global {
  interface Window {
    google?: typeof google;
  }
}

@Injectable({ providedIn: 'root' })
export class GooglePlacesService {
  private apiLoaded = signal(false);
  private loading = false;

  async load(): Promise<void> {
    if (this.apiLoaded()) return;
    if (this.loading) {
      await this.waitForLoad();
      return;
    }
    this.loading = true;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    await new Promise<void>((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error('Failed to load Google Maps script'));
    });
    this.apiLoaded.set(true);
    this.loading = false;
  }

  private async waitForLoad(): Promise<void> {
    while (!this.apiLoaded()) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}
