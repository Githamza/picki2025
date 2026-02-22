import { Injectable, inject, signal } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { VendorService, BusinessHours } from './vendor.service';
import { RestaurantClosedDialogComponent } from '../components/restaurant-closed-dialog/restaurant-closed-dialog.component';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class RestaurantStatusService {
  private vendorService = inject(VendorService);
  private dialog = inject(MatDialog);

  private dialogShownSubject = new BehaviorSubject<boolean>(false);
  public dialogShown$ = this.dialogShownSubject.asObservable();

  /** True when the restaurant is outside its business hours for the current day. */
  readonly closedForDay = signal(false);

  /**
   * Check if restaurant is currently open (at least one vendor is active)
   */
  isRestaurantOpen(): boolean {
    return !this.vendorService.getCurrentOrdersSuspendedStatus();
  }

  /**
   * Check if restaurant is closed (all vendors are inactive)
   */
  isRestaurantClosed(): boolean {
    return this.vendorService.getCurrentOrdersSuspendedStatus();
  }

  /**
   * Get the number of active vendors
   */
  getActiveVendorsCount(): number {
    return this.vendorService.getActiveVendorsCount();
  }

  /**
   * Get the total number of vendors
   */
  getTotalVendorsCount(): number {
    return this.vendorService.getTotalVendorsCount();
  }

  /**
   * Show the restaurant closed dialog
   * Returns a promise that resolves when the dialog is closed
   */
  showRestaurantClosedDialog(): Promise<void> {
    return new Promise((resolve) => {
      if (this.dialogShownSubject.value) {
        resolve();
        return;
      }

      this.dialogShownSubject.next(true);

      const currentVendor = this.vendorService.getCurrentVendor();

      const dialogRef = this.dialog.open(RestaurantClosedDialogComponent, {
        width: '90%',
        maxWidth: '450px',
        disableClose: false,
        panelClass: 'restaurant-closed-dialog-panel',
        autoFocus: true,
        restoreFocus: true,
        data: {
          closedMessage: currentVendor?.closed_message || undefined,
          closedDescription: currentVendor?.closed_description || undefined,
        },
      });

      dialogRef.afterClosed().subscribe(() => {
        this.dialogShownSubject.next(false);
        resolve();
      });
    });
  }

  /**
   * Check restaurant status and show dialog if closed
   * Returns true if restaurant is open, false if closed
   */
  async checkAndShowIfClosed(): Promise<boolean> {
    try {
      await this.vendorService.loadVendors();

      const withinHours = await this.isWithinBusinessHours();
      if (!withinHours) {
        await this.showRestaurantClosedDialog();
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking restaurant status:', error);
      return false;
    }
  }

  /**
   * Validate if an action can proceed (restaurant must be open)
   * Shows dialog if restaurant is closed
   */
  async validateRestaurantOpen(): Promise<boolean> {
    const withinHours = await this.isWithinBusinessHours();
    if (!withinHours) {
      await this.showRestaurantClosedDialog();
      return false;
    }

    return true;
  }

  /**
   * Check if the current time falls within the restaurant's regular business hours.
   * Uses open_time / close_time (NOT pickup / click & collect hours).
   */
  private async isWithinBusinessHours(): Promise<boolean> {
    try {
      const restaurantInfo = await firstValueFrom(
        this.vendorService.getRestaurantInfo()
      );

      if (!restaurantInfo || !restaurantInfo.businessHours.length) {
        return true; // No hours configured, assume open
      }

      const now = new Date();
      const dayOfWeek = now.getDay();

      const dayMap: Record<string, number> = {
        'Dimanche': 0,
        'Lundi': 1,
        'Mardi': 2,
        'Mercredi': 3,
        'Jeudi': 4,
        'Vendredi': 5,
        'Samedi': 6,
      };

      const todayHours = restaurantInfo.businessHours.find(
        (h) => dayMap[h.day] === dayOfWeek
      );

      if (!todayHours || todayHours.is_closed) {
        return false;
      }

      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [openH, openM] = (todayHours.open_time || '00:00').split(':').map(Number);
      const [closeH, closeM] = (todayHours.close_time || '23:59').split(':').map(Number);

      const openMinutes = openH * 60 + openM;
      let closeMinutes = closeH * 60 + closeM;
      if (closeMinutes <= openMinutes) {
        closeMinutes += 24 * 60; // Spans midnight
      }

      return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    } catch (error) {
      console.error('Error checking business hours:', error);
      return true; // On error, assume open to avoid blocking users
    }
  }

  /**
   * Refresh the closedForDay signal by checking current business hours.
   * Call this when the component initialises or the vendor changes.
   */
  async refreshClosedForDay(): Promise<void> {
    const withinHours = await this.isWithinBusinessHours();
    this.closedForDay.set(!withinHours);
  }

  /**
   * Get observable for restaurant status changes
   */
  getRestaurantStatus(): Observable<boolean> {
    return this.vendorService.ordersSuspended$;
  }
}
