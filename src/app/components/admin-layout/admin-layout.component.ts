import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { VendorService } from '../../services/vendor.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import { VendorNavigationService } from '../../services/vendor-navigation.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatMenuModule,
    MatDividerModule,
  ],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  public vendorService = inject(VendorService);
  private authService = inject(AuthService);
  private vendorNavigation = inject(VendorNavigationService);
  private snackBar = inject(MatSnackBar);
  private breakpointObserver = inject(BreakpointObserver);

  ordersSuspended = false;
  isToggling = false;
  isMobile = false;
  private subscription = new Subscription();

  ngOnInit() {
    // Initialize auth service for admin interface
    console.log('🔐 Admin layout initialized - auth service should be ready');

    // Load vendors and subscribe to orders suspension status
    this.vendorService.loadVendors();

    this.subscription.add(
      this.vendorService.ordersSuspended$.subscribe((suspended) => {
        this.ordersSuspended = suspended;
      })
    );

    // Monitor mobile/desktop breakpoints
    this.subscription.add(
      this.breakpointObserver
        .observe([Breakpoints.Handset, Breakpoints.Small])
        .subscribe((result) => {
          this.isMobile = result.matches;
        })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  navigateToOrders() {
    this.vendorNavigation.navigateWithVendor(['admin', 'orders-manager']);
  }

  navigateToProducts() {
    const currentVendor = this.vendorService.getCurrentVendor();
    console.log('Current vendor for navigation:', currentVendor);

    if (!currentVendor) {
      console.error(
        'No current vendor found, cannot navigate to product manager'
      );
      // Try to reload vendors and set current vendor
      this.vendorService.loadVendors().then(() => {
        const vendor = this.vendorService.getCurrentVendor();
        if (vendor) {
          console.log('Vendor loaded, trying navigation again:', vendor);
          this.vendorNavigation.navigateWithVendor([
            'admin',
            'product-manager',
          ]);
        } else {
          console.error(
            'Still no vendor after loading, redirecting to vendor selection'
          );
          this.router.navigate(['/']);
        }
      });
      return;
    }

    const targetPath = ['admin', 'product-manager'];
    console.log('Navigating with vendor to:', targetPath);

    // Alternative: Direct navigation if service fails
    const vendorSlug = this.vendorService.getVendorSlug(currentVendor);
    const directPath = `/${vendorSlug}/admin/product-manager`;
    console.log('Direct path would be:', directPath);

    this.vendorNavigation.navigateWithVendor(targetPath);
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

  getOrdersStatusTooltip(): string {
    const activeCount = this.vendorService.getActiveVendorsCount();
    const totalCount = this.vendorService.getTotalVendorsCount();

    if (this.ordersSuspended) {
      return `Toutes les commandes sont suspendues (${activeCount}/${totalCount} vendeurs actifs)`;
    } else {
      return `Les commandes sont ouvertes (${activeCount}/${totalCount} vendeurs actifs)`;
    }
  }

  // Authentication methods
  getCurrentUser() {
    return this.authService.currentUser();
  }

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
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

  hasPermission(resource: string, action: string): boolean {
    return this.authService.hasPermission(resource, action);
  }
}
