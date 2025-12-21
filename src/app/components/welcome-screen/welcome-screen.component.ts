import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  computed,
  effect,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { materialComponents } from '../../material.components';
import { AddressAutocompleteComponent } from '../../shared/components/address-autocomplete/address-autocomplete.component';
import { MapLocationPickerComponent } from '../../shared/components/map-location-picker/map-location-picker.component';
import { DeliverySelectionService } from '../../services/delivery/delivery-selection.service';
import { DiningPreferenceService } from '../../services/dining-preference.service';
import { VendorNavigationService } from '../../services/vendor-navigation.service';
import {
  VendorService,
  type BusinessHours,
  type OrderType,
  type Vendor,
} from '../../services/vendor.service';
import { Coordinates, DeliveryQuote } from '../../services/delivery/delivery.types';
import { PromotionalBannerComponent } from '../promotional-banner/promotional-banner.component';
import { VendorCurrencyPipe } from '../../shared/pipes/vendor-currency.pipe';

@Component({
  selector: 'app-welcome-screen',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ...materialComponents,
    AddressAutocompleteComponent,
    MapLocationPickerComponent,
    PromotionalBannerComponent,
    VendorCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './welcome-screen.component.html',
  styleUrls: ['./welcome-screen.component.scss'],
})
export class WelcomeScreenComponent implements OnInit {
  private diningPreferenceService = inject(DiningPreferenceService);
  private fb = inject(FormBuilder);
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

  readonly deliverySystem = computed<'picki' | 'own'>(() => {
    const v = this.vendor();
    return (v as any)?.delivery_system === 'own' ? 'own' : 'picki';
  });

  readonly ownDeliveryPrice = computed<number>(() => {
    const v = this.vendor();
    return Number((v as any)?.own_delivery_price ?? 0);
  });

  readonly orderTypeOptions = [
    {
      type: 'take-away' as const,
      icon: 'takeout_dining',
      label: 'À emporter',
      description: 'Commander à emporter',
      ariaLabel: 'À emporter - Commander à emporter',
    },
    {
      type: 'eat-in' as const,
      icon: 'restaurant',
      label: 'Sur place',
      description: 'Commander sur place',
      ariaLabel: 'Sur place - Commander sur place',
    },
    {
      type: 'delivery' as const,
      icon: 'local_shipping',
      label: 'Livraison',
      description: 'Se faire livrer',
      ariaLabel: 'Livraison - Se faire livrer',
    },
  ] satisfies ReadonlyArray<{
    type: OrderType;
    icon: string;
    label: string;
    description: string;
    ariaLabel: string;
  }>;

  readonly visibleOrderTypeOptions = computed(() =>
    this.orderTypeOptions.filter((opt) =>
      this.enabledOrderTypes().includes(opt.type)
    )
  );

  selectedPreference: OrderType | null = null;
  selectedTiming: 'asap' | 'later' | null = null;
  selectedTime: string | null = null;

  showTimingSelection = false;
  showDateTimeSelection = false;

  // Delivery geolocation picker state
  readonly deliveryMapCenter = signal<Coordinates | null>(null);
  readonly deliveryMapConfirmed = signal<boolean>(false);
  readonly deliveryGeoLoading = signal<boolean>(false);
  readonly deliveryGeoError = signal<string | null>(null);
  private readonly deliveryGeoAttempted = signal<boolean>(false);

  // Business hours data
  businessHours = signal<BusinessHours[]>([]);
  isLoadingBusinessHours = signal<boolean>(false);

  orderForm: FormGroup = this.fb.group({
    scheduledTime: [null, Validators.required],
  });

