// Minimal Google Maps type declarations to satisfy TypeScript without @types/google.maps
declare namespace google {
  namespace maps {
    interface MapOptions {
      center?: { lat: number; lng: number };
      zoom?: number;
      mapTypeControl?: boolean;
      streetViewControl?: boolean;
      fullscreenControl?: boolean;
      mapTypeId?: string;
      disableDefaultUI?: boolean;
      clickableIcons?: boolean;
    }

    interface MapsEventListener {
      remove(): void;
    }

    class LatLng {
      lat(): number;
      lng(): number;
    }

    interface GeocoderAddressComponent {
      long_name: string;
      short_name: string;
      types: string[];
    }
    class Map {
      constructor(el: any, opts?: MapOptions);
      setCenter(latlng: { lat: number; lng: number }): void;
      getCenter(): LatLng | null;
      setZoom(zoom: number): void;
      addListener(eventName: string, handler: () => void): MapsEventListener;
      setMapTypeId(mapTypeId: string): void;
      getMapTypeId(): string;
    }

    interface MarkerOptions {
      map: Map;
      position: { lat: number; lng: number };
      title?: string;
    }

    class Marker {
      constructor(opts: MarkerOptions);
      setPosition(position: { lat: number; lng: number }): void;
      setMap(map: Map | null): void;
    }
    class Geocoder {
      geocode(
        request: any,
        callback: (results: GeocoderResult[] | null, status: any) => void
      ): void;
    }
    type GeocoderResult = any;
    const GeocoderStatus: any;
    namespace places {
      interface AutocompletePrediction {
        description: string;
        place_id: string;
      }
      class AutocompleteService {
        getPlacePredictions(
          request: any,
          callback: (
            predictions: AutocompletePrediction[] | null,
            status: any
          ) => void
        ): void;
      }
      class PlacesService {
        constructor(map: Map);
        getDetails(
          request: any,
          callback: (place: any, status: any) => void
        ): void;
      }
      const PlacesServiceStatus: any;
    }
  }
}
