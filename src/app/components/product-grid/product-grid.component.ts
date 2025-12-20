import { Component, Injector, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Store } from '@ngrx/store';
import { Observable, Subscription, combineLatest, map } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  MatBottomSheetModule,
  MatBottomSheet,
} from '@angular/material/bottom-sheet';
import { inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';

import { AppState } from '../../store/models/app.state';
import { Category } from '../../store/models/app.state';
import * as CategorySelectors from '../../store/selectors/category.selectors';
import * as CategoryActions from '../../store/actions/category.actions';
import * as ProductSelectors from '../../store/selectors/product.selectors';
import * as ProductActions from '../../store/actions/product.actions';
import { Product } from '../../services/product.service';
import { UtilsService } from '../../shared/utils.service';
import { PromotionalBannerComponent } from '../promotional-banner/promotional-banner.component';
import { HorizontalCategoryMenuComponent } from '../horizontal-category-menu/horizontal-category-menu.component';
import { CategoryGridComponent } from '../category-grid/category-grid.component';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { VendorNavigationService } from '../../services/vendor-navigation.service';
import { VendorService } from '../../services/vendor.service';
import { PRODUCT_PLACEHOLDER_IMAGE } from '../../shared/utils/image-placeholder';

@Component({
  selector: 'app-product-grid',
  standalone: true,
  imports: [
    CommonModule,
    NgOptimizedImage,
    MatCardModule,
    MatButtonModule,
    MatGridListModule,
    MatIconModule,
    MatTooltipModule,
    MatBottomSheetModule,
    HorizontalCategoryMenuComponent,
  ],
  templateUrl: './product-grid.component.html',
  styleUrls: ['./product-grid.component.scss'],
})
export class ProductGridComponent implements OnInit {
  private breakpointObserver = inject(BreakpointObserver);
  private vendorNavigation = inject(VendorNavigationService);
  private vendorService = inject(VendorService);
  private route = inject(ActivatedRoute);

  // Use BreakpointObserver for responsive design (material design 3 way)
  isHandset$ = this.breakpointObserver
    .observe(Breakpoints.Handset)
    .pipe(map((result) => result.matches));
  selectedCategory$: Observable<any>;
  filteredProducts: Product[] = [];
  readonly placeholderImage = PRODUCT_PLACEHOLDER_IMAGE;
  private store = inject(Store<AppState>);
  private bottomSheet = inject(MatBottomSheet);
  private router = inject(Router);
  private location = inject(Location);
  private subscriptions = new Subscription();

  constructor(private utilsService: UtilsService, private injector: Injector) {
    this.selectedCategory$ = this.store.select(
      CategorySelectors.selectSelectedCategory
    );

    // Trigger view transition when filtered products change
    this.subscriptions.add(
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
        } else {
          this.filteredProducts = this.filterProducts(
            products,
            selectedCategoryId
          );
        }
      })
    );
  }

  ngOnInit() {
    this.syncSelectedCategoryFromUrl();

    // Get current vendor and load vendor-specific products
    const currentVendor = this.vendorService.getCurrentVendor();

    this.subscriptions.add(
      this.store
        .select(ProductSelectors.selectAllProducts)
        .subscribe((products) => {
          if (!products || products.length === 0) {
            if (currentVendor) {
              this.store.dispatch(
                ProductActions.loadProductsByVendor({
                  vendorId: currentVendor.id,
                })
              );
            } else {
              // If no vendor is selected, wait or show a message
              // For now, we'll dispatch without vendor ID
              this.store.dispatch(
                ProductActions.loadProducts({ vendorId: undefined })
              );
            }
          }
        })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private syncSelectedCategoryFromUrl(): void {
    this.subscriptions.add(
      combineLatest([
        this.route.paramMap.pipe(map((params) => params.get('category'))),
        this.store.select(CategorySelectors.selectAllCategories),
        this.store.select(CategorySelectors.selectSelectedCategoryId),
      ]).subscribe(([categorySlug, categories, selectedCategoryId]) => {
        // Route `/promotional-banner/products` (no category in URL): show all products
        if (!categorySlug) {
          if (selectedCategoryId !== null) {
            this.store.dispatch(CategoryActions.clearSelectedCategory());
          }
          return;
        }

        if (!categories || categories.length === 0) {
          return;
        }

        const matched = categories.find(
          (c: Category) => this.toCategorySlug(c.name) === categorySlug
        );

        if (matched && matched.id !== selectedCategoryId) {
          this.store.dispatch(
            CategoryActions.selectCategory({ categoryId: matched.id })
          );
        }
      })
    );
  }

  private toCategorySlug(name: string): string {
    // Must match the slug logic used when building category URLs elsewhere in the app
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  filterProducts(products: Product[], selectedCategoryId: number | null) {
    if (selectedCategoryId) {
      // Filter products by category id and sort by displayOrder
      return products
        .filter((p) => p.categoryId === selectedCategoryId)
        .sort((a, b) => {
          const displayOrderA = a.displayOrder ?? 0;
          const displayOrderB = b.displayOrder ?? 0;
          return displayOrderA - displayOrderB;
        });
    }
    return products;
  }

  addToCart(product: Product) {
    // Create a URL-friendly version of the product name
    const productSlug = product.name.toLowerCase().replace(/\s+/g, '-');

    // Get the current category if any
    let currentCategory = '';
    const currentUrl = this.router.url;

    // Check if we're in a category view (updated pattern for vendor routing)
    if (currentUrl.includes('/products')) {
      // Extract the category from URL - pattern: /{vendor-slug}/{category}/products
      const categoryMatch = currentUrl.match(/\/[^/]+\/(.+?)\/products/);
      if (categoryMatch && categoryMatch[1]) {
        currentCategory = categoryMatch[1];
        // Navigate to vendor category product page
        this.vendorNavigation.navigateWithVendor([
          currentCategory,
          'product',
          productSlug,
        ]);
      } else {
        // Default navigation if no category found
        this.vendorNavigation.navigateWithVendor(['product', productSlug]);
      }
    } else {
      // No category in URL, use default product route with vendor
      this.vendorNavigation.navigateWithVendor(['product', productSlug]);
    }
  }
}
