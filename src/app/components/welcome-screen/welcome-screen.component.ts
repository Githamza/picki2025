import { Component, inject, ViewChild, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatDatepicker } from '@angular/material/datepicker';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { materialComponents } from '../../material.components';
import { AddressAutocompleteComponent } from '../../shared/components/address-autocomplete/address-autocomplete.component';
import { DeliverySelectionService } from '../../services/delivery/delivery-selection.service';
import { DiningPreferenceService } from '../../services/dining-preference.service';
import { VendorNavigationService } from '../../services/vendor-navigation.service';
import { VendorService, type BusinessHours } from '../../services/vendor.service';
import { DeliveryQuote } from '../../services/delivery/delivery.types';

@Component({
  selector: 'app-welcome-screen',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ...materialComponents,
    AddressAutocompleteComponent,
  ],
  templateUrl: './welcome-screen.component.html',
  styleUrls: ['./welcome-screen.component.scss'],
})
export class WelcomeScreenComponent implements OnInit {
  @ViewChild('datePicker') datePicker!: MatDatepicker<Date>;
  @ViewChild('datePicker2') datePicker2!: MatDatepicker<Date>;

  private diningPreferenceService = inject(DiningPreferenceService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private vendorNavigation = inject(VendorNavigationService);
  private location = inject(Location);
  private vendorService = inject(VendorService);
  readonly deliverySelection = inject(DeliverySelectionService);

  selectedPreference: 'eat-in' | 'take-away' | 'delivery' | null = null;
  selectedTiming: 'asap' | 'later' | null = null;
  selectedDate: Date | null = null;
  selectedTime: Date | null = null;
  minDate = new Date();

  showTimingSelection = false;
  showDateTimeSelection = false;
  showDelivery = false;

  // Business hours data
  businessHours = signal<BusinessHours[]>([]);
  isLoadingBusinessHours = signal<boolean>(false);

  orderForm: FormGroup = this.fb.group({
    scheduledDate: [new Date()],
    scheduledTime: [null, Validators.required],
  });

  // Date filter to disable closed days
  dateFilter = (date: Date | null): boolean => {
    if (!date) return true;
    
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hours = this.getDayBusinessHours(dayOfWeek);
    
    // Allow if restaurant is open on this day
    return hours ? !hours.is_closed : true;
  };

  // Computed signal for available time slots
  availableTimeSlots = computed<string[]>(() => {
    const selectedDate = this.orderForm.get('scheduledDate')?.value;
    if (!selectedDate || this.businessHours().length === 0) {
      return [];
    }
    
    const dayOfWeek = selectedDate.getDay();
    const hours = this.getDayBusinessHours(dayOfWeek);
    
    if (!hours || hours.is_closed) {
      return [];
    }
    
    return this.generateTimeSlots(
      hours.open_time || '00:00',
      hours.close_time || '23:59',
      selectedDate
    );
  });

  ngOnInit(): void {
    // Load business hours
    this.loadBusinessHours();

    // Check if user has already made selections
    const existingData = this.diningPreferenceService.diningPreferenceData();
    this.showDelivery = existingData?.preference === 'delivery';

    if (existingData) {
      this.selectedPreference = existingData.preference;
      this.selectedTiming = existingData.timing;
      this.selectedDate = existingData.scheduledDate || null;
      this.selectedTime = existingData.scheduledTime || null;
      this.showTimingSelection = true;
      this.showDateTimeSelection = this.selectedTiming === 'later';
    }

    // Set default timing to 'asap' for take-away and delivery if no timing is set
    if (
      this.selectedPreference &&
      (this.selectedPreference === 'take-away' ||
        this.selectedPreference === 'delivery') &&
      !this.selectedTiming
    ) {
      this.selectedTiming = 'asap';
    }

    // Reset time when date changes
    this.orderForm.get('scheduledDate')?.valueChanges.subscribe(() => {
      this.orderForm.get('scheduledTime')?.reset();
    });
  }

  selectPreference(preference: 'eat-in' | 'take-away' | 'delivery') {
    this.selectedPreference = preference;
    this.showTimingSelection = true;
    this.showDelivery = preference === 'delivery';

    // Set timing to 'asap' by default for take-away and delivery
    if (preference === 'take-away' || preference === 'delivery') {
      this.selectedTiming = 'asap';
    }
  }

  selectTiming(timing: 'asap' | 'later') {
    this.selectedTiming = timing;
    this.showDateTimeSelection = timing === 'later';

    if (timing === 'asap') {
      this.selectedDate = null;
      this.selectedTime = null;
    }
  }

  onDateTimeSelected() {
    if (this.selectedDate && this.selectedTime) {
      this.proceedToMenu();
    }
  }

  onAddressSelected(placeId: string): void {
    this.deliverySelection.setAddressFromPlaceId(placeId);
  }

  private proceedToMenu() {
    if (this.selectedPreference && this.selectedTiming) {
      const preferenceData = {
        preference: this.selectedPreference,
        timing: this.selectedTiming as 'asap' | 'later',
        scheduledDate: this.selectedDate || undefined,
        scheduledTime: this.selectedTime || undefined,
      };

      this.diningPreferenceService.setDiningPreference(preferenceData);
      this.vendorNavigation.navigateWithVendor('products');
    }
  }

  canProceed(): boolean {
    if (!this.selectedPreference || !this.selectedTiming) {
      return false;
    }

    if (this.selectedTiming === 'later') {
      return !!(this.selectedDate && this.selectedTime);
    }

    return this.selectedTiming === 'asap';
  }

  openDatePicker(): void {
    if (this.selectedPreference === 'delivery' && this.datePicker2) {
      this.datePicker2.open();
    } else if (this.datePicker) {
      this.datePicker.open();
    }
  }

  onValidate(): void {
    if (!this.selectedPreference) return;

    const orderData = {
      preference: this.selectedPreference,
      timing: this.selectedTiming as 'asap' | 'later',
      scheduledDate:
        this.selectedTiming === 'later'
          ? this.orderForm.get('scheduledDate')?.value
          : undefined,
      scheduledTime:
        this.selectedTiming === 'later'
          ? this.orderForm.get('scheduledTime')?.value
          : undefined,
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
    this.vendorNavigation.navigateWithVendor('products');
  }

  get canValidate(): boolean {
    if (!this.selectedPreference) return false;

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
    const selectedDate = this.orderForm.get('scheduledDate')?.value;
    const selectedTime = this.orderForm.get('scheduledTime')?.value;

    if (!selectedDate || !selectedTime) return false;

    // Create a combined date-time
    const scheduledDateTime = new Date(selectedDate);

    // Handle time value based on its type
    if (selectedTime instanceof Date) {
      // If time is a Date object from mat-timepicker
      scheduledDateTime.setHours(selectedTime.getHours());
      scheduledDateTime.setMinutes(selectedTime.getMinutes());
    } else if (typeof selectedTime === 'string') {
      // If time is still a string (fallback for HTML time input)
      const [hours, minutes] = selectedTime.split(':');
      scheduledDateTime.setHours(parseInt(hours), parseInt(minutes));
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
    const vendor = this.vendorService.getCurrentVendor();
    
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
      'Sunday': 0,
      'Monday': 1,
      'Tuesday': 2,
      'Wednesday': 3,
      'Thursday': 4,
      'Friday': 5,
      'Saturday': 6
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
    const slots: string[] = [];
    const [openHour, openMin] = openTime.split(':').map(Number);
    const [closeHour, closeMin] = closeTime.split(':').map(Number);
    const interval = 15; // 15-minute intervals
    
    const now = new Date();
    const isToday = 
      selectedDate.getDate() === now.getDate() &&
      selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getFullYear() === now.getFullYear();
    
    let startHour = openHour;
    let startMin = openMin;
    
    // If today, start from current time + buffer
    if (isToday) {
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      const bufferMinutes = 30; // 30 min minimum preparation time
      
      const totalCurrentMinutes = currentHour * 60 + currentMin + bufferMinutes;
      const totalOpenMinutes = openHour * 60 + openMin;
      
      if (totalCurrentMinutes > totalOpenMinutes) {
        startHour = Math.floor(totalCurrentMinutes / 60);
        startMin = Math.ceil((totalCurrentMinutes % 60) / interval) * interval;
        
        if (startMin >= 60) {
          startHour += 1;
          startMin = 0;
        }
      }
    }
    
    const totalEndMinutes = closeHour * 60 + closeMin;
    let currentMinutes = startHour * 60 + startMin;
    
    while (currentMinutes <= totalEndMinutes) {
      const hour = Math.floor(currentMinutes / 60);
      const min = currentMinutes % 60;
      
      // Don't include slots past closing time
      if (hour > closeHour || (hour === closeHour && min > closeMin)) {
        break;
      }
      
      const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      slots.push(timeStr);
      currentMinutes += interval;
    }
    
    return slots;
  }

  // Get business hours hint text
  getBusinessHoursHint(): string | null {
    const selectedDate = this.orderForm.get('scheduledDate')?.value;
    if (!selectedDate) return null;
    
    const dayOfWeek = selectedDate.getDay();
    const hours = this.getDayBusinessHours(dayOfWeek);
    
    if (!hours || hours.is_closed) {
      return 'Fermé ce jour';
    }
    
    return `Horaires: ${hours.open_time} - ${hours.close_time}`;
  }
}
