import { Routes } from '@angular/router';
import { ProductGridComponent } from './components/product-grid/product-grid.component';

export const routes: Routes = [
  { path: '', component: ProductGridComponent },
  { path: 'products', component: ProductGridComponent },
  { path: '**', redirectTo: '' },
];
