import {
  Component,
  OnInit,
  inject,
  signal,
  ChangeDetectorRef,
  OnDestroy,
} from '@angular/core';
import { FrenchDateService } from '../../services/french-date.service';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { OrdersService } from '../../services/orders.service';
import { PaymentService } from '../../services/payment.service';
import { SupabaseService } from '../../services/supabase.service';
import { Order, OrderStatus } from '../../models/order.model';
import {
  Observable,
  map,
  BehaviorSubject,
  combineLatest,
  firstValueFrom,
  interval,
  Subscription,
} from 'rxjs';
import '@angular/common/locales/global/fr';

@Component({
  selector: 'app-orders-manager',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './orders-manager.component.html',
  styleUrl: './orders-manager.component.scss',
})
export class OrdersManagerComponent implements OnInit, OnDestroy {
  private ordersService = inject(OrdersService);
  private snackBar = inject(MatSnackBar);
  private frenchDateService = inject(FrenchDateService);
  private paymentService = inject(PaymentService);
  private supabaseService = inject(SupabaseService);
  private changeDetectorRef = inject(ChangeDetectorRef);

  // Loading states for individual orders
  private loadingOrdersSubject = new BehaviorSubject<Set<string>>(new Set());
  loadingOrders$ = this.loadingOrdersSubject.asObservable();

  // Global loading state
  isLoading = signal(false);

  // Auto-refresh subscription
  private autoRefreshSubscription?: Subscription;

  dineInOrders$!: Observable<Order[]>;
  takeawayOrders$!: Observable<Order[]>;

  statusLabels: Record<OrderStatus, string> = {
    initiated: 'En attente de validation',
    refused: 'Refusée',
    todo: 'À traiter',
    ongoing: 'En cours',
    done: 'Prête',
    picked: 'Récupérée',
  };

  // Using Material 3 appropriate color mappings
  statusColors: Record<OrderStatus, string> = {
    initiated: 'warn', // Orange/Warning for orders needing validation
    refused: '', // Red/Error for refused orders
    todo: 'accent', // Blue/Tertiary for confirmed orders
    ongoing: 'accent', // Will use tertiary color in Material 3
    done: 'primary', // Will use primary color in Material 3
    picked: '', // No color, will use default
  };

  // Button colors for each status transition
  buttonColors: Record<OrderStatus, string> = {
    initiated: '', // No single button color for initiated (has accept/refuse buttons)
    refused: '', // No button for refused status
    todo: 'accent', // Blue/Tertiary for "En cours" button
    ongoing: 'primary', // Primary for "Prête" button
    done: '', // Success/Default for "Récupérée" button
    picked: '', // No button for picked status
  };

  // Button icons for each status transition
  buttonIcons: Record<OrderStatus, string> = {
    initiated: '', // No single icon for initiated (has accept/refuse buttons)
    refused: '', // No button for refused status
    todo: 'play_arrow', // Play icon for "En cours"
    ongoing: 'check_circle', // Check icon for "Prête"
    done: 'done_all', // Done all icon for "Récupérée"
    picked: '', // No button for picked status
  };

  ngOnInit() {
    this.setupOrderStreams();
    this.startAutoRefresh();
  }

  ngOnDestroy() {
    // Clean up the auto-refresh subscription
    if (this.autoRefreshSubscription) {
      this.autoRefreshSubscription.unsubscribe();
    }
  }

  private startAutoRefresh() {
    // Start auto-refresh with 10-second interval
    this.autoRefreshSubscription = interval(10000).subscribe(() => {
      console.log('Auto-refreshing orders...');
      this.refreshOrdersSilently();
    });
  }

  private async refreshOrdersSilently() {
    try {
      // Silently refresh without showing loading indicator or messages
      await this.ordersService.loadOrders();
      console.log('Orders refreshed successfully');
    } catch (error) {
      console.error('Error auto-refreshing orders:', error);
      // Don't show error message for auto-refresh failures
    }
  }

