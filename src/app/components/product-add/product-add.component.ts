import { Component, Injector, OnInit } from '@angular/core';
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
    private router: Router
  ) {}

  ngOnInit(): void {
    // Get product from store based on the route parameter
    document.startViewTransition(() => {
      this.route.paramMap
        .pipe(
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
        )
        .subscribe((product) => {
          this.product = product;
          this.utilsService.createRenderPromise(this.injector);
        });
    });
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
    // In a real app, you would navigate back or remove from cart
    console.log('Item removed');
  }

  addToCart(product: Product): void {
    // In a real app, you would dispatch an action to add to cart
    console.log('Added to cart:', product, 'Quantity:', this.quantity);

    // Navigate to the home page with smooth transition
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        this.router.navigate(['/']);
      });
    } else {
      // Fallback for browsers that don't support view transitions
      this.router.navigate(['/']);
    }
  }
}
