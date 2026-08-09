import {
  Component,
  Injector,
  OnInit,
  HostListener,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Store } from '@ngrx/store';
import {
  Observable,
  Subject,
  map,
  switchMap,
  tap,
  combineLatest,
  distinctUntilChanged,
  startWith,
  filter,
  debounceTime,
  take,
  takeUntil,
  shareReplay,
} from 'rxjs';
import { AppState } from '../../store/models/app.state';
import * as ProductSelectors from '../../store/selectors/product.selectors';
import * as ProductActions from '../../store/actions/product.actions';
import * as MultiStepProductSelectors from '../../store/selectors/multi-step-product.selectors';
import * as MultiStepProductActions from '../../store/actions/multi-step-product.actions';
import { Product } from '../../services/product.service';
import { UtilsService } from '../../shared/utils.service';
import { addToCart } from '../../store/actions/cart.actions';
import { selectCartQuantityByProductId } from '../../store/selectors/cart.selectors';
import { VendorNavigationService } from '../../services/vendor-navigation.service';
import { VendorService } from '../../services/vendor.service';
import { AddProductMultiStepComponent } from '../add-product-multi-step/add-product-multi-step.component';
import { CartBadgeVisibilityService } from '../../services/cart-badge-visibility.service';
import { RegularProductViewComponent } from './regular-product-view/regular-product-view.component';
import { UpsellService, UpsellOffer } from '../../services/upsell.service';

@Component({
  selector: 'app-product-add',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    AddProductMultiStepComponent,
    RegularProductViewComponent,
  ],
  templateUrl: './product-add.component.html',
  styleUrl: './product-add.component.scss',
})
export class ProductAddComponent implements OnInit, OnDestroy {
  product$!: Observable<Product | undefined>;
  product: Product | undefined;
  quantity: number = 1;
  cartQuantityForProduct: number = 0;
  productsLoading$!: Observable<boolean>;

  private destroy$ = new Subject<void>();
  private lastInitializedProductId: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private store: Store<AppState>,
    private utilsService: UtilsService,
    private injector: Injector,
    private router: Router,
    private vendorNavigation: VendorNavigationService,
    private vendorService: VendorService,
    private cartBadgeVisibilityService: CartBadgeVisibilityService,
    private upsellService: UpsellService
  ) {}

  ngOnInit(): void {
    // Hide cart badge when on product add page
    this.cartBadgeVisibilityService.hideCartBadge();

    // Ensure products are loaded (handles page refresh where store is empty)
    this.ensureProductsLoaded();

    this.productsLoading$ = this.store.select(ProductSelectors.selectProductsLoading);

    this.product$ = this.route.paramMap.pipe(
      map((params) =>
        params.get('productName')?.toLowerCase().replace(/-/g, ' ')
      ),
      switchMap((productName) =>
        this.store.select(ProductSelectors.selectAllProducts).pipe(
          map((products) => {
            const product = products.find(
              (p) => p.name.toLowerCase().replace(/-/g, ' ') === productName
            );
            return product;
          }),
          filter((product) => !!product) // Only emit when product is found
        )
      ),
      distinctUntilChanged((prev, curr) => prev?.id === curr?.id),
      tap((product) => {
        this.product = product;
        // Track how much of this product is already in the cart
        if (product) {
          this.store
            .select(selectCartQuantityByProductId(product.id))
            .pipe(takeUntil(this.destroy$))
            .subscribe((qty) => (this.cartQuantityForProduct = qty));
        }
        // Initialize multi-step product if it's a multi-step product and haven't initialized this product yet
        if (
          product?.isMultiStep &&
          product.id !== this.lastInitializedProductId
        ) {
          this.lastInitializedProductId = product.id;
          this.store.dispatch(
            MultiStepProductActions.initializeMultiStepProduct({
              productId: product.id,
            })
          );
        }
      }),
      takeUntil(this.destroy$),
      shareReplay(1) // Share the observable to prevent multiple subscriptions
    );
  }

  private ensureProductsLoaded(): void {
    const currentVendor = this.vendorService.getCurrentVendor();
    if (currentVendor) {
      this.store.dispatch(
        ProductActions.loadProductsByVendor({ vendorId: currentVendor.id })
      );
    } else {
      // Vendor may not be set yet on refresh; wait for it
      this.vendorService.currentVendor$
        .pipe(
          filter((vendor) => !!vendor),
          takeUntil(this.destroy$)
        )
        .subscribe((vendor) => {
          this.store.dispatch(
            ProductActions.loadProductsByVendor({ vendorId: vendor!.id })
          );
        });
    }
  }

  private returnPathSegments(): string[] {
    const category = this.route.snapshot.paramMap.get('category');
    return category
      ? ['promotional-banner', category, 'products']
      : ['promotional-banner', 'products'];
  }

  private navigateBackToProducts(): void {
    this.vendorNavigation.navigateWithVendor(this.returnPathSegments());
  }

  // Post-add routing (SPEC-UPSELL.md): a staged offer detours through the
  // upsell page; otherwise straight back to the grid as before.
  completePostAdd(offer: UpsellOffer | null): void {
    if (offer) {
      this.upsellService.stageOffer(offer, this.returnPathSegments());
      this.vendorNavigation.navigateWithVendor(['upsell']);
    } else {
      this.navigateBackToProducts();
    }
  }

  private transitionTo(navigate: () => void): void {
    if (document.startViewTransition) {
      document.startViewTransition(() => navigate());
    } else {
      navigate();
    }
  }

  incrementQuantity(): void {
    const stock = this.product?.stockQuantity;
    if (stock != null && (this.quantity + this.cartQuantityForProduct) >= stock) return;
    this.quantity++;
  }

  decrementQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  removeItem(): void {
    this.quantity = 0;
    this.navigateBackToProducts();
  }

  addToCart(data: {
    product: Product;
    comment?: string;
    customisationSelections?: Map<number, number[]>;
  }): void {
    this.store.dispatch(
      addToCart({
        product: data.product,
        quantity: this.quantity,
        comment: data.comment,
        customisationSelections: data.customisationSelections,
      })
    );
    // Decide the post-add destination (upsell page or grid), then navigate
    // inside the same view transition as before.
    this.upsellService
      .decidePostAddOffer(data.product)
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe({
        next: (offer) => this.transitionTo(() => this.completePostAdd(offer)),
        error: () => this.transitionTo(() => this.navigateBackToProducts()),
      });
  }

  closePage(): void {
    this.navigateBackToProducts();
  }

  // Handle swipe gestures on mobile
  private touchStartX: number | null = null;

  ngOnDestroy(): void {
    // Show cart badge when leaving product add page
    this.cartBadgeVisibilityService.showCartBadge();

    // Reset multi-step product state to avoid pollution
    this.store.dispatch(MultiStepProductActions.resetConfiguration());

    // Reset tracking
    this.lastInitializedProductId = null;

    // Complete all subscriptions
    this.destroy$.next();
    this.destroy$.complete();
  }
}
