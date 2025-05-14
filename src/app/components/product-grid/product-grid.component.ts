import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { Observable, combineLatest, map } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { inject } from '@angular/core';

import { AppState } from '../../store/models/app.state';
import * as CategorySelectors from '../../store/selectors/category.selectors';
import * as ProductSelectors from '../../store/selectors/product.selectors';
import * as ProductActions from '../../store/actions/product.actions';
import { Product } from '../../services/product.service';

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
  filteredProducts$!: Observable<Product[]>;
  selectedCategory$: Observable<any>;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private store = inject(Store<AppState>);

  constructor() {
    this.selectedCategory$ = this.store.select(
      CategorySelectors.selectSelectedCategory
    );
    this.filteredProducts$ = combineLatest([
      this.store.select(ProductSelectors.selectAllProducts),
      this.store.select(CategorySelectors.selectSelectedCategoryId),
    ]).pipe(
      map(([products, selectedCategoryId]) => {
        if (selectedCategoryId) {
          return products.filter((p) => p.categoryId === selectedCategoryId);
        }
        return products;
      })
    );
  }

  /**
   * Wrap state updates in the View Transitions API when the browser supports it.
   * Falls back to an immediate update when not available.
   */
  private runWithViewTransition(updateFn: () => void): void {
    // `startViewTransition` is still experimental – use a safe access check.
    // Cast to `any` to avoid TypeScript errors on the global `document` interface.
    const doc = document as any;
    if (typeof doc.startViewTransition === 'function') {
      doc.startViewTransition(updateFn);
    } else {
      // Fallback for browsers without the API
      updateFn();
    }
  }

  private toKebabCase(value: string): string {
    return value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  ngOnInit() {
    this.store
      .select(ProductSelectors.selectAllProducts)
      .subscribe((products) => {
        if (!products || products.length === 0) {
          this.store.dispatch(ProductActions.loadProducts());
        }
      });
  }

  addToCart(product: any) {
    // This would dispatch an action to add the product to cart in a real app
    console.log('Added to cart:', product);
  }
}
