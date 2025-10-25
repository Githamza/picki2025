// Minimal Google Maps type declarations to satisfy TypeScript without @types/google.maps
declare namespace google {
  namespace maps {
    interface GeocoderAddressComponent {
      long_name: string;
      short_name: string;
      types: string[];
    }
    class Map {
      constructor(el: any);
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
