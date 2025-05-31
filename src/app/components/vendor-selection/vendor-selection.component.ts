import { Component, inject, OnInit } from '@angular/core';
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
})
export class VendorSelectionComponent implements OnInit {
  private vendorService = inject(VendorService);
  private router = inject(Router);

  vendors: Vendor[] = [];

  async ngOnInit() {
    await this.loadVendors();
  }

  private async loadVendors() {
    try {
      await this.vendorService.loadVendors();
      this.vendorService.vendors$.subscribe((vendors) => {
        this.vendors = vendors;
      });
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  }

  selectVendor(vendor: Vendor) {
    if (vendor.is_active) {
      const vendorSlug = this.vendorService.getVendorSlug(vendor);
      this.router.navigate([vendorSlug]);
    }
  }
}
