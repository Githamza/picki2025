import { Injectable, inject } from '@angular/core';
import { GooglePlacesService } from './google-places.service';
import { Address, Coordinates } from './delivery/delivery.types';

@Injectable({ providedIn: 'root' })
export class GooglePlacesAutocompleteService {
  private loader = inject(GooglePlacesService);

  async getPredictions(
    input: string
  ): Promise<google.maps.places.AutocompletePrediction[]> {
    await this.loader.load();
    return new Promise((resolve, reject) => {
      const service = new google.maps.places.AutocompleteService();
      service.getPlacePredictions(
        { input, componentRestrictions: { country: ['fr'] } },
        (predictions, status) => {
          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !predictions
          ) {
            resolve([]);
            return;
          }
          resolve(predictions);
        }
      );
    });
  }

  async getPlaceDetails(
    placeId: string
  ): Promise<{ address: Address; coordinates: Coordinates } | null> {
    await this.loader.load();
    return new Promise((resolve) => {
      const map = document.createElement('div');
      const stubMap = new google.maps.Map(map);
      const service = new google.maps.places.PlacesService(stubMap);
      service.getDetails(
        {
          placeId,
          fields: ['address_components', 'geometry', 'formatted_address'],
        },
        (place, status) => {
          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !place ||
            !place.geometry
          ) {
            resolve(null);
            return;
          }
          const coords: Coordinates = {
            lat: place.geometry.location?.lat() ?? 0,
            lng: place.geometry.location?.lng() ?? 0,
          };
          const address: Address = this.parseAddress(
            place.address_components || [],
            place.formatted_address || ''
          );
          address.coordinates = coords;
          resolve({ address, coordinates: coords });
        }
      );
    });
  }

  private parseAddress(
    components: google.maps.GeocoderAddressComponent[],
    fallbackLine1: string
  ): Address {
    const get = (type: string) =>
      components.find((c) => c.types.includes(type))?.long_name || '';
    const streetNumber = get('street_number');
    const route = get('route');
    const line1 = `${streetNumber ? streetNumber + ' ' : ''}${
      route || fallbackLine1
    }`.trim();
    const postalCode = get('postal_code');
    const city =
      get('locality') || get('postal_town') || get('sublocality') || '';
    const countryCode =
      components.find((c) => c.types.includes('country'))?.short_name || 'FR';
    return { line1, postalCode, city, countryCode };
  }
}
