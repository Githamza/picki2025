import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';

import { AppState } from '../../store/models/app.state';
import * as CategorySelectors from '../../store/selectors/category.selectors';

@Component({
  selector: 'app-product-grid',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatGridListModule,
    MatIconModule,
  ],
  templateUrl: './product-grid.component.html',
  styleUrls: ['./product-grid.component.scss'],
})
export class ProductGridComponent implements OnInit {
  // Mock products for demo
  products = [
    {
      id: 1,
      name: 'Classic Burger',
      price: 8.99,
      imageUrl: 'https://via.placeholder.com/150',
      categoryId: 3,
    },
    {
      id: 2,
      name: 'Cheese Pizza',
      price: 12.99,
      imageUrl: 'https://via.placeholder.com/150',
      categoryId: 4,
    },
    {
      id: 3,
      name: 'Caesar Salad',
      price: 7.99,
      imageUrl: 'https://via.placeholder.com/150',
      categoryId: 5,
    },
    {
      id: 4,
      name: 'French Fries',
      price: 3.99,
      imageUrl: 'https://via.placeholder.com/150',
      categoryId: 6,
    },
    {
      id: 5,
      name: 'Onion Rings',
      price: 4.99,
      imageUrl: 'https://via.placeholder.com/150',
      categoryId: 6,
    },
    {
      id: 6,
      name: 'Milkshake',
      price: 5.99,
      imageUrl: 'https://via.placeholder.com/150',
      categoryId: 8,
    },
  ];

  filteredProducts: any[] = this.products;
  selectedCategory$: Observable<any>;

  constructor(private store: Store<AppState>) {
    this.selectedCategory$ = this.store.select(
      CategorySelectors.selectSelectedCategory
    );
  }

  ngOnInit() {
    this.selectedCategory$.subscribe((category) => {
      if (category) {
        this.filteredProducts = this.products.filter(
          (p) => p.categoryId === category.id
        );
      } else {
        this.filteredProducts = this.products;
      }
    });
  }

  addToCart(product: any) {
    // This would dispatch an action to add the product to cart in a real app
    console.log('Added to cart:', product);
  }
}
