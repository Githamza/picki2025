import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { materialComponents } from '../../../material.components';
import { AddressAutocompleteComponent } from '../address-autocomplete/address-autocomplete.component';
import { DeliverySelectionService } from '../../../services/delivery/delivery-selection.service';
import {
  VendorService,
  type BusinessHours,
  type OrderType,
} from '../../../services/vendor.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { VendorCurrencyPipe } from '../../pipes/vendor-currency.pipe';

export interface DiningPreferenceSelectorResult {
  preference: OrderType;
  timing: 'asap' | 'later' | null;
  scheduledDate?: Date;
  scheduledTime?: string;
  tableNumber?: string;
  isValid: boolean;
}

@Component({
  selector: 'app-dining-preference-selector',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ...materialComponents,
    AddressAutocompleteComponent,
    VendorCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dining-preference-selector.component.html',
  styleUrls: ['./dining-preference-selector.component.scss'],
  host: {
    '[class.compact]': 'compact',
  },
})
export class DiningPreferenceSelectorComponent implements OnInit {
  private fb = inject(FormBuilder);
  private vendorService = inject(VendorService);
  readonly deliverySelection = inject(DeliverySelectionService);

  @Input() enabledOrderTypes: OrderType[] = [];
  @Input() initialPreference: OrderType | null = null;
  @Input() initialTiming: 'asap' | 'later' | null = null;
  @Input() initialScheduledTime: string | null = null;
  @Input() initialTableNumber: string | null = null;
  @Input() compact = false;

  @Output() selectionChanged = new EventEmitter<DiningPreferenceSelectorResult>();

  private readonly vendor = toSignal(this.vendorService.currentVendor$, {
    initialValue: null,
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
      label: 'A emporter',
      description: 'Commander a emporter',
      ariaLabel: 'A emporter - Commander a emporter',
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
      this.enabledOrderTypes.includes(opt.type)
    )
  );

  selectedPreference: OrderType | null = null;
  selectedTiming: 'asap' | 'later' | null = null;
  selectedTime: string | null = null;
  tableNumber: string = '';

  showTimingSelection = false;
  showDateTimeSelection = false;

  // Business hours data
  businessHours = signal<BusinessHours[]>([]);
  pickupHours = signal<BusinessHours[]>([]);
  isLoadingBusinessHours = signal<boolean>(false);

  orderForm: FormGroup = this.fb.group({
    scheduledTime: [null],
  });

  // Make scheduledTime required only when "later" has available slots
  private readonly scheduledTimeRequiredEffect = effect(() => {
    const ctrl = this.orderForm.get('scheduledTime');
    if (!ctrl) return;

    const hasSlots = this.availableTimeSlots().length > 0;
    const shouldRequire = this.selectedTiming === 'later' && hasSlots;

    if (shouldRequire) {
      ctrl.setValidators([Validators.required]);
    } else {
      ctrl.clearValidators();
      if (!hasSlots) {
        ctrl.reset(null, { emitEvent: false });
      }
    }

    ctrl.updateValueAndValidity({ emitEvent: false });
  });

  // Effect to set preselected time when conditions are met
  private setPreselectedTimeEffect = effect(() => {
    const timeSlots = this.availableTimeSlots();
    const existingTime = this.selectedTime;
    const timing = this.selectedTiming;

    if (timeSlots.length > 0 && existingTime && timing === 'later') {
      if (timeSlots.includes(existingTime)) {
        const scheduledDateTime = new Date();
        const [hours, minutes] = existingTime.split(':').map(Number);
        scheduledDateTime.setHours(hours, minutes, 0, 0);

        if (scheduledDateTime > new Date()) {
          this.orderForm.patchValue({ scheduledTime: existingTime });
        }
      } else {
        this.selectedTime = null;
        this.orderForm.get('scheduledTime')?.reset();
      }
    }
  });

  // Auto-switch from ASAP to Later when outside pickup hours for take-away
  private readonly pickupHoursBlockAsapEffect = effect(() => {
    const withinPickup = this.isCurrentlyWithinPickupHours();
    if (!withinPickup && this.selectedPreference === 'take-away' && this.selectedTiming === 'asap') {
      this.selectTiming('later');
    }
  });

