import { Injectable, signal, computed, inject } from '@angular/core';
import { FrenchDateService } from './french-date.service';

export type DiningPreference = 'eat-in' | 'take-away' | 'delivery' | null;
export type OrderTiming = 'asap' | 'later';

export interface DiningPreferenceData {
  preference: DiningPreference;
  timing: OrderTiming | null;
  scheduledDate?: Date;
  scheduledTime?: string; // Changed from Date to string to store time in HH:MM format
  tableNumber?: string;
}

@Injectable({
  providedIn: 'root',
})
export class DiningPreferenceService {
  private frenchDateService = inject(FrenchDateService);
  private _diningPreferenceData = signal<DiningPreferenceData | null>(null);
  private _hasSelectedPreference = signal<boolean>(false);

  // Public readonly signals
  readonly diningPreferenceData = this._diningPreferenceData.asReadonly();
  readonly hasSelectedPreference = this._hasSelectedPreference.asReadonly();

  // Computed signals for backward compatibility
  readonly diningPreference = computed(
    () => this._diningPreferenceData()?.preference ?? null
  );

  // Computed signal to check if user needs to select preference
  readonly needsPreferenceSelection = computed(
    () => !this._hasSelectedPreference()
  );

  setDiningPreference(data: DiningPreferenceData): void {
    this._diningPreferenceData.set(data);
    this._hasSelectedPreference.set(true);

    // Store in localStorage for persistence across sessions
    if (data.preference) {
      localStorage.setItem('dining-preference-data', JSON.stringify(data));
    }
  }

  loadStoredPreference(): void {
    const storedData = localStorage.getItem('dining-preference-data');
    if (storedData) {
      try {
        const data = JSON.parse(storedData) as DiningPreferenceData;
        // Convert date strings back to Date objects
        if (data.scheduledDate) {
          data.scheduledDate = new Date(data.scheduledDate);
        }
        // scheduledTime is already stored as string in HH:MM format, no conversion needed
        this._diningPreferenceData.set(data);
        this._hasSelectedPreference.set(true);
      } catch (e) {
        console.error('Failed to parse stored dining preference', e);
      }
    }
  }

  resetPreference(): void {
    this._diningPreferenceData.set(null);
    this._hasSelectedPreference.set(false);
    localStorage.removeItem('dining-preference-data');
    localStorage.removeItem('dining-preference'); // Clean up old format
  }

  getDiningPreferenceText(full: boolean = true): string {
    const data = this._diningPreferenceData();
    if (!data) return 'A définir';

    let text = '';
    switch (data.preference) {
      case 'eat-in':
        text = 'Sur place';
        if (full && data.tableNumber) {
          text += ` - Table ${data.tableNumber}`;
        }
        break;
      case 'take-away':
        text = 'À emporter';
        if (full) {
          if (
            data.timing === 'later' &&
            data.scheduledDate &&
            data.scheduledTime
          ) {
            const date = new Date(data.scheduledDate);
            // Parse time string in HH:MM format
            const [hours, minutes] = data.scheduledTime.split(':').map(Number);
            date.setHours(hours, minutes);

            const dateStr =
              this.frenchDateService.formatDiningPreferenceDate(date);
            const timeStr =
              this.frenchDateService.formatDiningPreferenceTime(date);
            text += ` - ${dateStr} à ${timeStr}`;
          } else if (data.timing === 'asap') {
            text += ' - Dès que possible';
          } else {
            text += ' - A définir';
          }
        }
        break;
      case 'delivery':
        text = 'Livraison';
        if (full) {
          if (
            data.timing === 'later' &&
            data.scheduledDate &&
            data.scheduledTime
          ) {
            const date = new Date(data.scheduledDate);
            // Parse time string in HH:MM format
            const [hours, minutes] = data.scheduledTime.split(':').map(Number);
            date.setHours(hours, minutes);

            const dateStr =
              this.frenchDateService.formatDiningPreferenceDate(date);
            const timeStr =
              this.frenchDateService.formatDiningPreferenceTime(date);
            text += ` - ${dateStr} à ${timeStr}`;
          } else if (data.timing === 'asap') {
            text += ' - Dès que possible';
          } else {
            text += ' - A définir';
          }
        }
        break;
    }
    return text;
  }

  getScheduledDateTime(): Date | null {
    const data = this._diningPreferenceData();
    if (
      !data ||
      data.timing !== 'later' ||
      !data.scheduledDate ||
      !data.scheduledTime
    ) {
      return null;
    }

    const dateTime = new Date(data.scheduledDate);
    // Parse time string in HH:MM format
    const [hours, minutes] = data.scheduledTime.split(':').map(Number);
    dateTime.setHours(hours, minutes);
    return dateTime;
  }
}
