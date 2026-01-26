import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { materialComponents } from '../../material.components';
import { VendorService, Vendor } from '../../services/vendor.service';

@Component({
  selector: 'app-vendor-selection',
  standalone: true,
  imports: [CommonModule, ...materialComponents],
  templateUrl: './vendor-selection.component.html',
  styleUrls: ['./vendor-selection.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorSelectionComponent implements OnInit {
  private vendorService = inject(VendorService);
  private router = inject(Router);

  vendors: Vendor[] = [];

  async ngOnInit() {
    //await this.loadVendors();
  }

  private async loadVendors() {
    try {
      await this.vendorService.loadVendors();
      this.vendorService.vendors$.subscribe((vendors) => {
        this.vendors = vendors;
        // Automatically redirect to the first active vendor
        this.redirectToFirstVendor();
      });
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  }

  private redirectToFirstVendor() {
    if (this.vendors.length > 0) {
      // Find the first active vendor
      // const firstActiveVendor = this.vendors.find((vendor) => vendor.is_active);
      // if (firstActiveVendor) {
      //   // Redirect to the first active vendor
      //   this.selectVendor(firstActiveVendor);
      // } else {
      // If no active vendors, try the first vendor regardless of status
      // const firstVendor = this.vendors[1];
      // if (firstVendor) {
      //   console.warn(
      //     'No active vendors found, redirecting to first vendor anyway'
      //   );
      //   this.selectVendor(firstVendor);
      //   // }
      // }
    }
  }

  selectVendor(vendor: Vendor) {
    if (this.isVendorOpen(vendor)) {
      const vendorSlug = this.vendorService.getVendorSlug(vendor);
      this.router.navigate(['/vendor', vendorSlug]);
    } else {
      console.warn(
        'Attempting to navigate to inactive vendor:',
        vendor.business_name
      );
      // Still navigate even if inactive, in case we want to show a "closed" message
      const vendorSlug = this.vendorService.getVendorSlug(vendor);
      this.router.navigate(['/vendor', vendorSlug]);
    }
  }

  isVendorOpen(vendor: Vendor): boolean {
    return this.vendorService.isVendorOrdersOpen(vendor);
  }
}