  // Computed signal for available time slots (today only)
  availableTimeSlots = computed<string[]>(() => {
    if (this.businessHours().length === 0) {
      return [];
    }

    const today = new Date();
    const dayOfWeek = today.getDay();
    const hours = this.getDayBusinessHours(dayOfWeek);

    if (!hours || hours.is_closed) {
      return [];
    }

    return this.generateTimeSlots(
      hours.open_time || '00:00',
      hours.close_time || '23:59',
      today
    );
  });

  // Computed signal for pickup time slots (today only, based on pickup hours)
  pickupTimeSlots = computed<string[]>(() => {
    if (this.pickupHours().length === 0) {
      return [];
    }

    const today = new Date();
    const dayOfWeek = today.getDay();
    const hours = this.pickupHours()[dayOfWeek];

    if (!hours || hours.is_closed) {
      return [];
    }

    return this.generateTimeSlots(
      hours.open_time || '00:00',
      hours.close_time || '23:59',
      today
    );
  });

  // Check if current time is within today's pickup hours
  readonly isCurrentlyWithinPickupHours = computed<boolean>(() => {
    if (this.isLoadingBusinessHours()) return true;

    const hours = this.pickupHours();
    if (hours.length === 0) return true;

    const hasAnyPickupDay = hours.some(h => h && !h.is_closed);
    if (!hasAnyPickupDay) return true;

    const now = new Date();
    const dayOfWeek = now.getDay();
    const todayHours = hours[dayOfWeek];

    if (!todayHours || todayHours.is_closed) return false;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [openH, openM] = (todayHours.open_time || '00:00').split(':').map(Number);
    const [closeH, closeM] = (todayHours.close_time || '23:59').split(':').map(Number);

    const openMinutes = openH * 60 + openM;
    let closeMinutes = closeH * 60 + closeM;
    if (closeMinutes <= openMinutes) {
      closeMinutes += 24 * 60;
    }

    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  });

  ngOnInit(): void {
    this.loadBusinessHours();

    if (this.initialPreference && this.enabledOrderTypes.includes(this.initialPreference)) {
      this.selectedPreference = this.initialPreference;
      this.showTimingSelection = true;
      this.selectedTiming = this.initialTiming;
      this.showDateTimeSelection = this.selectedTiming === 'later';

      if (this.initialScheduledTime) {
        this.selectedTime = this.initialScheduledTime;
      }
      if (this.initialTableNumber) {
        this.tableNumber = this.initialTableNumber;
      }
    } else if (this.enabledOrderTypes.length > 0) {
      this.selectPreference(this.enabledOrderTypes[0]);
    }
  }

  selectPreference(preference: OrderType): void {
    this.selectedPreference = preference;
    this.showTimingSelection = true;

    if (preference !== 'delivery') {
      this.deliverySelection.clear();
    }

    this.emitChange();
  }

  selectTiming(timing: 'asap' | 'later'): void {
    this.selectedTiming = timing;
    this.showDateTimeSelection = timing === 'later';

    if (timing === 'asap') {
      this.selectedTime = null;
      this.orderForm.get('scheduledTime')?.reset();
    }

    this.emitChange();
  }

  onScheduledTimeChange(): void {
    this.selectedTime = this.orderForm.get('scheduledTime')?.value ?? null;
    this.emitChange();
  }

  onTableNumberChange(value: string): void {
    this.tableNumber = value;
    this.emitChange();
  }

  async onAddressSelected(placeId: string): Promise<void> {
    if (this.deliverySystem() === 'own') {
      await this.deliverySelection.setAddressOnlyFromPlaceId(placeId);
    } else {
      await this.deliverySelection.setAddressFromPlaceId(placeId);
    }
    this.emitChange();
  }

  getBusinessHoursHint(): string | null {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const hours = this.getDayBusinessHours(dayOfWeek);

    if (!hours || hours.is_closed) {
      return 'Ferme aujourd\'hui';
    }

    const formatTime = (time: string | null) => {
      if (!time) return '';
      return time.substring(0, 5);
    };

    return `Horaires: ${formatTime(hours.open_time)} - ${formatTime(hours.close_time)}`;
  }

  getPickupHoursHint(): string | null {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const hours = this.pickupHours()[dayOfWeek];

    if (!hours || hours.is_closed) {
      return 'Click & Collect indisponible aujourd\'hui';
    }

    const formatTime = (time: string | null) => {
      if (!time) return '';
      return time.substring(0, 5);
    };

    return `Retrait: ${formatTime(hours.open_time)} - ${formatTime(hours.close_time)}`;
  }

