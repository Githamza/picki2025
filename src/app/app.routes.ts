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
import { AdminLayoutComponent } from './components/admin-layout/admin-layout.component';
import { ProductManagerComponent } from './components/product-manager/product-manager.component';
import { RestaurantInfoAdminComponent } from './components/restaurant-info-admin/restaurant-info-admin.component';
import { AdminLoginComponent } from './components/admin-login/admin-login.component';
import { diningPreferenceGuard } from './guards/dining-preference.guard';
import { VendorGuard } from './guards/vendor.guard';
import { AdminAuthGuard } from './guards/admin-auth.guard';

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

      // Admin login route (public)
      {
        path: 'admin/login',
        component: AdminLoginComponent,
      },

      // Protected admin routes for this vendor
      {
        path: 'admin',
        component: AdminLayoutComponent,
        canActivate: [AdminAuthGuard],
        children: [
          { path: '', redirectTo: 'orders-manager', pathMatch: 'full' },
          {
            path: 'orders-manager',
            component: OrdersManagerComponent,
            data: { permission: { resource: 'orders', action: 'read' } },
          },
          {
            path: 'restaurant-info',
            component: RestaurantInfoAdminComponent,
            data: { permission: { resource: 'vendor', action: 'read' } },
          },
          {
            path: 'product-manager',
            data: { permission: { resource: 'products', action: 'read' } },
            children: [
              { path: '', component: ProductManagerComponent },
              {
                path: 'menu/:id',
                loadComponent: () =>
                  import(
                    './components/product-manager/menu-edit/menu-edit.component'
                  ).then((m) => m.MenuEditComponent),
                data: {
                  permission: { resource: 'products', action: 'update' },
                },
              },
            ],
          },
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
  { path: 'dining-preference', redirectTo: '/', pathMatch: 'full' },
  { path: 'successPayment', redirectTo: '/', pathMatch: 'full' },
  { path: 'failedPayment', redirectTo: '/', pathMatch: 'full' },

  { path: '**', redirectTo: '/' },
];
