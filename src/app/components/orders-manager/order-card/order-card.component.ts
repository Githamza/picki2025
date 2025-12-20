import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Order, OrderStatus } from '../../../models/order.model';
import { VendorCurrencyPipe } from '../../../shared/pipes/vendor-currency.pipe';

@Component({
  selector: 'app-order-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    VendorCurrencyPipe,
  ],
  templateUrl: './order-card.component.html',
  styleUrl: './order-card.component.scss',
})
export class OrderCardComponent {
  // Inputs
  order = input.required<Order>();
  isCompact = input<boolean>(false);
  isOrderLoading = input.required<(orderId: string) => boolean>();
  statusLabels = input.required<Record<OrderStatus, string>>();
  statusColors = input.required<Record<OrderStatus, string>>();
  buttonColors = input.required<Record<OrderStatus, string>>();
  buttonIcons = input.required<Record<OrderStatus, string>>();
  canValidateOrder = input.required<(order: Order) => boolean>();
  canUpdateStatus = input.required<(order: Order) => boolean>();
  getNextStatus = input.required<(status: OrderStatus) => OrderStatus | null>();
  getNextStatusLabel = input.required<(status: OrderStatus) => string>();
  formatScheduledTime = input.required<(date: Date | undefined) => string>();
  formatScheduledDate = input.required<(date: Date | undefined) => string>();

  // Outputs
  cardClick = output<Order>();
  updateStatus = output<{ order: Order; status: OrderStatus }>();

  onCardClick() {
    this.cardClick.emit(this.order());
  }

  onVoirPlusClick(event: Event) {
    event.stopPropagation();
    this.cardClick.emit(this.order());
  }

  onUpdateStatus(event: Event, newStatus: OrderStatus) {
    event.stopPropagation();
    this.updateStatus.emit({ order: this.order(), status: newStatus });
  }

  getOrderTypeIcon(orderType: string): string {
    switch (orderType) {
      case 'take-away':
        return 'shopping_bag';
      case 'delivery':
        return 'local_shipping';
      case 'eat-in':
        return 'restaurant';
      default:
        return 'shopping_bag';
    }
  }

  getOrderTypeLabel(orderType: string): string {
    switch (orderType) {
      case 'take-away':
        return 'À Emporter';
      case 'delivery':
        return 'Livraison';
      case 'eat-in':
        return 'Sur Place';
      default:
        return 'Commande';
    }
  }
}

