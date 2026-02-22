import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { materialComponents } from '../../material.components';
import { MapLocationPickerComponent } from '../../shared/components/map-location-picker/map-location-picker.component';
import {
  DiningPreferenceSelectorComponent,
  DiningPreferenceSelectorResult,
} from '../../shared/components/dining-preference-selector/dining-preference-selector.component';
import { DeliverySelectionService } from '../../services/delivery/delivery-selection.service';
import { DiningPreferenceService } from '../../services/dining-preference.service';
import { VendorNavigationService } from '../../services/vendor-navigation.service';
import {
  VendorService,
  type OrderType,
  type Vendor,
} from '../../services/vendor.service';
import { Coordinates } from '../../services/delivery/delivery.types';
import { PromotionalBannerComponent } from '../promotional-banner/promotional-banner.component';

@Component({
  selector: 'app-welcome-screen',
  imports: [
    CommonModule,
    ...materialComponents,
    MapLocationPickerComponent,
    DiningPreferenceSelectorComponent,
    PromotionalBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './welcome-screen.component.html',
  styleUrls: ['./welcome-screen.component.scss'],
})
export class WelcomeScreenComponent implements OnInit {
  private diningPreferenceService = inject(DiningPreferenceService);
  private vendorNavigation = inject(VendorNavigationService);
  private vendorService = inject(VendorService);
  readonly deliverySelection = inject(DeliverySelectionService);

  readonly vendor = toSignal(this.vendorService.currentVendor$, {
    initialValue: null as Vendor | null,
  });

  readonly enabledOrderTypes = computed<OrderType[]>(() => {
    const v = this.vendor();
    return v?.enabled_order_types?.length
      ? v.enabled_order_types
      : (['take-away', 'eat-in', 'delivery'] as OrderType[]);
  });

  readonly deliveryDropoffInputMode = computed<'address' | 'geolocation'>(() => {
    const v = this.vendor();
    return v?.delivery_dropoff_input_mode === 'geolocation'
      ? 'geolocation'
      : 'address';
  });

  // Restored initial values for the selector
  restoredPreference: OrderType | null = null;
  restoredTiming: 'asap' | 'later' | null = null;
  restoredScheduledTime: string | null = null;
  restoredTableNumber: string | null = null;

  // Current selector result
  currentSelectorResult = signal<DiningPreferenceSelectorResult | null>(null);

  // Delivery geolocation picker state
  readonly deliveryMapCenter = signal<Coordinates | null>(null);
  readonly deliveryMapConfirmed = signal<boolean>(false);
  readonly deliveryGeoLoading = signal<boolean>(false);
  readonly deliveryGeoError = signal<string | null>(null);
  private readonly deliveryGeoAttempted = signal<boolean>(false);

  ngOnInit(): void {
    const existingData = this.diningPreferenceService.diningPreferenceData();

    if (existingData) {
      const enabledTypes = this.enabledOrderTypes();
      this.restoredPreference =
        existingData.preference && enabledTypes.includes(existingData.preference)
          ? existingData.preference
          : enabledTypes[0] ?? null;
      this.restoredTiming = existingData.timing;
      this.restoredScheduledTime = existingData.scheduledTime ?? null;
      this.restoredTableNumber = existingData.tableNumber ?? null;
    }

    // If delivery is already selected and uses geolocation, attempt to center the map automatically.
    this.maybeAutofillDeliveryGeolocation();
  }

  onPreferenceSelectionChanged(result: DiningPreferenceSelectorResult): void {
    this.currentSelectorResult.set(result);

    // If delivery selected, and vendor uses geolocation, try to fetch browser position
    if (result.preference === 'delivery') {
      this.maybeAutofillDeliveryGeolocation();
    } else {
      this.deliveryMapConfirmed.set(false);
      this.deliveryMapCenter.set(null);
      this.deliveryGeoLoading.set(false);
      this.deliveryGeoError.set(null);
      this.deliveryGeoAttempted.set(false);
    }
  }

  onDeliveryCenterChange(coords: Coordinates): void {
    this.deliveryMapCenter.set(coords);
    this.deliveryMapConfirmed.set(false);
    this.deliveryGeoError.set(null);
  }

  async confirmDeliveryPosition(): Promise<void> {
    const center = this.deliveryMapCenter();
    if (!center) return;

    const deliverySystem = (this.vendor() as any)?.delivery_system === 'own' ? 'own' : 'picki';
    if (deliverySystem === 'own') {
      await this.deliverySelection.setAddressOnlyFromCoordinates(center);
    } else {
      await this.deliverySelection.setAddressFromCoordinates(center);
    }
    this.deliveryMapConfirmed.set(true);
  }

  retryDeliveryGeolocation(): void {
    this.deliveryGeoAttempted.set(false);
    this.maybeAutofillDeliveryGeolocation();
  }

  onValidate(): void {
    const result = this.currentSelectorResult();
    if (!result?.preference) return;

    // If delivery with geolocation mode, ensure geolocation confirmation
    if (
      result.preference === 'delivery' &&
      this.deliveryDropoffInputMode() === 'geolocation' &&
      !this.deliveryMapConfirmed() &&
      !this.deliverySelection.hasSelection()
    ) {
      return;
    }

    // If delivery, ensure a dropoff selection exists
    if (result.preference === 'delivery' && !this.deliverySelection.hasSelection()) {
      return;
    }

    let timing = result.timing;
    let scheduledDate: Date | undefined;
    let scheduledTime: string | undefined;

    if (timing === 'later') {
      if (result.scheduledTime) {
        scheduledDate = result.scheduledDate;
        scheduledTime = result.scheduledTime;
      } else {
        timing = null;
      }
    }

    const orderData = {
      preference: result.preference,
      timing,
      scheduledDate,
      scheduledTime,
      tableNumber: result.tableNumber,
    };

    this.diningPreferenceService.setDiningPreference(orderData);
    this.vendorNavigation.navigateWithVendor(['promotional-banner', 'products']);
  }

  get canValidate(): boolean {
    const result = this.currentSelectorResult();
    if (!result?.preference) return false;

    if (result.preference === 'delivery') {
      const hasDropoff = this.deliverySelection.hasSelection();
      if (!hasDropoff) return false;

      // For geolocation mode, also require map confirmation
      if (this.deliveryDropoffInputMode() === 'geolocation' && !this.deliveryMapConfirmed()) {
        return false;
      }
    }

    return true;
  }

  private maybeAutofillDeliveryGeolocation(): void {
    const result = this.currentSelectorResult();
    if (result?.preference !== 'delivery' && this.restoredPreference !== 'delivery') return;
    if (this.deliveryDropoffInputMode() !== 'geolocation') return;

    // If we already have a stored delivery address with coordinates, center the map on it.
    const existingAddress = this.deliverySelection.selectedAddress();
    const existingCoords = existingAddress?.coordinates ?? null;
    if (!this.deliveryMapCenter() && existingCoords) {
      this.deliveryMapCenter.set(existingCoords);
      return;
    }

    if (this.deliveryMapCenter()) return;
    if (this.deliverySelection.hasSelection()) return;
    if (this.deliveryGeoAttempted()) return;
    this.deliveryGeoAttempted.set(true);

    this.deliveryGeoError.set(null);
    this.deliveryGeoLoading.set(true);

    if (!navigator.geolocation) {
      this.deliveryGeoLoading.set(false);
      this.deliveryGeoError.set(
        "La geolocalisation n'est pas disponible sur ce navigateur."
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.deliveryGeoLoading.set(false);
        const coords: Coordinates = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        this.deliveryMapCenter.set(coords);
      },
      (err) => {
        this.deliveryGeoLoading.set(false);

        if (err.code === err.PERMISSION_DENIED) {
          this.deliveryGeoError.set(
            'Autorisation refusee. Activez la localisation pour partager votre position.'
          );
          return;
        }
        if (err.code === err.POSITION_UNAVAILABLE) {
          this.deliveryGeoError.set(
            'Position indisponible. Verifiez votre connexion ou vos services de localisation.'
          );
          return;
        }
        if (err.code === err.TIMEOUT) {
          this.deliveryGeoError.set(
            'Delai depasse lors de la recuperation de votre position. Reessayez.'
          );
          return;
        }

        this.deliveryGeoError.set(
          "Impossible d'obtenir votre position. Reessayez ou utilisez l'adresse."
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 10_000 }
    );
  }
}
