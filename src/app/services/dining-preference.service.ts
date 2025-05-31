import { Injectable, signal, computed, inject } from '@angular/core';
import { FrenchDateService } from './french-date.service';

export type DiningPreference = 'eat-in' | 'take-away' | null;
export type OrderTiming = 'asap' | 'later';

export interface DiningPreferenceData {
  preference: DiningPreference;
  timing: OrderTiming;
  scheduledDate?: Date;
  scheduledTime?: Date;
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
        if (data.scheduledTime) {
          data.scheduledTime = new Date(data.scheduledTime);
        }
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

  getDiningPreferenceText(): string {
    const data = this._diningPreferenceData();
    if (!data) return '';

    let text = '';
    switch (data.preference) {
      case 'eat-in':
        text = 'Sur place';
        break;
      case 'take-away':
        text = 'À emporter';
        if (
          data.timing === 'later' &&
          data.scheduledDate &&
          data.scheduledTime
        ) {
          const date = new Date(data.scheduledDate);
          const time = new Date(data.scheduledTime);
          date.setHours(time.getHours(), time.getMinutes());

          const dateStr =
            this.frenchDateService.formatDiningPreferenceDate(date);
          const timeStr =
            this.frenchDateService.formatDiningPreferenceTime(date);
          text += ` - ${dateStr} à ${timeStr}`;
        } else if (data.timing === 'asap') {
          text += ' - Dès que possible';
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
    const time = new Date(data.scheduledTime);
    dateTime.setHours(time.getHours(), time.getMinutes());
    return dateTime;
  }
}
