import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Store } from '@ngrx/store';
import {
  Observable,
  Subject,
  map,
  switchMap,
  tap,
  distinctUntilChanged,
  filter,
  take,
  takeUntil,
  shareReplay,
} from 'rxjs';
import { AppState } from '../../store/models/app.state';
import * as ProductSelectors from '../../store/selectors/product.selectors';
import * as ProductActions from '../../store/actions/product.actions';
import * as MultiStepProductActions from '../../store/actions/multi-step-product.actions';
import { Product } from '../../services/product.service';
import { addToCart } from '../../store/actions/cart.actions';
import { selectCartQuantityByProductId } from '../../store/selectors/cart.selectors';
import { VendorNavigationService } from '../../services/vendor-navigation.service';
import { VendorService } from '../../services/vendor.service';
import { AddProductMultiStepComponent } from '../add-product-multi-step/add-product-multi-step.component';
import { CartBadgeVisibilityService } from '../../services/cart-badge-visibility.service';
import { RegularProductViewComponent } from './regular-product-view/regular-product-view.component';
import {
  UpsellService,
  productGridPath,
  categoryGridPath,
} from '../../services/upsell.service';
import { CartCelebrationService } from '../../services/cart-celebration.service';

@Component({
  selector: 'app-product-add',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
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
    private vendorNavigation: VendorNavigationService,
    private vendorService: VendorService,
    private cartBadgeVisibilityService: CartBadgeVisibilityService,
    private upsellService: UpsellService,
    private cartCelebration: CartCelebrationService
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
    return productGridPath(this.route.snapshot.paramMap.get('category'));
  }

  private navigateBackToProducts(): void {
    this.vendorNavigation.navigateWithVendor(this.returnPathSegments());
  }

  private transitionTo(navigate: () => void): void {
    // The router's withViewTransitions owns the leave animation. Wrapping
    // the navigation in a manual document.startViewTransition aborts BOTH
    // transitions (nested startViewTransition = invalid state), so
    // navigate directly.
    navigate();
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
    const pendingAdd = {
      quantity: this.quantity,
      comment: data.comment,
      customisationSelections: data.customisationSelections,
    };
    const performAdd = () => {
      this.store.dispatch(addToCart({ product: data.product, ...pendingAdd }));
      this.cartCelebration.celebrate();
    };
    // Decide BEFORE dispatching: a convert offer defers the add until the
    // customer chooses on the upsell page — decline adds the product there,
    // accept replaces it with the menu (SPEC-UPSELL.md). Pool offers and
    // no-offer adds go to the cart immediately as before.
    this.upsellService
      .decidePostAddOffer(data.product, pendingAdd)
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe({
        next: (offer) => {
          if (offer?.tier !== 'convert') {
            performAdd();
          }
          // Post-add lands on the category grid (user decision 2026-08-11);
          // cancel/close still returns to the product grid.
          this.transitionTo(() =>
            this.upsellService.completePostAdd(offer, categoryGridPath())
          );
        },
        error: () => {
          performAdd();
          this.transitionTo(() =>
            this.vendorNavigation.navigateWithVendor(categoryGridPath())
          );
        },
      });
  }

  closePage(): void {
    this.navigateBackToProducts();
  }

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