  // Effect to set preselected time when conditions are met
  private setPreselectedTimeEffect = effect(() => {
    const timeSlots = this.availableTimeSlots();
    const existingTime = this.selectedTime;
    const timing = this.selectedTiming;
    
    console.log('Preselected time effect triggered:', {
      timeSlots: timeSlots.length,
      existingTime,
      timing,
      conditionsMet: timeSlots.length > 0 && existingTime && timing === 'later'
    });
    
    // Only proceed if we have time slots, an existing time, and 'later' timing
    if (timeSlots.length > 0 && existingTime && timing === 'later') {
      // Check if the existing time is available in the current slots
      if (timeSlots.includes(existingTime)) {
        // Additional check: make sure the time is not in the past
        const scheduledDateTime = new Date();
        const [hours, minutes] = existingTime.split(':').map(Number);
        scheduledDateTime.setHours(hours, minutes, 0, 0);
        
        if (scheduledDateTime > new Date()) {
          console.log('Setting form value to preselected time:', existingTime);
          // Set the form control value to preselect the dropdown
          this.orderForm.patchValue({
            scheduledTime: existingTime
          });
        } else {
          console.warn(`Stored time ${existingTime} is in the past, not preselecting`);
          // Don't preselect past times, but keep the stored value in case user wants to see what they had
        }
      } else {
        // If the stored time is not available (e.g., outside business hours), reset it
        console.warn(`Stored time ${existingTime} is not available in current time slots`);
        this.selectedTime = null;
        this.orderForm.get('scheduledTime')?.reset();
      }
    }
  });

  // Keep selected preference compatible with enabled modes
  private readonly ensurePreferenceEnabledEffect = effect(() => {
    const enabled = this.enabledOrderTypes();
    if (!enabled.length) return;

    if (!this.selectedPreference || !enabled.includes(this.selectedPreference)) {
      this.selectPreference(enabled[0]);
    }
  });

  // Computed signal for available time slots (today only)
  availableTimeSlots = computed<string[]>(() => {
    console.log('🕐 Computing available time slots...');
    console.log('📊 Business hours length:', this.businessHours().length);
    console.log('📊 Business hours:', this.businessHours());
    
    if (this.businessHours().length === 0) {
      console.log('⚠️ No business hours available');
      return [];
    }
    
    const today = new Date();
    const dayOfWeek = today.getDay();
    console.log('📅 Today is day index:', dayOfWeek);
    
    const hours = this.getDayBusinessHours(dayOfWeek);
    console.log('🕐 Hours for today:', hours);
    
    if (!hours || hours.is_closed) {
      console.log('❌ Restaurant is closed or no hours found');
      return [];
    }
    
    console.log('✅ Generating time slots:', {
      openTime: hours.open_time,
      closeTime: hours.close_time
    });
    
    const slots = this.generateTimeSlots(
      hours.open_time || '00:00',
      hours.close_time || '23:59',
      today
    );
    
    console.log('🎯 Generated slots:', slots);
    return slots;
  });

  ngOnInit(): void {
    // Load business hours
    this.loadBusinessHours();
    // Check if user has already made selections
    const existingData = this.diningPreferenceService.diningPreferenceData();
    const enabledTypes = this.enabledOrderTypes();
    const fallbackPreference = enabledTypes[0] ?? null;

    if (existingData) {
      this.selectedPreference =
        existingData.preference && enabledTypes.includes(existingData.preference)
          ? existingData.preference
          : fallbackPreference;
      this.selectedTiming = existingData.timing;
      
      // If a time string was stored, use it
      if (existingData.scheduledTime) {
        console.log('Setting selectedTime from existing data:', existingData.scheduledTime);
        this.selectedTime = existingData.scheduledTime;
      }
      
      this.showTimingSelection = true;
      this.showDateTimeSelection = this.selectedTiming === 'later';
    } else if (fallbackPreference) {
      this.selectPreference(fallbackPreference);
    }

    // Set default timing to 'asap' for take-away and delivery if no timing is set
    if (
      this.selectedPreference &&
      (this.selectedPreference === 'take-away' || this.selectedPreference === 'delivery') &&
      !this.selectedTiming
    ) {
      this.selectedTiming = 'asap';
    }

    // If delivery is already selected and uses geolocation, attempt to center the map automatically.
    this.maybeAutofillDeliveryGeolocation();
  }

