import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { Store } from '@ngrx/store';
import { AppState } from '../../../store/models/app.state';
import * as CartActions from '../../../store/actions/cart.actions';
import { ProductService } from '../../../services/product.service';
import {
  ProductStep,
  ProductStepOption,
} from '../../../models/multi-step-product.model';
import { MatBadgeModule } from '@angular/material/badge';
import { VendorCurrencyPipe } from '../../../shared/pipes/vendor-currency.pipe';

@Component({
  selector: 'app-product-option-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatRippleModule,
    MatButtonModule,
    MatBadgeModule,
    VendorCurrencyPipe,
  ],
  templateUrl: './product-option-card.component.html',
  styleUrls: ['./product-option-card.component.scss'],
})
export class ProductOptionCardComponent {
  @Input() option!: ProductStepOption;
  @Input() step!: ProductStep;
  @Input() isSelected: boolean = false;
  @Input() isDisabled: boolean = false;
  @Input() isOutOfStock: boolean = false;

  @Output() optionClicked = new EventEmitter<{
    step: ProductStep;
    optionId: number;
  }>();

  private store = inject(Store<AppState>);
  private productService = inject(ProductService);

  onCardClick(): void {
    if (!this.isDisabled && this.option.isAvailable) {
      this.optionClicked.emit({
        step: this.step,
        optionId: this.option.id,
      });
    }
  }

  // Add product option separately to cart
  onAddSeparatelyToCart(event: Event): void {
    event.stopPropagation(); // Prevent card selection

    if (this.canBeSoldSeparately() && this.option.productId) {
      // Fetch the product and add to cart
      this.productService
        .getProductById(this.option.productId)
        .subscribe((product) => {
          if (product) {
            this.store.dispatch(
              CartActions.addToCart({
                product: product,
                quantity: 1,
              })
            );
          }
        });
    }
  }

  // Check if this option can be sold separately
  canBeSoldSeparately(): boolean {
    return (
      this.option.optionType === 'product' && this.option.productId != null
    );
  }

  // Check if this is a component option
  isComponentOption(): boolean {
    return this.option.optionType === 'component';
  }
}
