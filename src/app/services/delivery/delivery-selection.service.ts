import { Injectable, inject, signal, computed } from '@angular/core';
import { DeliveryComparisonService } from './delivery-comparison.service';
import {
  Address,
  Coordinates,
  DeliveryComparisonOption,
  DeliveryQuote,
  DeliveryRequest,
  DeliveryStop,
} from './delivery.types';
import { VendorService } from '../vendor.service';
import { GooglePlacesAutocompleteService } from '../google-places-autocomplete.service';

@Injectable({ providedIn: 'root' })
export class DeliverySelectionService {
  private comparison = inject(DeliveryComparisonService);
  private vendorService = inject(VendorService);
  private places = inject(GooglePlacesAutocompleteService);

  private _selectedAddress = signal<Address | null>(null);
  private _bestOption = signal<DeliveryComparisonOption | null>(null);
  private _quotes = signal<DeliveryQuote[]>([]);
  private _loading = signal<boolean>(false);
  private _error = signal<string | null>(null);

  readonly selectedAddress = this._selectedAddress.asReadonly();
  readonly bestOption = this._bestOption.asReadonly();
  readonly quotes = this._quotes.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly hasSelection = computed(() => !!this._selectedAddress());

  async setAddressFromPlaceId(placeId: string): Promise<void> {
    this._error.set(null);
    const details = await this.places.getPlaceDetails(placeId);
    if (!details) {
      this._error.set('Adresse introuvable.');
      return;
    }
    this._selectedAddress.set(details.address);
    await this.refreshQuote();
  }

  /**
   * Set dropoff address WITHOUT calculating quotes.
   * Useful when the vendor uses their own delivery with a fixed price.
   */
  async setAddressOnlyFromPlaceId(placeId: string): Promise<void> {
    this._error.set(null);
    const details = await this.places.getPlaceDetails(placeId);
    if (!details) {
      this._error.set('Adresse introuvable.');
      return;
    }
    this._selectedAddress.set(details.address);
    this._bestOption.set(null);
    this._quotes.set([]);
  }

  async setAddressFromCoordinates(coords: Coordinates): Promise<void> {
    this._error.set(null);
    const details = await this.places.reverseGeocode(coords);
    if (!details) {
      this._error.set(
        "Impossible de déterminer l'adresse à partir de votre position."
      );
      return;
    }
    this._selectedAddress.set(details.address);
    await this.refreshQuote();
  }

  /**
   * Set dropoff address from coordinates WITHOUT calculating quotes.
   */
  async setAddressOnlyFromCoordinates(coords: Coordinates): Promise<void> {
    this._error.set(null);
    const details = await this.places.reverseGeocode(coords);
    if (!details) {
      this._error.set(
        "Impossible de déterminer l'adresse à partir de votre position."
      );
      return;
    }
    this._selectedAddress.set(details.address);
    this._bestOption.set(null);
    this._quotes.set([]);
  }

  async refreshQuote(): Promise<void> {
    const address = this._selectedAddress();
    if (!address) return;
    this._loading.set(true);
    try {
      const pickup = await this.getRestaurantPickupStop();
      if (!pickup) {
        this._error.set("Impossible de déterminer l'adresse du restaurant.");
        this._loading.set(false);
        return;
      }
      const dropoff: DeliveryStop = { address };
      const request: DeliveryRequest = {
        pickup,
        dropoff,
        package: {},
        serviceLevel: 'instant',
      };
      const [quotes, best] = await Promise.all([
        this.comparison.getQuotes(request),
        this.comparison.getBestOption(request),
      ]);
      this._quotes.set(quotes);
      this._bestOption.set(best);

      // If no quotes are available, set an appropriate error message
      if (quotes.length === 0) {
        this._error.set(
          'Aucune option de livraison disponible pour cette adresse. Les frais de livraison sont trop élevés.'
        );
      }
    } catch (e) {
      this._error.set('Erreur lors du calcul du devis de livraison.');
    } finally {
      this._loading.set(false);
    }
  }

  clear(): void {
    this._selectedAddress.set(null);
    this._bestOption.set(null);
    this._quotes.set([]);
    this._error.set(null);
  }

  private async getRestaurantPickupStop(): Promise<DeliveryStop | null> {
    const info = await this.vendorService.getRestaurantInfo().toPromise();
    if (!info) return null;
    const addressLine = `${info.address.street}, ${info.address.postal_code} ${info.address.city}, ${info.address.country}`;
    // Try to geocode restaurant address using Google Places TextSearch
    await this.places.loader.load();
    const geocoder = new google.maps.Geocoder();
    const geo = await new Promise<google.maps.GeocoderResult[] | null>(
      (resolve) => {
        geocoder.geocode({ address: addressLine }, (results, status) => {
          if (status === google.maps.GeocoderStatus.OK && results)
            resolve(results);
          else resolve(null);
        });
      }
    );
    const coords = geo?.[0]?.geometry?.location;
    const pickupAddress = {
      line1: info.address.street,
      postalCode: info.address.postal_code,
      city: info.address.city,
      countryCode: 'FR',
      coordinates: coords
        ? { lat: coords.lat(), lng: coords.lng() }
        : undefined,
    };
    return { address: pickupAddress };
  }
}
