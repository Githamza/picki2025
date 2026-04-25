import { Routes } from '@angular/router';
import { RestaurantInfoShellComponent } from './restaurant-info-shell.component';

export const restaurantInfoRoutes: Routes = [
  {
    path: '',
    component: RestaurantInfoShellComponent,
    children: [
      { path: '', redirectTo: 'apparence', pathMatch: 'full' },
      {
        path: 'apparence',
        loadComponent: () =>
          import('./children/apparence/apparence.component').then(
            (m) => m.ApparenceComponent
          ),
      },
      {
        path: 'horaires',
        loadComponent: () =>
          import('./children/horaires/horaires.component').then(
            (m) => m.HorairesComponent
          ),
      },
      {
        path: 'commandes',
        loadComponent: () =>
          import('./children/commandes/commandes.component').then(
            (m) => m.CommandesComponent
          ),
      },
      {
        path: 'paiement',
        loadComponent: () =>
          import('./children/paiement/paiement.component').then(
            (m) => m.PaiementComponent
          ),
      },
      {
        path: 'coupons',
        loadComponent: () =>
          import('./children/coupons/coupons-admin-page.component').then(
            (m) => m.CouponsAdminPageComponent
          ),
      },
      {
        path: 'messages',
        loadComponent: () =>
          import('./children/messages/messages.component').then(
            (m) => m.MessagesComponent
          ),
      },
      {
        path: 'stocks',
        loadComponent: () =>
          import('./children/stocks/stocks.component').then(
            (m) => m.StocksComponent
          ),
      },
      {
        path: 'contact',
        loadComponent: () =>
          import('./children/contact/contact.component').then(
            (m) => m.ContactComponent
          ),
      },
    ],
  },
];