  selectPreference(preference: OrderType) {
    this.selectedPreference = preference;
    this.showTimingSelection = true;

    // Set timing to 'asap' by default for take-away and delivery
    if (preference === 'take-away' || preference === 'delivery') {
      this.selectedTiming = 'asap';
    }

    // Reset delivery selection state when switching away from delivery
    if (preference !== 'delivery') {
      this.deliverySelection.clear();
      this.deliveryMapConfirmed.set(false);
      this.deliveryMapCenter.set(null);
      this.deliveryGeoLoading.set(false);
      this.deliveryGeoError.set(null);
      this.deliveryGeoAttempted.set(false);
      return;
    }

    // Delivery selected: if vendor uses geolocation, try to fetch browser position automatically.
    this.maybeAutofillDeliveryGeolocation();
  }

  selectTiming(timing: 'asap' | 'later') {
    this.selectedTiming = timing;
    this.showDateTimeSelection = timing === 'later';

    if (timing === 'asap') {
      this.selectedTime = null;
      this.orderForm.get('scheduledTime')?.reset();
    }
  }

  // Method to manually set preselected time (useful for debugging or explicit calls)
  private setPreselectedTime(): void {
    const timeSlots = this.availableTimeSlots();
    const existingTime = this.selectedTime;
    
    console.log('Manual setPreselectedTime called:', {
      timeSlots: timeSlots.length,
      existingTime,
      timing: this.selectedTiming
    });
    
    if (timeSlots.length > 0 && existingTime && this.selectedTiming === 'later') {
      if (timeSlots.includes(existingTime)) {
        // Additional check: make sure the time is not in the past
        const scheduledDateTime = new Date();
        const [hours, minutes] = existingTime.split(':').map(Number);
        scheduledDateTime.setHours(hours, minutes, 0, 0);
        
        if (scheduledDateTime > new Date()) {
          console.log('Setting form value manually to:', existingTime);
          this.orderForm.patchValue({
            scheduledTime: existingTime
          });
        } else {
          console.warn(`Time ${existingTime} is in the past, not preselecting`);
        }
      } else {
        console.warn(`Time ${existingTime} not available in current slots`);
        this.selectedTime = null;
        this.orderForm.get('scheduledTime')?.reset();
      }
    }
  }

  onAddressSelected(placeId: string): void {
    this.deliveryMapConfirmed.set(false);
    if (this.deliverySystem() === 'own') {
      void this.deliverySelection.setAddressOnlyFromPlaceId(placeId);
      return;
    }
    void this.deliverySelection.setAddressFromPlaceId(placeId);
  }

  onDeliveryCenterChange(coords: Coordinates): void {
    this.deliveryMapCenter.set(coords);
    this.deliveryMapConfirmed.set(false);
    this.deliveryGeoError.set(null);
  }

  async confirmDeliveryPosition(): Promise<void> {
    const center = this.deliveryMapCenter();
    if (!center) return;
    if (this.deliverySystem() === 'own') {
      await this.deliverySelection.setAddressOnlyFromCoordinates(center);
      this.deliveryMapConfirmed.set(true);
      return;
    }
    await this.deliverySelection.setAddressFromCoordinates(center);
    this.deliveryMapConfirmed.set(true);
  }

  retryDeliveryGeolocation(): void {
    this.deliveryGeoAttempted.set(false);
    this.maybeAutofillDeliveryGeolocation();
  }

