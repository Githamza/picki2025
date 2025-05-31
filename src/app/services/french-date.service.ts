import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class FrenchDateService {
  private readonly locale = 'fr-FR';

  /**
   * Format time in French format (HH:mm)
   */
  formatTime(date: Date): string {
    return new Intl.DateTimeFormat(this.locale, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  /**
   * Format date in French format with smart relative dates
   */
  formatDate(date: Date): string {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return "Aujourd'hui";
    }

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    if (isTomorrow) {
      return 'Demain';
    }

    return new Intl.DateTimeFormat(this.locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(date);
  }

  /**
   * Format full date and time in French
   */
  formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat(this.locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  /**
   * Format relative time in French (e.g., "Il y a 5 min")
   */
  formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) {
      return "À l'instant";
    } else if (diffInMinutes < 60) {
      return `Il y a ${diffInMinutes} min`;
    } else if (diffInMinutes < 1440) {
      // Less than 24 hours
      const hours = Math.floor(diffInMinutes / 60);
      return `Il y a ${hours}h`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
    }
  }

  /**
   * Format short date for display (e.g., "15 jan")
   */
  formatShortDate(date: Date): string {
    return new Intl.DateTimeFormat(this.locale, {
      day: 'numeric',
      month: 'short',
    }).format(date);
  }

  /**
   * Format date for dining preference display
   */
  formatDiningPreferenceDate(date: Date): string {
    return new Intl.DateTimeFormat(this.locale, {
      month: 'short',
      day: 'numeric',
    }).format(date);
  }

  /**
   * Format time for dining preference display (24h format)
   */
  formatDiningPreferenceTime(date: Date): string {
    return new Intl.DateTimeFormat(this.locale, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  /**
   * Check if a date is today
   */
  isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  /**
   * Check if a date is tomorrow
   */
  isTomorrow(date: Date): boolean {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date.toDateString() === tomorrow.toDateString();
  }

  /**
   * Get French day name
   */
  getDayName(date: Date): string {
    return new Intl.DateTimeFormat(this.locale, {
      weekday: 'long',
    }).format(date);
  }

  /**
   * Get French month name
   */
  getMonthName(date: Date): string {
    return new Intl.DateTimeFormat(this.locale, {
      month: 'long',
    }).format(date);
  }
}
