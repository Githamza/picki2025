import { afterNextRender, Component, Injector, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { Observable, combineLatest, map, tap } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import {
  MatBottomSheetModule,
  MatBottomSheet,
} from '@angular/material/bottom-sheet';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

import { AppState } from '../../store/models/app.state';
import * as CategorySelectors from '../../store/selectors/category.selectors';
import * as ProductSelectors from '../../store/selectors/product.selectors';
import * as ProductActions from '../../store/actions/product.actions';
import { Product } from '../../services/product.service';
import { ProductDetailsSheetComponent } from '../product-details-sheet/product-details-sheet.component';
import { UtilsService } from '../../shared/utils.service';

@Component({
  selector: 'app-product-grid',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatGridListModule,
    MatIconModule,
    MatBottomSheetModule,
  ],
  templateUrl: './product-grid.component.html',
  styleUrls: ['./product-grid.component.scss'],
})
export class ProductGridComponent implements OnInit {
  filteredProducts$!: Observable<Product[]>;
  selectedCategory$: Observable<any>;
  filteredProducts: Product[] = [];
  private store = inject(Store<AppState>);
  private bottomSheet = inject(MatBottomSheet);
  private router = inject(Router);
  private location = inject(Location);

  constructor(private utilsService: UtilsService, private injector: Injector) {
    this.selectedCategory$ = this.store.select(
      CategorySelectors.selectSelectedCategory
    );

    // Trigger view transition when filtered products change
    combineLatest([
      this.store.select(ProductSelectors.selectAllProducts),
      this.store.select(CategorySelectors.selectSelectedCategoryId),
    ]).subscribe(([products, selectedCategoryId]) => {
      if (document.startViewTransition) {
        document.startViewTransition(() => {
          // The DOM update is handled by the observable's map operator
          const filteredProducts = this.filterProducts(
            products,
            selectedCategoryId
          );
          this.filteredProducts = filteredProducts;
          this.utilsService.createRenderPromise(this.injector);
        });
      }
    });
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

  filterProducts(products: Product[], selectedCategoryId: number | null) {
    if (selectedCategoryId) {
      return products.filter((p) => p.categoryId === selectedCategoryId);
    }
    return products;
  }

  addToCart(product: Product) {
    // Create a URL-friendly version of the product name
    const productSlug = product.name.toLowerCase().replace(/\s+/g, '-');

    // Get the current category if any
    let currentCategory = '';
    const currentUrl = this.router.url;

    // Check if we're in a category view
    if (currentUrl.includes('/products')) {
      // Extract the category from URL
      const categoryMatch = currentUrl.match(/\/(.+?)\/products/);
      if (categoryMatch && categoryMatch[1]) {
        currentCategory = categoryMatch[1];
        // Navigate to category product page
        this.router.navigate([`/${currentCategory}/product/${productSlug}`]);
      } else {
        // Default navigation if no category found
        this.router.navigate([`/product/${productSlug}`]);
      }
    } else {
      // No category in URL, use default product route
      this.router.navigate([`/product/${productSlug}`]);
    }
  }
}
