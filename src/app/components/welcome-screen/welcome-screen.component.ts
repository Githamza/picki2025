import { Component, inject, ViewChild, OnInit, computed } from '@angular/core';
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
  readonly deliverySelection = inject(DeliverySelectionService);

  selectedPreference: 'eat-in' | 'take-away' | 'delivery' | null = null;
  selectedTiming: 'asap' | 'later' | null = null;
  selectedDate: Date | null = null;
  selectedTime: Date | null = null;
  minDate = new Date();

  showTimingSelection = false;
  showDateTimeSelection = false;
  showDelivery = false;

  orderForm: FormGroup = this.fb.group({
    scheduledDate: [new Date()],
    scheduledTime: [null, Validators.required],
  });

  ngOnInit(): void {
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
}
