import { Routes } from '@angular/router';
import { MainLayoutComponent } from './components/main-layout/main-layout.component';
import { VendorLayoutComponent } from './components/vendor-layout/vendor-layout.component';
import { VendorSelectionComponent } from './components/vendor-selection/vendor-selection.component';
import { ProductGridComponent } from './components/product-grid/product-grid.component';
import { ProductAddComponent } from './components/product-add/product-add.component';
import { CartDetailsPageComponent } from './components/cart-details-page/cart-details-page.component';
import { WelcomeScreenComponent } from './components/welcome-screen/welcome-screen.component';
import { PaymentSuccessComponent } from './components/payment-success/payment-success.component';
import { PaymentFailedComponent } from './components/payment-failed/payment-failed.component';
import { OrdersManagerComponent } from './components/orders-manager/orders-manager.component';
import { StockManagerComponent } from './components/stock-manager/stock-manager.component';
import { AdminLayoutComponent } from './components/admin-layout/admin-layout.component';
import { diningPreferenceGuard } from './guards/dining-preference.guard';
import { VendorGuard } from './guards/vendor.guard';

export const routes: Routes = [
  // Vendor selection page
  {
    path: '',
    component: VendorSelectionComponent,
  },

  // Vendor-specific routes - new structure
  {
    path: ':vendorSlug',
    component: VendorLayoutComponent,
    canActivate: [VendorGuard],
    children: [
      // Dining preference route for this vendor
      {
        path: 'dining-preference',
        component: WelcomeScreenComponent,
      },

      // Payment routes for this vendor
      {
        path: 'successPayment',
        component: PaymentSuccessComponent,
      },
      {
        path: 'failedPayment',
        component: PaymentFailedComponent,
      },

      // Admin routes for this vendor
      {
        path: 'admin',
        component: AdminLayoutComponent,
        children: [
          { path: '', redirectTo: 'orders-manager', pathMatch: 'full' },
          { path: 'orders-manager', component: OrdersManagerComponent },
          { path: 'stock-manager', component: StockManagerComponent },
        ],
      },

      // Main app routes for this vendor
      {
        path: '',
        component: MainLayoutComponent,
        canActivate: [diningPreferenceGuard],
        children: [
          { path: '', redirectTo: 'products', pathMatch: 'full' },
          { path: 'products', component: ProductGridComponent },
          { path: ':category/products', component: ProductGridComponent },
          { path: 'product/:productName', component: ProductAddComponent },
          {
            path: ':category/product/:productName',
            component: ProductAddComponent,
          },
          { path: 'cartdetails', component: CartDetailsPageComponent },
        ],
      },
    ],
  },

  // Legacy redirects
  { path: 'admin', redirectTo: '/', pathMatch: 'full' },
  { path: 'orders-manager', redirectTo: '/', pathMatch: 'full' },
  { path: 'stock-manager', redirectTo: '/', pathMatch: 'full' },
  { path: 'dining-preference', redirectTo: '/', pathMatch: 'full' },
  { path: 'successPayment', redirectTo: '/', pathMatch: 'full' },
  { path: 'failedPayment', redirectTo: '/', pathMatch: 'full' },

  { path: '**', redirectTo: '/' },
];
