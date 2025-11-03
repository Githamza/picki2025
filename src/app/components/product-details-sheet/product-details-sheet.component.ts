import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { Product, ProductService } from '../../services/product.service';
import { Store } from '@ngrx/store';
import { addToCart } from '../../store/actions/cart.actions';
import { AppState } from '../../store/models/app.state';
import {
  ProductComplement,
  ComplementSelection,
} from '../../models/complement.model';
import { PRODUCT_PLACEHOLDER_IMAGE } from '../../shared/utils/image-placeholder';

@Component({
  selector: 'app-product-details-sheet',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatRadioModule,
    MatCheckboxModule,
    MatDividerModule,
    FormsModule,
  ],
  templateUrl: './product-details-sheet.component.html',
  styleUrls: ['./product-details-sheet.component.scss'],
})
export class ProductDetailsSheetComponent implements OnInit {
  comment = signal('');
  complements = signal<ProductComplement[]>([]);
  selectedComplements = signal<ComplementSelection[]>([]);
  validationErrors = signal<string[]>([]);
  isLoading = signal(false);
  readonly placeholderImage = PRODUCT_PLACEHOLDER_IMAGE;

  constructor(
    private bottomSheetRef: MatBottomSheetRef<ProductDetailsSheetComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: { product: Product },
    private store: Store<AppState>,
    private productService: ProductService
  ) {}

  ngOnInit(): void {
    this.loadComplements();
  }

  private loadComplements(): void {
    this.isLoading.set(true);
    this.productService.getProductComplements(this.data.product.id).subscribe({
      next: (complements) => {
        this.complements.set(complements);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading complements:', error);
        this.isLoading.set(false);
      },
    });
  }

  close(): void {
    this.bottomSheetRef.dismiss();
  }

  onComplementSelectionChange(
    complementId: number,
    selected: boolean,
    quantity: number = 1
  ): void {
    const currentSelections = this.selectedComplements();
    const complement = this.complements().find(
      (c) => c.complement_product_id === complementId
    );

    if (!complement) return;

    const price = this.productService.calculateComplementPrice(complement);

    if (selected) {
      // Add or update selection
      const existingIndex = currentSelections.findIndex(
        (s) => s.complement_product_id === complementId
      );
      if (existingIndex >= 0) {
        currentSelections[existingIndex] = {
          complement_product_id: complementId,
          quantity,
          unit_price: price,
          total_price: price * quantity,
        };
      } else {
        currentSelections.push({
          complement_product_id: complementId,
          quantity,
          unit_price: price,
          total_price: price * quantity,
        });
      }
    } else {
      // Remove selection
      const filteredSelections = currentSelections.filter(
        (s) => s.complement_product_id !== complementId
      );
      this.selectedComplements.set(filteredSelections);
      return;
    }

    this.selectedComplements.set([...currentSelections]);
    this.validateSelections();
  }

  private validateSelections(): void {
    const validation = this.productService.validateComplementSelections(
      this.complements(),
      this.selectedComplements()
    );
    this.validationErrors.set(validation.errors);
  }

  getTotalPrice(): number {
    const basePrice = this.data.product.price;
    const complementsPrice =
      this.productService.calculateComplementSelectionTotal(
        this.complements(),
        this.selectedComplements()
      );
    return basePrice + complementsPrice;
  }

  getComplementPrice(complement: ProductComplement): number {
    return this.productService.calculateComplementPrice(complement);
  }

  isComplementSelected(complementId: number): boolean {
    return this.selectedComplements().some(
      (s) => s.complement_product_id === complementId
    );
  }

  canAddToCart(): boolean {
    return this.validationErrors().length === 0;
  }

  addToCart(): void {
    if (!this.canAddToCart()) {
      return;
    }

    this.store.dispatch(
      addToCart({
        product: this.data.product,
        quantity: 1,
        comment: this.comment().trim() || undefined,
        selectedComplements:
          this.selectedComplements().length > 0
            ? this.selectedComplements()
            : undefined,
      })
    );

    console.log('Added to cart:', {
      product: this.data.product,
      complements: this.selectedComplements(),
      comment: this.comment(),
      totalPrice: this.getTotalPrice(),
    });

    this.bottomSheetRef.dismiss();
  }
}
