import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Product } from '../../services/product.service';

@Component({
  selector: 'app-product-details-sheet',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './product-details-sheet.component.html',
  styleUrls: ['./product-details-sheet.component.scss'],
})
export class ProductDetailsSheetComponent {
  constructor(
    private bottomSheetRef: MatBottomSheetRef<ProductDetailsSheetComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: { product: Product }
  ) {}

  close(): void {
    this.bottomSheetRef.dismiss();
  }

  addToCart(): void {
    // You would implement the actual cart addition logic here
    console.log('Added to cart:', this.data.product);
    this.bottomSheetRef.dismiss();
  }
}
