import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { materialComponents } from '../../material.components';
import { CategoryMenuComponent } from '../category-menu/category-menu.component';
import { CartBadgeComponent } from '../cart-badge/cart-badge.component';
import { DiningPreferenceService } from '../../services/dining-preference.service';
import { RestaurantStatusService } from '../../services/restaurant-status.service';
import { Subscription } from 'rxjs';
import { VendorNavigationService } from '../../services/vendor-navigation.service';
import { CartBadgeVisibilityService } from '../../services/cart-badge-visibility.service';
import { VendorService } from '../../services/vendor.service';
import { MatDialog } from '@angular/material/dialog';
import { RestaurantInfoDialogComponent } from '../restaurant-info-dialog/restaurant-info-dialog.component';
import { Store } from '@ngrx/store';
import { AppState } from '../../store/models/app.state';
import * as CategoryActions from '../../store/actions/category.actions';
import { PromotionalBannerComponent } from "../promotional-banner/promotional-banner.component";
import { LayoutService } from '../../services/layout.service';
import { CartPanelComponent } from '../cart-panel/cart-panel.component';
import { KioskModeService } from '../../services/kiosk-mode.service';
import { CancelOrderDialogComponent } from '../kiosk/cancel-order-dialog/cancel-order-dialog.component';
import { AttractScreenComponent } from '../kiosk/attract-screen/attract-screen.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    ...materialComponents,
    CategoryMenuComponent,
    CartBadgeComponent,
    CartPanelComponent,
    AttractScreenComponent,
],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private layout = inject(LayoutService);
  private kioskMode = inject(KioskModeService);
  protected diningPreferenceService = inject(DiningPreferenceService);
  private vendorNavigation = inject(VendorNavigationService);
  private restaurantStatusService = inject(RestaurantStatusService);
  private cartBadgeVisibilityService = inject(CartBadgeVisibilityService);
  private vendorService = inject(VendorService);
  private dialog = inject(MatDialog);
  private store = inject(Store<AppState>);

  private subscription = new Subscription();

  // LayoutService is the storefront's single source of layout truth (FR1)
  readonly isPhone = computed(() => this.layout.formFactor() === 'phone');

  // FR4: kiosk chrome (no theme toggle, cancel-order affordance)
  readonly isKiosk = this.kioskMode.active;
  readonly attractVisible = this.kioskMode.attractVisible;

  // FR2: the persistent category rail exists only on landscape form factors;
  // phone and tablet-portrait navigate via the horizontal scroller.
  readonly showRail = computed(() => {
    const factor = this.layout.formFactor();
    return factor === 'tablet-landscape' || factor === 'kiosk';
  });

  menuOpened = true;

  // Use the cart badge visibility service
  showCartBadge$ = this.cartBadgeVisibilityService.showCartBadge$;

  // Current vendor for logo and name
  currentVendor$ = this.vendorService.currentVendor$;

  ngOnInit() {
    // Load vendors to ensure we have current vendor data
    this.vendorService.loadVendors();

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

  openRestaurantInfo(): void {
    const currentVendor = this.vendorService.getCurrentVendor();
    if (!currentVendor) {
      console.error('No current vendor available');
      return;
    }

    // Get restaurant info from the vendor service (currently using mock data)
    this.vendorService.getRestaurantInfo().subscribe((restaurantInfo) => {
      if (restaurantInfo) {
        this.dialog.open(RestaurantInfoDialogComponent, {
          data: restaurantInfo,
          panelClass: 'restaurant-info-dialog-panel',
          maxWidth: '600px',
          width: '90vw',
        });
      } else {
        console.error('Failed to load restaurant information');
      }
    });
  }

  // Theme toggling for MDC 3
  isDarkTheme = false;

  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;
    if (this.isDarkTheme) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  }
  cancelKioskOrder(): void {
    this.dialog
      .open(CancelOrderDialogComponent, { maxWidth: '420px' })
      .afterClosed()
      .subscribe((confirmed: boolean) => {
        if (confirmed) {
          this.kioskMode.resetSession();
          this.vendorNavigation.navigateWithVendor('promotional-banner');
        }
      });
  }

  gotoRestaurantHomepage() {
    // Clear selected category when navigating to products
    this.store.dispatch(CategoryActions.clearSelectedCategory());
    this.vendorNavigation.navigateWithVendor('promotional-banner');
  }
}
