import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { VendorCurrencyPipe } from '../../pipes/vendor-currency.pipe';

@Component({
  selector: 'app-add-to-cart-bar',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, VendorCurrencyPipe],
  templateUrl: './add-to-cart-bar.component.html',
  styleUrl: './add-to-cart-bar.component.scss',
})
export class AddToCartBarComponent {
  @Input() quantity = 1;
  @Input() totalPrice = 0;
  @Input() buttonText = 'Ajouter';
  @Input() stockLimitReached = false;
  @Input() stockQuantity: number | null = null;
  @Input() cartQuantityForProduct = 0;
  @Input() disabled = false;
  /** Hidden while a multi-step configuration is in progress — quantity is
   *  a decision for the review page, and the trash FAB would navigate away
   *  mid-configuration. */
  @Input() showQuantityControls = true;

  @Output() increment = new EventEmitter<void>();
  @Output() decrement = new EventEmitter<void>();
  @Output() remove = new EventEmitter<void>();
  @Output() addToCart = new EventEmitter<void>();
  /** Emitted when the main button is tapped while disabled — hosts use it
   *  to navigate to whatever is blocking (FR4d: no dead taps). */
  @Output() disabledClick = new EventEmitter<void>();

  onAddClick(): void {
    if (this.disabled) {
      this.disabledClick.emit();
      return;
    }
    this.addToCart.emit();
  }
}
