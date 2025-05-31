import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { Observable, combineLatest, map, startWith } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { selectCartTotalCount } from '../../store/selectors/cart.selectors';
import { AppState } from '../../store/models/app.state';
import { CartDetailsSheetComponent } from '../cart-details-sheet/cart-details-sheet.component';
import { Router, NavigationEnd } from '@angular/router';

@Component({
  selector: 'app-cart-badge',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './cart-badge.component.html',
  styleUrls: ['./cart-badge.component.scss'],
})
export class CartBadgeComponent {
  cartCount$: Observable<number>;
  showBadge$: Observable<boolean>;

  constructor(
    private store: Store<AppState>,
    private bottomSheet: MatBottomSheet,
    private router: Router
  ) {
    this.cartCount$ = this.store.select(selectCartTotalCount);
    // Observable that emits true if not on add product page
    this.showBadge$ = this.router.events.pipe(
      startWith(null),
      map(() => {
        const url = this.router.url;
        // Matches /product/:productName or /:category/product/:productName
        const addProductRegex = /^\/(?:[\w-]+\/)?product\//;
        return !addProductRegex.test(url);
      })
    );
  }

  openCartDetails() {
    this.bottomSheet.open(CartDetailsSheetComponent);
  }
}