  private maybeAutofillDeliveryGeolocation(): void {
    if (this.selectedPreference !== 'delivery') return;
    if (this.deliveryDropoffInputMode() !== 'geolocation') return;

    // If we already have a stored delivery address with coordinates, center the map on it.
    const existingAddress = this.deliverySelection.selectedAddress();
    const existingCoords = existingAddress?.coordinates ?? null;
    if (!this.deliveryMapCenter() && existingCoords) {
      this.deliveryMapCenter.set(existingCoords);
      return;
    }

    // Don't override an already chosen map center or an already selected address.
    if (this.deliveryMapCenter()) return;
    if (this.deliverySelection.hasSelection()) return;

    // Avoid repeatedly prompting the user.
    if (this.deliveryGeoAttempted()) return;
    this.deliveryGeoAttempted.set(true);

    this.deliveryGeoError.set(null);
    this.deliveryGeoLoading.set(true);

    if (!navigator.geolocation) {
      this.deliveryGeoLoading.set(false);
      this.deliveryGeoError.set(
        "La géolocalisation n'est pas disponible sur ce navigateur."
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
            'Autorisation refusée. Activez la localisation pour partager votre position.'
          );
          return;
        }
        if (err.code === err.POSITION_UNAVAILABLE) {
          this.deliveryGeoError.set(
            'Position indisponible. Vérifiez votre connexion ou vos services de localisation.'
          );
          return;
        }
        if (err.code === err.TIMEOUT) {
          this.deliveryGeoError.set(
            "Délai dépassé lors de la récupération de votre position. Réessayez."
          );
          return;
        }

        this.deliveryGeoError.set(
          "Impossible d'obtenir votre position. Réessayez ou utilisez l'adresse."
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 10_000 }
    );
  }

  onValidate(): void {
    if (!this.selectedPreference) return;

    const selectedTimeValue = this.orderForm.get('scheduledTime')?.value;
    
    const orderData = {
      preference: this.selectedPreference,
      timing: this.selectedTiming as 'asap' | 'later',
      scheduledDate:
        this.selectedTiming === 'later' ? new Date() : undefined,
      scheduledTime:
        this.selectedTiming === 'later' ? selectedTimeValue : undefined,
    };

    // Validate scheduled time is not in the past
    if (this.selectedTiming === 'later') {
      if (!this.isValidFutureTime()) {
        return; // Don't proceed if scheduled time is in the past
      }
    }

    // Store the complete dining preference data
    this.diningPreferenceService.setDiningPreference(orderData);
    // Navigate back to vendor products page
    this.vendorNavigation.navigateWithVendor(['promotional-banner']);
  }

  get canValidate(): boolean {
    if (!this.selectedPreference) return false;

    if (this.selectedPreference === 'delivery') {
      // Delivery always needs a dropoff selection (address or reverse-geocoded position)
      const hasDropoff = this.deliverySelection.hasSelection();
      if (!hasDropoff) return false;
    }

    if (
      this.selectedPreference === 'eat-in' ||
      this.selectedTiming === 'asap'
    ) {
      return true;
    }

    if (this.selectedTiming === 'later') {
      return this.orderForm.valid && this.isValidFutureTime();
    }

    return false;
  }

  private isValidFutureTime(): boolean {
    const selectedTime = this.orderForm.get('scheduledTime')?.value;

    if (!selectedTime) return false;

    // Create a combined date-time for today
    const scheduledDateTime = new Date();

    // Parse the time string (format: "HH:MM")
    if (typeof selectedTime === 'string') {
      const [hours, minutes] = selectedTime.split(':');
      scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    }

    return scheduledDateTime > new Date();
  }

  // TrackBy function for delivery quotes list
  trackByProviderId(index: number, quote: DeliveryQuote): string {
    return quote.providerId;
  }

  // Load business hours from vendor service
  private loadBusinessHours(): void {
    this.isLoadingBusinessHours.set(true);
    const vendor = this.vendor();
    
    if (!vendor) {
      console.warn('No vendor found for loading business hours');
      this.isLoadingBusinessHours.set(false);
      return;
    }

    this.vendorService.getRestaurantInfo(vendor.id).subscribe({
      next: (restaurantInfo) => {
        if (restaurantInfo && restaurantInfo.businessHours) {
          // Convert day names to indexed array (Sunday = 0, Monday = 1, etc.)
          const hours = this.mapBusinessHoursByDayIndex(restaurantInfo.businessHours);
          this.businessHours.set(hours);
        }
        this.isLoadingBusinessHours.set(false);
        // Try to set preselected time after business hours are loaded
        this.setPreselectedTime();
      },
      error: (error) => {
        console.error('Error loading business hours:', error);
        this.isLoadingBusinessHours.set(false);
      }
    });
  }

  // Map business hours by day index
  private mapBusinessHoursByDayIndex(businessHours: BusinessHours[]): BusinessHours[] {
    const dayMap: { [key: string]: number } = {
      'Dimanche': 0,    // Sunday
      'Lundi': 1,       // Monday
      'Mardi': 2,       // Tuesday
      'Mercredi': 3,    // Wednesday
      'Jeudi': 4,       // Thursday
      'Vendredi': 5,    // Friday
      'Samedi': 6       // Saturday
    };

    const hoursArray: BusinessHours[] = new Array(7);
    
    businessHours.forEach(hours => {
      const index = dayMap[hours.day];
      if (index !== undefined) {
        hoursArray[index] = hours;
      }
    });

    return hoursArray;
  }

  // Get business hours for a specific day
  private getDayBusinessHours(dayIndex: number): BusinessHours | null {
    const hours = this.businessHours();
    return hours[dayIndex] || null;
  }

  // Generate time slots based on business hours
  private generateTimeSlots(
    openTime: string,
    closeTime: string,
    selectedDate: Date
  ): string[] {
    console.log('🎰 generateTimeSlots called with:', { openTime, closeTime, selectedDate });
    
    const slots: string[] = [];
    // Handle HH:MM:SS format (split and take first two parts)
    const [openHour, openMin] = openTime.split(':').map(Number);
    let [closeHour, closeMin] = closeTime.split(':').map(Number);
    const interval = 15; // 15-minute intervals
    
    // Handle times that span midnight (close time is next day)
    // If close time is less than open time, it means it's past midnight
    const spansNextDay = closeHour < openHour || (closeHour === 0 && closeMin === 0);
    if (spansNextDay) {
      closeHour += 24; // Add 24 hours to handle next day
    }
    
    console.log('⏰ Parsed times:', { 
      openHour, 
      openMin, 
      closeHour, 
      closeMin,
      spansNextDay 
    });
    
    const now = new Date();
    const isToday = 
      selectedDate.getDate() === now.getDate() &&
      selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getFullYear() === now.getFullYear();
    
    console.log('📅 Is today:', isToday, 'Current time:', now.toLocaleTimeString());
    
    let startHour = openHour;
    let startMin = openMin;
    
    // If today, start from current time + buffer
    if (isToday) {
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      const bufferMinutes = 30; // 30 min minimum preparation time
      
      const totalCurrentMinutes = currentHour * 60 + currentMin + bufferMinutes;
      const totalOpenMinutes = openHour * 60 + openMin;
      
      console.log('🕐 Current calculation:', {
        currentHour,
        currentMin,
        totalCurrentMinutes,
        totalOpenMinutes
      });
      
      if (totalCurrentMinutes > totalOpenMinutes) {
        startHour = Math.floor(totalCurrentMinutes / 60);
        startMin = Math.ceil((totalCurrentMinutes % 60) / interval) * interval;
        
        if (startMin >= 60) {
          startHour += 1;
          startMin = 0;
        }
        console.log('⏰ Adjusted start time:', { startHour, startMin });
      }
    }
    
    const totalEndMinutes = closeHour * 60 + closeMin;
    let currentMinutes = startHour * 60 + startMin;
    
    console.log('🔄 Loop params:', { totalEndMinutes, currentMinutes });
    
    while (currentMinutes <= totalEndMinutes) {
      const hour = Math.floor(currentMinutes / 60);
      const min = currentMinutes % 60;
      
      // For display, convert back to 24-hour format
      const displayHour = hour % 24;
      
      const timeStr = `${String(displayHour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      slots.push(timeStr);
      currentMinutes += interval;
    }
    
    console.log('✅ Total slots generated:', slots.length);
    return slots;
  }

  // Get business hours hint text (for today)
  getBusinessHoursHint(): string | null {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const hours = this.getDayBusinessHours(dayOfWeek);
    
    if (!hours || hours.is_closed) {
      return 'Fermé aujourd\'hui';
    }
    
    // Format time to remove seconds (HH:MM:SS -> HH:MM)
    const formatTime = (time: string | null) => {
      if (!time) return '';
      return time.substring(0, 5); // Take only HH:MM
    };
    
    return `Horaires: ${formatTime(hours.open_time)} - ${formatTime(hours.close_time)}`;
  }
}
