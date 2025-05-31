import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, ActivatedRoute } from '@angular/router';
import { materialComponents } from '../../material.components';
import { VendorService, Vendor } from '../../services/vendor.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-vendor-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ...materialComponents],
  templateUrl: './vendor-layout.component.html',
  styleUrls: ['./vendor-layout.component.scss'],
})
export class VendorLayoutComponent implements OnInit, OnDestroy {
  private vendorService = inject(VendorService);
  private route = inject(ActivatedRoute);

  currentVendor: Vendor | null = null;
  private subscription = new Subscription();

  ngOnInit() {
    // Subscribe to current vendor changes
    this.subscription.add(
      this.vendorService.currentVendor$.subscribe((vendor) => {
        this.currentVendor = vendor;
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
