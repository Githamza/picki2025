import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { materialComponents } from '../../material.components';
import { VendorService, Vendor } from '../../services/vendor.service';
import { Subscription, distinctUntilChanged } from 'rxjs';
import { Store } from '@ngrx/store';
import { AppState } from '../../store/models/app.state';
import * as ProductActions from '../../store/actions/product.actions';
import * as CategoryActions from '../../store/actions/category.actions';

@Component({
  selector: 'app-vendor-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, MatIconModule, ...materialComponents],
  templateUrl: './vendor-layout.component.html',
  styleUrls: ['./vendor-layout.component.scss'],
})
export class VendorLayoutComponent implements OnInit, OnDestroy {
  private vendorService = inject(VendorService);
  private store = inject(Store<AppState>);

  currentVendor: Vendor | null = null;
  private subscription = new Subscription();

  ordersSuspended = false;
  infoBannerDismissed = false;

  get suspendedMessage(): string {
    return this.currentVendor?.orders_suspended_message
      || 'les commandes en ligne sont actuellement suspendues';
  }

  get showInfoMessage(): boolean {
    return !!(
      this.currentVendor?.info_message_enabled &&
      this.currentVendor?.info_message
    );
  }

  dismissInfoBanner(): void {
    this.infoBannerDismissed = true;
  }

  ngOnInit() {
    // Subscribe to current vendor changes
    this.subscription.add(
      this.vendorService.currentVendor$.subscribe((vendor) => {
        if (vendor && vendor.id !== this.currentVendor?.id) {
          // Vendor has changed, reload vendor-specific data
          this.currentVendor = vendor;
          this.loadVendorData(vendor);
        } else {
          this.currentVendor = vendor;
        }
      })
    );

    this.ordersSuspended =
      this.vendorService.getCurrentOrdersSuspendedStatus();
    this.subscription.add(
      this.vendorService.ordersSuspended$
        .pipe(distinctUntilChanged())
        .subscribe((isSuspended) => {
          this.ordersSuspended = isSuspended;
        })
    );
  }

  private loadVendorData(vendor: Vendor) {
    console.log('Loading data for vendor:', vendor.business_name);

    // Dispatch actions to load vendor-specific products and categories
    this.store.dispatch(
      ProductActions.loadProductsByVendor({ vendorId: vendor.id })
    );
    this.store.dispatch(
      CategoryActions.loadCategoriesByVendor({ vendorId: vendor.id })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
