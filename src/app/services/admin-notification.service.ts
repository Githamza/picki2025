import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { VendorService } from './vendor.service';

@Injectable({
  providedIn: 'root',
})
export class AdminNotificationService {
  private readonly vendorService = inject(VendorService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  /**
   * Check if payment provider is configured and show notification if not
   */
  async checkPaymentProviderNotification(): Promise<void> {
    // Small delay to ensure navigation is complete
    setTimeout(async () => {
      try {
        const currentVendor = this.vendorService.getCurrentVendor();
        if (!currentVendor) return;

        // Check if online payments are enabled
        const onlinePaymentsEnabled = currentVendor.online_payments_enabled ?? true;

        if (!onlinePaymentsEnabled) {
          // Online payments are disabled - no need to check provider
          return;
        }

        const status = await this.vendorService.getPaymentProvidersStatus();

        // Check if no payment provider is configured
        const hasConfiguredProvider = status.stripe.configured || status.paygreen.configured;

        if (!hasConfiguredProvider) {
          this.showPaymentConfigurationNotification();
        }
      } catch (error) {
        console.error('Error checking payment provider status:', error);
      }
    }, 1500);
  }

  /**
   * Show notification prompting user to configure payment method
   */
  private showPaymentConfigurationNotification(): void {
    const snackBarRef = this.snackBar.open(
      'Aucun moyen de paiement configuré. Configurez-le pour accepter les paiements en ligne.',
      'Configurer',
      {
        duration: 10000,
        panelClass: ['warning-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      }
    );

    snackBarRef.onAction().subscribe(() => {
      this.navigateToPaymentSettings();
    });
  }

  /**
   * Navigate to the payment settings section in restaurant info
   */
  private navigateToPaymentSettings(): void {
    this.router.navigate(['/admin/restaurant-info'], {
      fragment: 'payment-providers',
    });
  }
}
