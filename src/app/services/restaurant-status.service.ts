import { Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { VendorService } from './vendor.service';
import { RestaurantClosedDialogComponent } from '../components/restaurant-closed-dialog/restaurant-closed-dialog.component';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class RestaurantStatusService {
  private vendorService = inject(VendorService);
  private dialog = inject(MatDialog);

  private dialogShownSubject = new BehaviorSubject<boolean>(false);
  public dialogShown$ = this.dialogShownSubject.asObservable();

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

      const dialogRef = this.dialog.open(RestaurantClosedDialogComponent, {
        width: '90%',
        maxWidth: '450px',
        disableClose: false,
        panelClass: 'restaurant-closed-dialog-panel',
        autoFocus: true,
        restoreFocus: true,
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

      if (this.isRestaurantClosed()) {
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
    if (this.isRestaurantClosed()) {
      await this.showRestaurantClosedDialog();
      return false;
    }
    return true;
  }

  /**
   * Get observable for restaurant status changes
   */
  getRestaurantStatus(): Observable<boolean> {
    return this.vendorService.ordersSuspended$;
  }
}
