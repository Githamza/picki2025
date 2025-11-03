import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { VendorService } from '../../../services/vendor.service';
import { AuthService } from '../../../services/auth.service';
import { VendorNavigationService } from '../../../services/vendor-navigation.service';

@Component({
  selector: 'app-admin-sidenav',
  standalone: true,
  imports: [
    CommonModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './admin-sidenav.component.html',
  styleUrl: './admin-sidenav.component.scss',
})
export class AdminSidenavComponent {
  private router = inject(Router);
  public vendorService = inject(VendorService);
  private authService = inject(AuthService);
  private vendorNavigation = inject(VendorNavigationService);
  private snackBar = inject(MatSnackBar);

  ordersSuspended = false;
  isToggling = false;

  constructor() {
    // Subscribe to orders suspension status
    this.vendorService.ordersSuspended$.subscribe((suspended) => {
      this.ordersSuspended = suspended;
    });
  }

  navigateToOrders() {
    this.vendorNavigation.navigateWithVendor(['admin', 'orders-manager']);
  }

  navigateToProducts() {
    const currentVendor = this.vendorService.getCurrentVendor();

    if (!currentVendor) {
      this.vendorService.loadVendors().then(() => {
        const vendor = this.vendorService.getCurrentVendor();
        if (vendor) {
          this.vendorNavigation.navigateWithVendor([
            'admin',
            'product-manager',
          ]);
        } else {
          this.router.navigate(['/']);
        }
      });
      return;
    }

    this.vendorNavigation.navigateWithVendor(['admin', 'product-manager']);
  }

  navigateToRestaurantInfo() {
    this.vendorNavigation.navigateWithVendor(['admin', 'restaurant-info']);
  }

  isCurrentRoute(route: string): boolean {
    return this.router.url.includes(route);
  }

  async toggleOrdersSuspension() {
    if (this.isToggling) return;

    this.isToggling = true;
    try {
      const newStatus = await this.vendorService.toggleOrdersSuspension();

      const message = newStatus
        ? 'Les commandes sont maintenant ouvertes'
        : 'Les commandes sont maintenant suspendues';

      this.snackBar.open(message, 'Fermer', {
        duration: 3000,
        panelClass: newStatus ? ['success-snackbar'] : ['warning-snackbar'],
      });
    } catch (error) {
      console.error('Error toggling orders suspension:', error);
      this.snackBar.open(
        'Erreur lors de la modification du statut des commandes',
        'Fermer',
        { duration: 5000, panelClass: ['error-snackbar'] }
      );
    } finally {
      this.isToggling = false;
    }
  }

  getOrdersStatusText(): string {
    return this.ordersSuspended ? 'Commandes suspendues' : 'Commandes ouvertes';
  }

  getCurrentUser() {
    return this.authService.currentUser();
  }

  getUserDisplayName(): string {
    const user = this.getCurrentUser();
    return user ? `${user.firstName} ${user.lastName}` : '';
  }

  getUserRole(): string {
    const user = this.getCurrentUser();
    return user ? user.role : '';
  }

  async logout(): Promise<void> {
    try {
      await this.authService.logout();
    } catch (error) {
      console.error('Error during logout:', error);
      this.snackBar.open('Erreur lors de la déconnexion', 'Fermer', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    }
  }
}

