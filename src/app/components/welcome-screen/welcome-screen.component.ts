import { Component, inject, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatButtonToggleChange } from '@angular/material/button-toggle';
import { MatDatepicker } from '@angular/material/datepicker';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { materialComponents } from '../../material.components';
import {
  DiningPreferenceService,
  DiningPreference,
} from '../../services/dining-preference.service';
import { VendorNavigationService } from '../../services/vendor-navigation.service';

@Component({
  selector: 'app-welcome-screen',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ...materialComponents],
  templateUrl: './welcome-screen.component.html',
  styleUrls: ['./welcome-screen.component.scss'],
})
export class WelcomeScreenComponent implements OnInit {
  @ViewChild('datePicker') datePicker!: MatDatepicker<Date>;

  private diningPreferenceService = inject(DiningPreferenceService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private vendorNavigation = inject(VendorNavigationService);
  private location = inject(Location);

  selectedPreference: 'eat-in' | 'take-away' | null = null;
  selectedTiming: 'asap' | 'later' | null = null;
  selectedDate: Date | null = null;
  selectedTime: Date | null = null;
  minDate = new Date();

  showTimingSelection = false;
  showDateTimeSelection = false;

  orderForm: FormGroup = this.fb.group({
    scheduledDate: [new Date()],
    scheduledTime: [null, Validators.required],
  });

  ngOnInit(): void {
    // Check if user has already made selections
    const existingData = this.diningPreferenceService.diningPreferenceData();
    if (existingData) {
      this.selectedPreference = existingData.preference;
      this.selectedTiming = existingData.timing;
      this.selectedDate = existingData.scheduledDate || null;
      this.selectedTime = existingData.scheduledTime || null;
      this.showTimingSelection = true;
      this.showDateTimeSelection = this.selectedTiming === 'later';
    }
  }

  selectPreference(preference: 'eat-in' | 'take-away') {
    this.selectedPreference = preference;
    this.showTimingSelection = true;
  }

  selectTiming(timing: 'asap' | 'later') {
    this.selectedTiming = timing;
    this.showDateTimeSelection = timing === 'later';

    if (timing === 'asap') {
      this.selectedDate = null;
      this.selectedTime = null;
      this.proceedToMenu();
    }
  }

  onDateTimeSelected() {
    if (this.selectedDate && this.selectedTime) {
      this.proceedToMenu();
    }
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
    if (this.datePicker) {
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
}
