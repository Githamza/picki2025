import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { materialComponents } from '../../material.components';
import { CategoryMenuComponent } from '../category-menu/category-menu.component';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map } from 'rxjs/operators';
import { CartBadgeComponent } from '../cart-badge/cart-badge.component';
import { DiningPreferenceService } from '../../services/dining-preference.service';
import { RestaurantStatusService } from '../../services/restaurant-status.service';
import { Subscription } from 'rxjs';
import { VendorNavigationService } from '../../services/vendor-navigation.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    ...materialComponents,
    CategoryMenuComponent,
    CartBadgeComponent,
  ],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss'],
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private breakpointObserver = inject(BreakpointObserver);
  protected diningPreferenceService = inject(DiningPreferenceService);
  private router = inject(Router);
  private vendorNavigation = inject(VendorNavigationService);
  private restaurantStatusService = inject(RestaurantStatusService);

  private subscription = new Subscription();

  // Use BreakpointObserver for responsive design (material design 3 way)
  isHandset$ = this.breakpointObserver
    .observe(Breakpoints.Handset)
    .pipe(map((result) => result.matches));

  menuOpened = true;

  ngOnInit() {
    // Check restaurant status when component loads
    this.checkRestaurantStatusOnLoad();

    // Subscribe to restaurant status changes
    this.subscription.add(
      this.restaurantStatusService
        .getRestaurantStatus()
        .subscribe((suspended) => {
          // Restaurant status changed - dialog will be handled by the service if needed
          if (suspended) {
            console.log('Restaurant is now closed');
          } else {
            console.log('Restaurant is now open');
          }
        })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  private async checkRestaurantStatusOnLoad() {
    try {
      // Check and show dialog if restaurant is closed
      // This will load vendors and show dialog if needed
      await this.restaurantStatusService.checkAndShowIfClosed();
    } catch (error) {
      console.error('Error checking restaurant status on load:', error);
    }
  }

  // Public method to check if restaurant is open (can be used by other components)
  isRestaurantOpen(): boolean {
    return this.restaurantStatusService.isRestaurantOpen();
  }

  toggleMenu() {
    this.menuOpened = !this.menuOpened;
  }

  changeDiningPreference(): void {
    // Navigate to the dining preference route with vendor context
    this.vendorNavigation.navigateWithVendor('dining-preference');
  }

  // Theme toggling for MDC 3
  isDarkTheme = false;

  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;
    if (this.isDarkTheme) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }
}
