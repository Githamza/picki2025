import { Component, inject, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map, filter, switchMap, take } from 'rxjs/operators';
import { VendorService } from '../../services/vendor.service';
import { Subscription } from 'rxjs';
import { AdminSidenavComponent } from './admin-sidenav/admin-sidenav.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MatSnackBarModule,
    AdminSidenavComponent,
  ],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent implements OnInit, OnDestroy, AfterViewInit {
  private router = inject(Router);
  public vendorService = inject(VendorService);
  private breakpointObserver = inject(BreakpointObserver);

  @ViewChild('sidenav') sidenav!: MatSidenav;

  isHandset$ = this.breakpointObserver
    .observe([Breakpoints.Handset, Breakpoints.Tablet])
    .pipe(map((result) => result.matches));

  menuOpened = true;
  private subscription = new Subscription();

  ngOnInit() {
    // Initialize auth service for admin interface
    console.log('🔐 Admin layout initialized - auth service should be ready');

    // Load vendors
    this.vendorService.loadVendors();

    // Subscribe to breakpoint changes to control sidenav mode
    this.subscription.add(
      this.isHandset$.subscribe((isHandset) => {
        // Auto-close sidenav on mobile initially, keep open on desktop
        if (isHandset) {
          this.menuOpened = false;
        } else {
          this.menuOpened = true;
        }
        
        // Update sidenav if available
        if (this.sidenav) {
          if (isHandset) {
            this.sidenav.close();
          } else {
            this.sidenav.open();
          }
        }
      })
    );

    // Close sidenav on mobile when navigating
    this.subscription.add(
      this.router.events
        .pipe(
          filter((event) => event instanceof NavigationEnd),
          switchMap(() => this.isHandset$.pipe(take(1)))
        )
        .subscribe((isHandset) => {
          if (isHandset && this.sidenav) {
            this.sidenav.close();
            this.menuOpened = false;
          }
        })
    );
  }

  ngAfterViewInit() {
    // Set initial state based on screen size
    this.isHandset$.pipe(take(1)).subscribe((isHandset) => {
      if (isHandset) {
        this.menuOpened = false;
        if (this.sidenav) {
          this.sidenav.close();
        }
      } else {
        this.menuOpened = true;
        if (this.sidenav) {
          this.sidenav.open();
        }
      }
    });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  toggleMenu() {
    if (this.sidenav) {
      this.sidenav.toggle();
    } else {
      this.menuOpened = !this.menuOpened;
    }
  }
}
