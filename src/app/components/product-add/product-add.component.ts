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
  takeUntil,
  shareReplay,
} from 'rxjs';
import { AppState } from '../../store/models/app.state';
import * as ProductSelectors from '../../store/selectors/product.selectors';
import * as MultiStepProductSelectors from '../../store/selectors/multi-step-product.selectors';
import * as MultiStepProductActions from '../../store/actions/multi-step-product.actions';
import { Product } from '../../services/product.service';
import { UtilsService } from '../../shared/utils.service';
import { addToCart } from '../../store/actions/cart.actions';
import { VendorNavigationService } from '../../services/vendor-navigation.service';
import { AddProductMultiStepComponent } from '../add-product-multi-step/add-product-multi-step.component';
import { CartBadgeVisibilityService } from '../../services/cart-badge-visibility.service';
import { RegularProductViewComponent } from './regular-product-view/regular-product-view.component';

@Component({
  selector: 'app-product-add',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
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

  // Multi-step observables
  steps$!: Observable<any[]>;
  isSingleStepProduct$!: Observable<boolean | null>;

  private destroy$ = new Subject<void>();
  private lastInitializedProductId: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private store: Store<AppState>,
    private utilsService: UtilsService,
    private injector: Injector,
    private router: Router,
    private vendorNavigation: VendorNavigationService,
    private cartBadgeVisibilityService: CartBadgeVisibilityService
  ) {}

  ngOnInit(): void {
    // Hide cart badge when on product add page
    this.cartBadgeVisibilityService.hideCartBadge();

    this.product$ = this.route.paramMap.pipe(
      map((params) =>
        params.get('productName')?.toLowerCase().replace(/-/g, ' ')
      ),
      switchMap((productName) =>
        this.store.select(ProductSelectors.selectAllProducts).pipe(
          map((products) => {
            const product = products.find(
              (p) => p.name.toLowerCase() === productName
            );
            return product;
          }),
          filter((product) => !!product) // Only emit when product is found
        )
      ),
      distinctUntilChanged((prev, curr) => prev?.id === curr?.id),
      tap((product) => {
        this.product = product;
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

    // Initialize multi-step observables
    this.steps$ = this.store
      .select(MultiStepProductSelectors.selectProductSteps)
      .pipe(
        startWith([]), // Start with empty array to prevent undefined issues
        distinctUntilChanged(
          (prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)
        ),
        takeUntil(this.destroy$),
        shareReplay(1) // Share the observable to prevent multiple subscriptions
      );

    // Observable to detect if multi-step product has only one step (excluding summary)
    this.isSingleStepProduct$ = combineLatest([
      this.product$,
      this.steps$,
    ]).pipe(
      debounceTime(0), // Ensure this runs after the current change detection cycle
      map(([product, steps]): boolean | null => {
        if (!product?.isMultiStep) return false;

        // If no steps loaded yet, return null to indicate still loading
        if (!steps || steps.length === 0) {
          return null;
        }

        // Filter out summary steps and check if only one step remains
        const nonSummarySteps = steps.filter(
          (step) => step.stepType !== 'summary'
        );
        return nonSummarySteps.length === 1;
      }),
      distinctUntilChanged(), // Prevent unnecessary emissions
      startWith(null), // Start with null to indicate loading state
      takeUntil(this.destroy$),
      shareReplay(1) // Share the observable to prevent multiple subscriptions
    );
  }

  incrementQuantity(): void {
    this.quantity++;
  }

  decrementQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  removeItem(): void {
    this.quantity = 0;
    // Navigate back to products page
    this.vendorNavigation.navigateWithVendor('products');
  }

  addToCart(data: { product: Product; comment?: string }): void {
    this.store.dispatch(
      addToCart({
        product: data.product,
        quantity: this.quantity,
        comment: data.comment,
      })
    );
    // Navigate to the products page with smooth transition
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        this.vendorNavigation.navigateWithVendor('products');
      });
    } else {
      // Fallback for browsers that don't support view transitions
      this.vendorNavigation.navigateWithVendor('products');
    }
  }

  closePage(): void {
    this.vendorNavigation.navigateWithVendor('products');
  }

  // Handle swipe gestures on mobile
  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0].clientX;
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(event: TouchEvent): void {
    if (!this.touchStartX) return;

    const touchEndX = event.changedTouches[0].clientX;
    const diff = this.touchStartX - touchEndX;

    // Swipe right to close (if swipe is more than 50px)
    if (diff < -50) {
      this.closePage();
    }

    this.touchStartX = null;
  }

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