  private setupOrderStreams() {
    // Set up filtered observables with loading state consideration
    this.dineInOrders$ = combineLatest([
      this.ordersService.orders$,
      this.loadingOrders$,
    ]).pipe(
      map(([orders, loadingOrders]) => {
        const dineInOrders = orders.filter(
          (order) => order.orderType === 'eat-in'
        );

        // Separate orders by status
        const initiatedOrders = dineInOrders
          .filter((order) => order.status === 'initiated')
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        const activeOrders = dineInOrders
          .filter((order) => ['todo', 'ongoing', 'done'].includes(order.status))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        const pickedOrders = dineInOrders
          .filter((order) => order.status === 'picked')
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()); // Most recently picked first

        const refusedOrders = dineInOrders
          .filter((order) => order.status === 'refused')
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()); // Most recently refused first

        // Order priority: initiated first (need validation), then active orders, then picked, then refused at bottom
        return [
          ...initiatedOrders,
          ...activeOrders,
          ...pickedOrders,
          ...refusedOrders,
        ];
      })
    );

    this.takeawayOrders$ = combineLatest([
      this.ordersService.orders$,
      this.loadingOrders$,
    ]).pipe(
      map(([orders, loadingOrders]) => {
        const takeaway = orders.filter(
          (order) => order.orderType === 'take-away'
        );

        // Separate orders by status
        const initiatedOrders = takeaway
          .filter((order) => order.status === 'initiated')
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        const activeOrders = takeaway.filter((order) =>
          ['todo', 'ongoing', 'done'].includes(order.status)
        );

        // Sort active orders: ASAP first, then later orders
        const asapOrders = activeOrders
          .filter((order) => order.timing === 'asap')
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        const laterOrders = activeOrders
          .filter((order) => order.timing === 'later')
          .sort((a, b) => {
            const timeA = a.scheduledTime?.getTime() || 0;
            const timeB = b.scheduledTime?.getTime() || 0;
            return timeA - timeB;
          });

        const pickedOrders = takeaway
          .filter((order) => order.status === 'picked')
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

        const refusedOrders = takeaway
          .filter((order) => order.status === 'refused')
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

        // Order priority: initiated first, then ASAP orders, then later orders, then picked, then refused at bottom
        return [
          ...initiatedOrders,
          ...asapOrders,
          ...laterOrders,
          ...pickedOrders,
          ...refusedOrders,
        ];
      })
    );
  }

  async updateOrderStatus(order: Order, newStatus: OrderStatus) {
    // Prevent multiple simultaneous updates for the same order
    if (this.isOrderLoading(order.id)) {
      return;
    }

    // Add order to loading set
    this.setOrderLoading(order.id, true);

    try {
      await this.updateOrderStatusInternal(order, newStatus);
    } finally {
      // Remove order from loading set
      this.setOrderLoading(order.id, false);
    }
  }

  private async updateOrderStatusInternal(
    order: Order,
    newStatus: OrderStatus
  ) {
    console.log(
      `Attempting to update order ${order.id} from ${order.status} to ${newStatus}`
    );

    // Debug: Check if order exists in database
    const orderExists = await this.ordersService.debugOrderExists(order.id);
    if (!orderExists) {
      console.error(`Order ${order.id} does not exist in database`);
      await this.ordersService.debugListAllOrderIds();
      throw new Error(
        `Commande ${order.orderNumber} introuvable dans la base de données`
      );
    }

    // Optimistic update - temporarily update the order in the UI
    const currentOrders = this.ordersService.getCurrentOrders();
    const optimisticOrders = currentOrders.map((o: Order) =>
      o.id === order.id ? { ...o, status: newStatus, updatedAt: new Date() } : o
    );

    // Temporarily update the orders subject for immediate UI feedback
    this.ordersService.updateOrdersOptimistically(optimisticOrders);

    // Trigger change detection to ensure UI updates immediately
    this.changeDetectorRef.detectChanges();

    try {
      // Then perform the actual database update
      await this.ordersService.updateOrderStatus(order.id, newStatus);

      console.log(`Successfully updated order ${order.id} to ${newStatus}`);

      // Show success message
      this.showSuccessMessage(order, newStatus);
    } catch (error: any) {
      console.error('Error updating order:', error);

      // Revert optimistic update by reloading orders
      await this.ordersService.loadOrders();

      // Show error message
      this.showErrorMessage(error);
      throw error; // Re-throw to be handled by caller
    }
  }

  private setOrderLoading(orderId: string, loading: boolean) {
    const currentLoadingOrders = this.loadingOrdersSubject.value;
    const newLoadingOrders = new Set(currentLoadingOrders);

    if (loading) {
      newLoadingOrders.add(orderId);
    } else {
      newLoadingOrders.delete(orderId);
    }

    this.loadingOrdersSubject.next(newLoadingOrders);
  }

  isOrderLoading(orderId: string): boolean {
    return this.loadingOrdersSubject.value.has(orderId);
  }

  private showSuccessMessage(order: Order, newStatus: OrderStatus) {
    const statusLabel = this.statusLabels[newStatus];
    let message = `Commande ${order.orderNumber} mise à jour: ${statusLabel}`;

    // Special messages for validation actions
    if (newStatus === 'todo') {
      message = `Commande ${order.orderNumber} acceptée et confirmée`;
    } else if (newStatus === 'refused') {
      message = `Commande ${order.orderNumber} refusée`;
    }

    this.snackBar.open(message, 'OK', {
      duration: 3000,
      panelClass: ['success-snackbar'],
    });
  }

  private showErrorMessage(error: any) {
    let message = 'Erreur lors de la mise à jour de la commande';

    // Provide more specific error messages based on error type
    if (error?.message?.includes('network')) {
      message = 'Erreur de connexion. Vérifiez votre connexion internet.';
    } else if (error?.message?.includes('unauthorized')) {
      message = "Vous n'êtes pas autorisé à effectuer cette action.";
    } else if (error?.message?.includes('not found')) {
      message = 'Commande introuvable.';
    }

    this.snackBar.open(message, 'Réessayer', {
      duration: 5000,
      panelClass: ['error-snackbar'],
    });
  }

  getNextStatus(currentStatus: OrderStatus): OrderStatus | null {
    const statusFlow: Record<OrderStatus, OrderStatus | null> = {
      initiated: null, // Initiated orders need manual validation (accept/refuse)
      refused: null, // Refused orders have no next status
      todo: 'ongoing',
      ongoing: 'done',
      done: 'picked',
      picked: null,
    };
    return statusFlow[currentStatus];
  }

  getNextStatusLabel(currentStatus: OrderStatus): string {
    const nextStatus = this.getNextStatus(currentStatus);
    return nextStatus ? this.statusLabels[nextStatus] : '';
  }

  canUpdateStatus(order: Order): boolean {
    // For initiated orders, we show accept/refuse buttons instead of next status
    if (order.status === 'initiated') {
      return false; // Use separate validation methods
    }
    return (
      this.getNextStatus(order.status) !== null &&
      !this.isOrderLoading(order.id)
    );
  }

  // New methods for order validation
  canValidateOrder(order: Order): boolean {
    return order.status === 'initiated' && !this.isOrderLoading(order.id);
  }

  async acceptOrder(order: Order) {
    console.log('Accepting order:', order.id, order.orderNumber);

    // Add order to loading set early to prevent multiple clicks
    this.setOrderLoading(order.id, true);

    try {
      // 1. First, capture the payment
      console.log('Retrieving payment for order:', order.id);
      const payment = await this.supabaseService.getPaymentByOrderId(order.id);

      if (!payment) {
        throw new Error('Aucun paiement trouvé pour cette commande');
      }

      console.log('Found payment:', payment);

      // Only capture if payment provider is PayGreen and status is not already captured
      if (payment.provider === 'paygreen' && payment.status !== 'completed') {
        console.log('Capturing PayGreen payment:', payment.provider_payment_id);

        try {
          const captureResponse = await firstValueFrom(
            this.paymentService.capturePayment(
              payment.provider_payment_id,
              'paygreen'
            )
          );

          console.log('Payment capture response:', captureResponse);

          // Update payment status in database
          await this.supabaseService.updatePaymentStatus(
            payment.id,
            'completed'
          );
          console.log('Payment status updated to completed');
        } catch (captureError) {
          console.error('Error capturing payment:', captureError);
          throw new Error('Erreur lors de la capture du paiement');
        }
      } else if (payment.provider === 'stripe') {
        console.log(
          'Stripe payment detected - capture should be handled on backend'
        );
        // For Stripe, we assume capture is handled automatically or on backend
      } else {
        console.log(
          'Payment already captured or unsupported provider:',
          payment.status,
          payment.provider
        );
      }

      // 2. Update the order status using the internal method (avoids loading state conflicts)
      await this.updateOrderStatusInternal(order, 'todo');
    } catch (error) {
      console.error('Error accepting order:', error);

      // Revert optimistic update by reloading orders on error
      await this.ordersService.loadOrders();

      // Show error message
      let errorMessage = "Erreur lors de l'acceptation de la commande";
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      this.snackBar.open(errorMessage, 'Fermer', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    } finally {
      // Always remove from loading set
      this.setOrderLoading(order.id, false);
    }
  }

  async refuseOrder(order: Order) {
    await this.updateOrderStatus(order, 'refused');
  }

  formatScheduledTime(date: Date | undefined): string {
    if (!date) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  // Additional French date formatting methods
  formatOrderCreatedTime(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  formatFullDateTime(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) {
      return "À l'instant";
    } else if (diffInMinutes < 60) {
      return `Il y a ${diffInMinutes} min`;
    } else if (diffInMinutes < 1440) {
      // Less than 24 hours
      const hours = Math.floor(diffInMinutes / 60);
      return `Il y a ${hours}h`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
    }
  }

  formatScheduledDate(date: Date | undefined): string {
    if (!date) return '';
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return "Aujourd'hui";
    }

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    if (isTomorrow) {
      return 'Demain';
    }

    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(date);
  }

  // Utility method to refresh orders manually
  async refreshOrders() {
    this.isLoading.set(true);
    try {
      await this.ordersService.loadOrders();
      this.snackBar.open('Commandes actualisées', 'OK', { duration: 2000 });
    } catch (error) {
      console.error('Error refreshing orders:', error);
      this.snackBar.open("Erreur lors de l'actualisation", 'Fermer', {
        duration: 3000,
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  // TrackBy function for better performance with ngFor
  trackByOrderId(index: number, order: Order): string {
    return order.id;
  }

  // Debug method to track status changes
  debugOrderStatus(order: Order): string {
    const statusLabel = this.statusLabels[order.status];
    console.log(
      `Order ${order.id} (${order.orderNumber}) status: ${order.status} -> "${statusLabel}"`
    );
    return statusLabel;
  }
}
