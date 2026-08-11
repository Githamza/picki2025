import { Routes } from '@angular/router';
import { MainLayoutComponent } from './components/main-layout/main-layout.component';
import { VendorLayoutComponent } from './components/vendor-layout/vendor-layout.component';
import { VendorSelectionComponent } from './components/vendor-selection/vendor-selection.component';
import { ProductGridComponent } from './components/product-grid/product-grid.component';
import { ProductAddComponent } from './components/product-add/product-add.component';
import { WelcomeScreenComponent } from './components/welcome-screen/welcome-screen.component';
import { PaymentSuccessComponent } from './components/payment-success/payment-success.component';
import { PaymentFailedComponent } from './components/payment-failed/payment-failed.component';
import { OrdersManagerComponent } from './components/orders-manager/orders-manager.component';
import { AdminLayoutComponent } from './components/admin-layout/admin-layout.component';
import { ProductManagerComponent } from './components/product-manager/product-manager.component';
import { AdminLoginComponent } from './components/admin-login/admin-login.component';
import { diningPreferenceGuard } from './guards/dining-preference.guard';
import { VendorGuard } from './guards/vendor.guard';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { VendorCacheTestComponent } from './components/vendor-cache-test/vendor-cache-test.component';
import { CategoryGridComponent } from './components/category-grid/category-grid.component';
import { PromotionalBannerComponent } from './components/promotional-banner/promotional-banner.component';
import { customDomainVendorGuard } from './guards/custom-domain-vendor.guard';
import { kioskEntryGuard } from './guards/kiosk-entry.guard';
import { OrdersQueueComponent } from './components/orders-queue/orders-queue.component';

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

  // Public orders queue display board
  {
    path: 'orders-queue',
    component: OrdersQueueComponent,
  },

  // Main app routes for this vendor
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [diningPreferenceGuard],
    children: [
      { path: '', redirectTo: 'promotional-banner', pathMatch: 'full' },
      // Convenience alias: allow /products to show all products (no category)
      { path: 'products', redirectTo: 'promotional-banner/products', pathMatch: 'full' },
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
      // Post-add upsell page (SPEC-UPSELL.md): entered only via a staged
      // offer; a direct visit redirects back to the product grid.
      {
        path: 'upsell',
        loadComponent: () =>
          import('./components/upsell-page/upsell-page.component').then(
            (m) => m.UpsellPageComponent
          ),
      },
      { path: ':category/product/:productName', component: ProductAddComponent },
      // Product page without category in URL (e.g. /product/:productName)
      // Must be declared before the ':category/...' route to avoid conflicts.
      { path: 'product/:productName', component: ProductAddComponent },
    ],
  },
];

export const routes: Routes = [
  // Centralized admin login
  {
    path: 'admin/login',
    component: AdminLoginComponent,
  },

  // Vendor self-registration (no auth required)
  {
    path: 'admin/register',
    loadComponent: () =>
      import('./components/admin-register/admin-register.component').then(
        (m) => m.AdminRegisterComponent
      ),
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
        loadChildren: () =>
          import('./components/restaurant-info-admin/restaurant-info.routes').then(
            (m) => m.restaurantInfoRoutes
          ),
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

  // Shop APK entry point: login (if needed) then straight to the
  // authenticated vendor's storefront. The guard always redirects, so the
  // route needs no component.
  {
    path: 'kiosk',
    canActivate: [kioskEntryGuard],
    children: [],
  },

  // Cache test route (development only)
  {
    path: 'test-cache',
    component: VendorCacheTestComponent,
  },

  // Vendor-specific routes on pikiapp domains (e.g. pikiapp.com/vendor/granola/...)
  {
    path: 'vendor/:vendorSlug',
    component: VendorLayoutComponent,
    canActivate: [VendorGuard],
    children: vendorAppChildren,
  },

  // Vendor app mounted at root when using a vendor custom domain (e.g. granola.fr/...)
  // This guard returns false on pikiapp domains, so the next route (redirect) will be used
  {
    path: '',
    canMatch: [customDomainVendorGuard],
    component: VendorLayoutComponent,
    children: vendorAppChildren,
  },

  // On pikiapp domains (localhost, piki-app.com), redirect root to admin dashboard
  // This only runs if customDomainVendorGuard above returned false
  {
    path: '',
    redirectTo: '/admin/orders-manager',
    pathMatch: 'full',
  },

  // Legacy redirects
  { path: 'orders-manager', redirectTo: '/', pathMatch: 'full' },
  { path: 'dining-preference', redirectTo: '/', pathMatch: 'full' },

  { path: '**', redirectTo: '/' },
];
