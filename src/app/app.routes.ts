import { Routes } from '@angular/router';
import { ProductGridComponent } from './components/product-grid/product-grid.component';
import { ExamplePageComponent } from './components/example-page/example-page.component';

export const routes: Routes = [
  { path: '', component: ProductGridComponent },
  { path: 'products', component: ProductGridComponent },
  { path: ':category/products', component: ProductGridComponent },
  { path: '**', redirectTo: '' },
];