  private emitChange(): void {
    if (!this.selectedPreference) return;

    let isValid = !!this.selectedPreference;

    if (this.selectedPreference === 'delivery') {
      isValid = isValid && this.deliverySelection.hasSelection();
    }

    const result: DiningPreferenceSelectorResult = {
      preference: this.selectedPreference,
      timing: this.selectedTiming,
      tableNumber: this.selectedPreference === 'eat-in' && this.tableNumber ? this.tableNumber : undefined,
      isValid,
    };

    if (this.selectedTiming === 'later' && this.isValidFutureTime()) {
      result.scheduledDate = new Date();
      result.scheduledTime = this.orderForm.get('scheduledTime')?.value;
    }

    this.selectionChanged.emit(result);
  }

  private isValidFutureTime(): boolean {
    const selectedTime = this.orderForm.get('scheduledTime')?.value;
    if (!selectedTime) return false;

    const scheduledDateTime = new Date();
    if (typeof selectedTime === 'string') {
      const [hours, minutes] = selectedTime.split(':');
      scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    }

    return scheduledDateTime > new Date();
  }

  private loadBusinessHours(): void {
    this.isLoadingBusinessHours.set(true);
    const vendor = this.vendor();

    if (!vendor) {
      this.isLoadingBusinessHours.set(false);
      return;
    }

    this.vendorService.getRestaurantInfo(vendor.id).subscribe({
      next: (restaurantInfo) => {
        if (restaurantInfo && restaurantInfo.businessHours) {
          const hours = this.mapBusinessHoursByDayIndex(restaurantInfo.businessHours);
          this.businessHours.set(hours);

          const pickup = this.vendorService.getPickupHours(restaurantInfo.businessHours);
          this.pickupHours.set(this.mapBusinessHoursByDayIndex(pickup));
        }
        this.isLoadingBusinessHours.set(false);
        this.trySetPreselectedTime();
      },
      error: () => {
        this.isLoadingBusinessHours.set(false);
      },
    });
  }

  private trySetPreselectedTime(): void {
    const timeSlots = this.availableTimeSlots();
    const existingTime = this.selectedTime;

    if (timeSlots.length > 0 && existingTime && this.selectedTiming === 'later') {
      if (timeSlots.includes(existingTime)) {
        const scheduledDateTime = new Date();
        const [hours, minutes] = existingTime.split(':').map(Number);
        scheduledDateTime.setHours(hours, minutes, 0, 0);

        if (scheduledDateTime > new Date()) {
          this.orderForm.patchValue({ scheduledTime: existingTime });
        }
      } else {
        this.selectedTime = null;
        this.orderForm.get('scheduledTime')?.reset();
      }
    }
  }

  private mapBusinessHoursByDayIndex(businessHours: BusinessHours[]): BusinessHours[] {
    const dayMap: { [key: string]: number } = {
      'Dimanche': 0,
      'Lundi': 1,
      'Mardi': 2,
      'Mercredi': 3,
      'Jeudi': 4,
      'Vendredi': 5,
      'Samedi': 6,
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

  private getDayBusinessHours(dayIndex: number): BusinessHours | null {
    const hours = this.businessHours();
    return hours[dayIndex] || null;
  }

  private generateTimeSlots(
    openTime: string,
    closeTime: string,
    selectedDate: Date
  ): string[] {
    const slots: string[] = [];
    const [openHour, openMin] = openTime.split(':').map(Number);
    let [closeHour, closeMin] = closeTime.split(':').map(Number);
    const interval = 15;

    const spansNextDay = closeHour < openHour || (closeHour === 0 && closeMin === 0);
    if (spansNextDay) {
      closeHour += 24;
    }

    const now = new Date();
    const isToday =
      selectedDate.getDate() === now.getDate() &&
      selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getFullYear() === now.getFullYear();

    let startHour = openHour;
    let startMin = openMin;

    if (isToday) {
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      const bufferMinutes = 30;

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
      const displayHour = hour % 24;

      const timeStr = `${String(displayHour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      slots.push(timeStr);
      currentMinutes += interval;
    }

    return slots;
  }
}
