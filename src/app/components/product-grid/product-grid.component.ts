import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, Subscription, combineLatest, map } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  MatBottomSheetModule,
  MatBottomSheet,
} from '@angular/material/bottom-sheet';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';

import { AppState } from '../../store/models/app.state';
import { Category } from '../../store/models/app.state';
import * as CategorySelectors from '../../store/selectors/category.selectors';
import * as CategoryActions from '../../store/actions/category.actions';
import * as ProductSelectors from '../../store/selectors/product.selectors';
import * as ProductActions from '../../store/actions/product.actions';
import { selectCartQuantityMap } from '../../store/selectors/cart.selectors';
import { Product } from '../../services/product.service';
import { UtilsService } from '../../shared/utils.service';
import { PromotionalBannerComponent } from '../promotional-banner/promotional-banner.component';
import { HorizontalCategoryMenuComponent } from '../horizontal-category-menu/horizontal-category-menu.component';
import { CategoryGridComponent } from '../category-grid/category-grid.component';
import { LayoutService } from '../../services/layout.service';
import { VendorNavigationService } from '../../services/vendor-navigation.service';
import { VendorService } from '../../services/vendor.service';
import { PRODUCT_PLACEHOLDER_IMAGE } from '../../shared/utils/image-placeholder';
import { VendorCurrencyPipe } from '../../shared/pipes/vendor-currency.pipe';
import { CachedImageDirective } from '../../shared/directives/cached-image.directive';
import { ViewTransitionNameDirective } from '../../shared/directives/view-transition-name.directive';

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
    MatProgressSpinnerModule,
    MatBottomSheetModule,
    HorizontalCategoryMenuComponent,
    VendorCurrencyPipe,
    CachedImageDirective,
    ViewTransitionNameDirective,
  ],
  templateUrl: './product-grid.component.html',
  styleUrls: ['./product-grid.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductGridComponent implements OnInit, OnDestroy {
  private layout = inject(LayoutService);
  private vendorNavigation = inject(VendorNavigationService);
  private vendorService = inject(VendorService);
  private route = inject(ActivatedRoute);
  private store = inject(Store<AppState>);
  private bottomSheet = inject(MatBottomSheet);
  private router = inject(Router);
  private location = inject(Location);
  private utilsService = inject(UtilsService);
  private injector = inject(Injector);

  // Use signals for state
  readonly products = toSignal(
    this.store.select(ProductSelectors.selectAllProducts),
    { initialValue: [] as Product[] }
  );
  readonly productsLoading = toSignal(
    this.store.select(ProductSelectors.selectProductsLoading),
    { initialValue: true }
  );
  readonly selectedCategoryId = toSignal(
    this.store.select(CategorySelectors.selectSelectedCategoryId),
    { initialValue: null as number | null }
  );
  readonly selectedCategory$ = this.store.select(
    CategorySelectors.selectSelectedCategory
  );
  readonly categories = toSignal(
    this.store.select(CategorySelectors.selectAllCategories),
    { initialValue: [] as Category[] }
  );

  // Cart quantity map: productId -> quantity in cart
  readonly cartQuantityMap = toSignal(
    this.store.select(selectCartQuantityMap),
    { initialValue: new Map<number, number>() }
  );

  // Computed filtered products
  readonly filteredProducts = computed(() => {
    const products = this.products();
    const selectedCategoryId = this.selectedCategoryId();
    const categories = this.categories();

    if (selectedCategoryId) {
      return products
        .filter((p) => p.categoryId === selectedCategoryId)
        .sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    }

    // When showing all products, group by category order then sort by price within each category
    const categoryOrderMap = new Map(
      categories.map((c, index) => [c.id, c.displayOrder ?? index])
    );

    return [...products].sort((a, b) => {
      const catOrderA = categoryOrderMap.get(a.categoryId) ?? Number.MAX_SAFE_INTEGER;
      const catOrderB = categoryOrderMap.get(b.categoryId) ?? Number.MAX_SAFE_INTEGER;
      if (catOrderA !== catOrderB) return catOrderA - catOrderB;
      return (a.price ?? 0) - (b.price ?? 0);
    });
  });

  // Responsive signals (LayoutService is the storefront's layout truth)
  readonly isPhone = computed(() => this.layout.formFactor() === 'phone');

  // FR2: horizontal category scroller on portrait form factors (the
  // landscape shell provides the persistent rail instead).
  readonly showHorizontalMenu = computed(() => {
    const factor = this.layout.formFactor();
    return factor === 'phone' || factor === 'tablet-portrait';
  });

  // FR2 column counts for the card grid (phone renders the list layout)
  readonly gridColumns = computed(() =>
    this.layout.formFactor() === 'tablet-portrait' ? 3 : 4
  );

  readonly placeholderImage = PRODUCT_PLACEHOLDER_IMAGE;
  private subscriptions = new Subscription();

  constructor() {
    // Sync category from URL
    this.syncSelectedCategoryFromUrl();
  }

  ngOnInit() {
    // Get current vendor and load vendor-specific products
    const currentVendor = this.vendorService.getCurrentVendor();

    // Load products if not already loaded for this vendor
    const products = this.products();
    if (
      !products ||
      products.length === 0 ||
      (currentVendor && products[0]?.vendorId !== currentVendor.id)
    ) {
      if (currentVendor) {
        this.store.dispatch(
          ProductActions.loadProductsByVendor({
            vendorId: currentVendor.id,
          })
        );
      } else {
        this.store.dispatch(
          ProductActions.loadProducts({ vendorId: undefined })
        );
      }
    }
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
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  isEffectivelyOutOfStock(product: Product): boolean {
    if (product.stockQuantity == null) return false;
    const cartQty = this.cartQuantityMap().get(product.id) || 0;
    return product.stockQuantity - cartQty <= 0;
  }

  addToCart(product: Product, event?: Event) {
    // Morph source: the clicked card's image becomes the product hero.
    const img = (event?.currentTarget as HTMLElement | undefined)?.querySelector('img');
    img?.style.setProperty('view-transition-name', 'product-hero');

    // Create a URL-friendly version of the product name
    const productSlug = product.name.toLowerCase().replace(/\s+/g, '-');

    // Prefer the route param instead of parsing router.url (prevents nested %2F encoding).
    const categorySlug = this.route.snapshot.paramMap.get('category');
    if (categorySlug) {
      this.vendorNavigation.navigateWithVendor([
        categorySlug,
        'product',
        productSlug,
      ]);
      return;
    }

    // Fallback: if we're on `/promotional-banner/products` (no category in URL),
    // we can’t build `:category/product/:productName` reliably here.
    this.vendorNavigation.navigateWithVendor(['product', productSlug]);
  }
}
