import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { VendorService } from '../../services/vendor.service';
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
  ],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private vendorService = inject(VendorService);
  private vendorNavigation = inject(VendorNavigationService);
  private snackBar = inject(MatSnackBar);

  ordersSuspended = false;
  isToggling = false;
  private subscription = new Subscription();

  ngOnInit() {
    // Load vendors and subscribe to orders suspension status
    this.vendorService.loadVendors();

    this.subscription.add(
      this.vendorService.ordersSuspended$.subscribe((suspended) => {
        this.ordersSuspended = suspended;
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  navigateToOrders() {
    this.vendorNavigation.navigateWithVendor(['admin', 'orders-manager']);
  }

  navigateToStock() {
    this.vendorNavigation.navigateWithVendor(['admin', 'stock-manager']);
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
}
