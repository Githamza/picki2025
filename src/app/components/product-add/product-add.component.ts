import { Component, Injector, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Store } from '@ngrx/store';
import { Observable, map, switchMap, tap } from 'rxjs';
import { AppState } from '../../store/models/app.state';
import * as ProductSelectors from '../../store/selectors/product.selectors';
import { Product } from '../../services/product.service';
import { UtilsService } from '../../shared/utils.service';
import { addToCart } from '../../store/actions/cart.actions';
import { VendorNavigationService } from '../../services/vendor-navigation.service';

@Component({
  selector: 'app-product-add',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './product-add.component.html',
  styleUrl: './product-add.component.scss',
})
export class ProductAddComponent implements OnInit {
  product$!: Observable<Product | undefined>;
  product: Product | undefined;
  quantity: number = 1;

  constructor(
    private route: ActivatedRoute,
    private store: Store<AppState>,
    private utilsService: UtilsService,
    private injector: Injector,
    private router: Router,
    private vendorNavigation: VendorNavigationService
  ) {}

  ngOnInit(): void {
    // Get product from store based on the route parameter
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
          })
        )
      )
    );
    // .subscribe((product) => {
    //   this.product = product;
    //   this.utilsService.createRenderPromise(this.injector);
    // });
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

  addToCart(product: Product): void {
    this.store.dispatch(addToCart({ product, quantity: this.quantity }));
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
}
