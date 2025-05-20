import { Routes } from '@angular/router';
import { ProductGridComponent } from './components/product-grid/product-grid.component';
import { ExamplePageComponent } from './components/example-page/example-page.component';
import { ProductAddComponent } from './components/product-add/product-add.component';

export const routes: Routes = [
  { path: '', component: ProductGridComponent },
  { path: 'products', component: ProductGridComponent },
  { path: ':category/products', component: ProductGridComponent },
  { path: 'product/:productName', component: ProductAddComponent },
  { path: ':category/product/:productName', component: ProductAddComponent },
  { path: '**', redirectTo: '' },
];
