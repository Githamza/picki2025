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
import { VendorCacheTestComponent } from './components/vendor-cache-test/vendor-cache-test.component';
import { CategoryGridComponent } from './components/category-grid/category-grid.component';
import { PromotionalBannerComponent } from './components/promotional-banner/promotional-banner.component';
import { customDomainVendorGuard } from './guards/custom-domain-vendor.guard';

// Shared vendor app route tree (mounted either at /vendor/:vendorSlug or at / on custom domains)
// Note: when mounted at / (custom domain), there is NO vendorSlug in the URL.
const vendorAppChildren: Routes = [
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

  // Main app routes for this vendor
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [diningPreferenceGuard],
    children: [
      { path: '', redirectTo: 'promotional-banner', pathMatch: 'full' },
      {
        path: 'promotional-banner',
        component: PromotionalBannerComponent,
        children: [
          { path: '', redirectTo: 'categories', pathMatch: 'full' },
          { path: 'categories', component: CategoryGridComponent },
          { path: ':category/products', component: ProductGridComponent },
          { path: 'products', component: ProductGridComponent },
        ],
      },
      { path: ':category/product/:productName', component: ProductAddComponent },
      { path: 'cartdetails', component: CartDetailsPageComponent },
    ],
  },
];

export const routes: Routes = [
  // Top-level routes that must always be reachable (even on custom domains)

  // Centralized admin login
  {
    path: 'admin/login',
    component: AdminLoginComponent,
  },

  // Top-level Admin Routes
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

  // Cache test route (development only)
  {
    path: 'test-cache',
    component: VendorCacheTestComponent,
  },

  // Vendor app mounted at root when using a vendor custom domain (e.g. granola.fr/...)
  {
    path: '',
    canMatch: [customDomainVendorGuard],
    component: VendorLayoutComponent,
    children: vendorAppChildren,
  },

  // Vendor-specific routes on pikiapp domains (e.g. pikiapp.com/vendor/granola/...)
  {
    path: 'vendor/:vendorSlug',
    component: VendorLayoutComponent,
    canActivate: [VendorGuard],
    children: vendorAppChildren,
  },

  // Vendor selection page (pikiapp domains only; on custom domains the root is the vendor app)
  {
    path: '',
    component: VendorSelectionComponent,
  },

  // Legacy redirects
  { path: 'orders-manager', redirectTo: '/', pathMatch: 'full' },
  { path: 'dining-preference', redirectTo: '/', pathMatch: 'full' },
  { path: 'successPayment', redirectTo: '/', pathMatch: 'full' },
  { path: 'failedPayment', redirectTo: '/', pathMatch: 'full' },

  { path: '**', redirectTo: '/' },
];
