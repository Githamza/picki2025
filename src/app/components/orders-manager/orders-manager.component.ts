import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { OrdersService } from '../../services/orders.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PaymentService } from '../../services/payment.service';
import { SupabaseService } from '../../services/supabase.service';
import { SupabaseAuthService } from '../../services/supabase-auth.service';
import { EmailService } from '../../services/email.service';
import { VendorService } from '../../services/vendor.service';
import { SoundNotificationService } from '../../services/sound-notification.service';
import { Order, OrderStatus } from '../../models/order.model';
import { OrderDetailsDialogComponent } from './order-details-dialog/order-details-dialog.component';
import { OrderCardComponent } from './order-card/order-card.component';
import {
  Observable,
  map,
  BehaviorSubject,
  combineLatest,
  firstValueFrom,
  interval,
  Subscription,
} from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import '@angular/common/locales/global/fr';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { VendorCurrencyPipe } from '../../shared/pipes/vendor-currency.pipe';
import { OrderType } from '../../services/vendor.service';

export type PeriodFilter = 'today' | 'yesterday' | '7days' | 'month' | 'all';

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
    MatTooltipModule,
    MatMenuModule,
    MatDialogModule,
    OrderCardComponent,
    VendorCurrencyPipe,
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
  private supabaseAuthService = inject(SupabaseAuthService);
  private emailService = inject(EmailService);
  private vendorService = inject(VendorService);
  public soundNotificationService = inject(SoundNotificationService);
  private changeDetectorRef = inject(ChangeDetectorRef);
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private breakpointObserver = inject(BreakpointObserver);

  // Loading states for individual orders
  private loadingOrdersSubject = new BehaviorSubject<Set<string>>(new Set());
  loadingOrders$ = this.loadingOrdersSubject.asObservable();
  isHandset$ = this.breakpointObserver
    .observe([Breakpoints.Handset, Breakpoints.Tablet])
    .pipe(map((result) => result.matches));
  // Global loading state
  isLoading = signal(false);

  // Period filter
  periodFilter = signal<PeriodFilter>('today');
  periodFilterOptions: Array<{ value: PeriodFilter; label: string }> = [
    { value: 'today', label: "Aujourd'hui" },
    { value: 'yesterday', label: 'Depuis hier' },
    { value: '7days', label: 'Depuis 7j' },
    { value: 'month', label: 'Ce mois-ci' },
    { value: 'all', label: 'Tout afficher' },
  ];

  // Computed property to get the selected period label
  selectedPeriodLabel = computed(() => {
    const selected = this.periodFilter();
    const option = this.periodFilterOptions.find(opt => opt.value === selected);
    return option?.label || "Aujourd'hui";
  });

  // Convert orders observable to signal for reactive computation
  private ordersSignal = toSignal(this.ordersService.orders$, { initialValue: [] });

  // Enabled order types from current vendor
  private vendorSignal = toSignal(this.vendorService.currentVendor$, { initialValue: null });

  enabledOrderTypes = computed<OrderType[]>(() => {
    const vendor = this.vendorSignal();
    return vendor?.enabled_order_types?.length
      ? vendor.enabled_order_types
      : (['eat-in', 'take-away', 'delivery'] as OrderType[]);
  });

  showDineInColumn = computed(() => this.enabledOrderTypes().includes('eat-in'));
  showTakeawayColumn = computed(() => this.enabledOrderTypes().includes('take-away'));
  showDeliveryColumn = computed(() => this.enabledOrderTypes().includes('delivery'));
  showPickupDeliveryColumn = computed(() =>
    this.enabledOrderTypes().includes('take-away') || this.enabledOrderTypes().includes('delivery')
  );

  // Computed property to get total amount for selected period
  periodTotalAmount = computed(() => {
    // Explicitly read periodFilter to ensure dependency tracking
    const period = this.periodFilter();
    const orders = this.ordersSignal() || [];
    
    const filteredOrders = this.filterOrdersNotInitiated(this.filterOrdersByPeriod(orders));
    return filteredOrders.reduce((total, order) => total + (order.totalAmount || 0), 0);
  });

  // Auto-refresh subscription
  private autoRefreshSubscription?: Subscription;

  // Order count tracking for new order detection
  private previousOrderCount = 0;
  private previousOrderIds = new Set<string>();

  dineInOrders$!: Observable<Order[]>;
  takeawayOrders$!: Observable<Order[]>;
  combinedPickupDeliveryOrders$!: Observable<Order[]>;

  statusLabels: Record<OrderStatus, string> = {
    initiated: 'En attente de validation',
    paid: 'Payée',
    refused: 'Refusée',
    cancelled: 'Annulée',
    todo: 'À traiter',
    ongoing: 'En cours',
    done: 'Prête',
    picked: 'Récupérée',
  };

  // Using Material 3 appropriate color mappings
  statusColors: Record<OrderStatus, string> = {
    initiated: 'warn', // Orange/Warning for orders needing validation
    paid: 'accent', // Blue/Tertiary for paid orders
    refused: '', // Red/Error for refused orders
    cancelled: '', // No color for cancelled orders
    todo: 'accent', // Blue/Tertiary for confirmed orders
    ongoing: 'accent', // Will use tertiary color in Material 3
    done: 'primary', // Will use primary color in Material 3
    picked: '', // No color, will use default
  };

  // Button colors for each status transition
  buttonColors: Record<OrderStatus, string> = {
    initiated: '', // No single button color for initiated (has accept/refuse buttons)
    paid: 'accent', // Blue/Tertiary for "À traiter" button
    refused: '', // No button for refused status
    cancelled: '', // No button for cancelled status
    todo: 'accent', // Blue/Tertiary for "En cours" button
    ongoing: 'primary', // Primary for "Prête" button
    done: '', // Success/Default for "Récupérée" button
    picked: '', // No button for picked status
  };

  // Button icons for each status transition
  buttonIcons: Record<OrderStatus, string> = {
    initiated: '', // No single icon for initiated (has accept/refuse buttons)
    paid: 'play_arrow', // Play icon for "À traiter"
    refused: '', // No button for refused status
    cancelled: '', // No button for cancelled status
    todo: 'play_arrow', // Play icon for "En cours"
    ongoing: 'check_circle', // Check icon for "Prête"
    done: 'done_all', // Done all icon for "Récupérée"
    picked: '', // No button for picked status
  };

  ngOnInit() {
    this.setupOrderStreams();
    this.startAutoRefresh();
    this.initializeOrderTracking();
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

      // Check for new orders and play sound if found
      await this.checkForNewOrders();
    } catch (error) {
      console.error('Error auto-refreshing orders:', error);
      // Don't show error message for auto-refresh failures
    }
  }

  private filterOrdersByPeriod(orders: Order[]): Order[] {
    const period = this.periodFilter();
    if (period === 'all') return orders;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    console.log('today', today);
    console.log('period', period);
    let startDate: Date;
    
    if (period === 'today') {
      startDate = today;
    } else if (period === 'yesterday') {
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 1);
    } else if (period === '7days') {
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      return orders;
    }

    return orders.filter(order => order.updatedAt >= startDate);
  }
  private filterOrdersNotInitiated(orders: Order[]): Order[] {
    return orders.filter(order => order.status !== 'initiated');
  }
  private setupOrderStreams() {
    // Set up filtered observables with loading state consideration
    this.dineInOrders$ = combineLatest([
      this.ordersService.orders$,
      this.loadingOrders$,
    ]).pipe(
      map(([orders, loadingOrders]) => {
        let dineInOrders = orders.filter(
          (order) =>
            order.orderType === 'eat-in' && order.status !== 'initiated'
        );

        // Apply period filter
        dineInOrders = this.filterOrdersByPeriod(dineInOrders);

        // Sort orders: picked orders at bottom, others by updatedAt (most recent first)
        return dineInOrders.sort((a, b) => {
          // If one is picked and the other isn't, picked goes to bottom
          if (a.status === 'picked' && b.status !== 'picked') return 1;
          if (a.status !== 'picked' && b.status === 'picked') return -1;

          // If both have same picked status, sort by updatedAt
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        });
      })
    );

    this.takeawayOrders$ = combineLatest([
      this.ordersService.orders$,
      this.loadingOrders$,
    ]).pipe(
      map(([orders, loadingOrders]) => {
        let takeaway = orders.filter(
          (order) =>
            order.orderType === 'take-away' && order.status !== 'initiated'
        );

        // Apply period filter
        takeaway = this.filterOrdersByPeriod(takeaway);

        // Sort orders: picked orders at bottom, others by updatedAt (most recent first)
        return takeaway.sort((a, b) => {
          // If one is picked and the other isn't, picked goes to bottom
          if (a.status === 'picked' && b.status !== 'picked') return 1;
          if (a.status !== 'picked' && b.status === 'picked') return -1;

          // If both have same picked status, sort by updatedAt
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        });
      })
    );

    // Combined pickup and delivery orders for tablet view
    this.combinedPickupDeliveryOrders$ = combineLatest([
      this.ordersService.orders$,
      this.loadingOrders$,
      this.vendorService.currentVendor$,
    ]).pipe(
      map(([orders, loadingOrders, vendor]) => {
        const enabledTypes = vendor?.enabled_order_types?.length
          ? vendor.enabled_order_types
          : (['take-away', 'delivery'] as OrderType[]);

        let pickupAndDelivery = orders.filter(
          (order) =>
            ((order.orderType === 'take-away' && enabledTypes.includes('take-away')) ||
              (order.orderType === 'delivery' && enabledTypes.includes('delivery'))) &&
            order.status !== 'initiated'
        );

        // Apply period filter
        pickupAndDelivery = this.filterOrdersByPeriod(pickupAndDelivery);

        // Sort orders: picked orders at bottom, others by updatedAt (most recent first)
        return pickupAndDelivery.sort((a, b) => {
          // If one is picked and the other isn't, picked goes to bottom
          if (a.status === 'picked' && b.status !== 'picked') return 1;
          if (a.status !== 'picked' && b.status === 'picked') return -1;

          // If both have same picked status, sort by updatedAt
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        });
      })
    );
  }

  onPeriodFilterChange(period: PeriodFilter) {
    this.periodFilter.set(period);
    this.setupOrderStreams();
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

      // If order is ready (status -> done) and order type is delivery, create delivery now
      try {
        if (newStatus === 'done' && order.orderType === 'delivery') {
          const delivery =
            await this.supabaseAuthService.getOrderDeliveryByOrderId(order.id);
          if (delivery && !delivery.delivery_id) {
            // Build DeliveryRequest from saved selection
            const providerId = String(delivery.provider);
            const pickup = {
              address: {
                line1: delivery.pickup_line1,
                postalCode: delivery.pickup_postal_code,
                city: delivery.pickup_city,
                countryCode: delivery.pickup_country_code,
                coordinates:
                  delivery.pickup_lat && delivery.pickup_lng
                    ? {
                        lat: Number(delivery.pickup_lat),
                        lng: Number(delivery.pickup_lng),
                      }
                    : undefined,
              },
            };
            const dropoff = {
              address: {
                line1: delivery.dropoff_line1,
                postalCode: delivery.dropoff_postal_code,
                city: delivery.dropoff_city,
                countryCode: delivery.dropoff_country_code,
                coordinates:
                  delivery.dropoff_lat && delivery.dropoff_lng
                    ? {
                        lat: Number(delivery.dropoff_lat),
                        lng: Number(delivery.dropoff_lng),
                      }
                    : undefined,
              },
            };

            // Call Edge Function directly based on provider
            if (providerId === 'stuart') {
              const data = (await this.http
                .post(
                  `${environment.backendUrl}/functions/v1/stuart-delivery`,
                  {
                    action: 'create',
                    pickup,
                    dropoff,
                    vendorId: this.vendorService.getCurrentVendor()?.id,
                  },
                  {
                    headers: {
                      'Content-Type': 'application/json',
                      apikey: environment.supabase.anonKey,
                      Authorization: `Bearer ${environment.supabase.anonKey}`,
                    },
                  }
                )
                .toPromise()) as any;
              await this.supabaseAuthService.updateOrderDeliveryAfterCreation(
                order.id,
                {
                  job_id: data.jobId ?? null,
                  delivery_id: data.deliveryId ?? null,
                  tracking_url: data.trackingUrl ?? null,
                  status: 'created',
                  raw: data.raw ?? null,
                }
              );
            } else if (providerId === 'uber') {
              // Add required contact information and manifest items for Uber Direct
              const pickupWithContact = {
                ...pickup,
                contact: {
                  name: 'Restaurant', // TODO: Get from vendor settings
                  phone_number: '+33123456789', // TODO: Get from vendor settings
                },
              };

              const dropoffWithContact = {
                ...dropoff,
                contact: {
                  name: `${order.customer.firstName} ${order.customer.lastName}`,
                  phone_number: order.customer.phone,
                },
              };

              const manifest_items = order.items.map((item) => ({
                name: item.productName,
                quantity: item.quantity,
                size: 'medium' as const,
              }));

              const data = (await this.http
                .post(
                  `${environment.backendUrl}/functions/v1/uber-direct-delivery`,
                  {
                    action: 'create',
                    pickup: pickupWithContact,
                    dropoff: dropoffWithContact,
                    manifest_items,
                    // Test specifications are now handled automatically by the edge function
                  },
                  {
                    headers: {
                      'Content-Type': 'application/json',
                      apikey: environment.supabase.anonKey,
                      Authorization: `Bearer ${environment.supabase.anonKey}`,
                    },
                  }
                )
                .toPromise()) as any;
              await this.supabaseAuthService.updateOrderDeliveryAfterCreation(
                order.id,
                {
                  job_id: data.jobId ?? null,
                  delivery_id: data.deliveryId ?? null,
                  tracking_url: data.trackingUrl ?? null,
                  status: 'created',
                  raw: data.raw ?? null,
                }
              );
            }
          }
        }
      } catch (deliveryError) {
        console.error(
          'Delivery creation on order ready failed:',
          deliveryError
        );
      }

      // Send ready notification email if status is changing to 'done'
      if (newStatus === 'done') {
        await this.sendReadyNotificationEmail(order);
      }

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

  private async sendReadyNotificationEmail(order: Order) {
    try {
      // Check if ready email has already been sent
      const readyEmailAlreadySent =
        await this.supabaseAuthService.checkReadyEmailSent(order.id);

      if (readyEmailAlreadySent) {
        console.log(
          'Ready notification email already sent for order:',
          order.orderNumber
        );
        return;
      }

      console.log(
        'Sending ready notification email for order:',
        order.orderNumber
      );

      // Prefer current vendor context when available
      const currentVendor = this.vendorService.getCurrentVendor();
      const vendorSlug = currentVendor
        ? this.vendorService.getVendorSlug(currentVendor)
        : undefined;

      // Generate tracking URL
      const trackingUrl = this.emailService.generateTrackingUrl(
        order.id,
        vendorSlug
      );

      // Send ready notification email
      const emailResult = await this.emailService.sendOrderReadyEmail(
        order,
        trackingUrl
      );

      if (emailResult.success) {
        console.log('Ready notification email sent successfully');

        // Mark ready email as sent in the database
        try {
          await this.supabaseAuthService.markReadyEmailSent(order.id);
          console.log(
            'Marked ready email as sent for order:',
            order.orderNumber
          );
        } catch (markError) {
          console.error('Failed to mark ready email as sent:', markError);
          // Don't throw - the email was sent successfully even if we failed to mark it
        }
      } else {
        console.error(
          'Failed to send ready notification email:',
          emailResult.error
        );
        // Don't throw - order update should still succeed even if email fails
      }
    } catch (error) {
      console.error('Error sending ready notification email:', error);
      // Don't throw - email failure shouldn't break the order status update
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

  isOrderLoading = (orderId: string): boolean => {
    return this.loadingOrdersSubject.value.has(orderId);
  };

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

  getNextStatus = (currentStatus: OrderStatus): OrderStatus | null => {
    const statusFlow: Record<OrderStatus, OrderStatus | null> = {
      initiated: null, // Initiated orders need manual validation (accept/refuse)
      paid: 'todo', // Paid orders can be accepted to todo
      refused: null, // Refused orders have no next status
      cancelled: null, // Cancelled orders have no next status
      todo: 'ongoing',
      ongoing: 'done',
      done: 'picked',
      picked: null,
    };
    return statusFlow[currentStatus];
  };

  getNextStatusLabel = (currentStatus: OrderStatus): string => {
    const nextStatus = this.getNextStatus(currentStatus);
    return nextStatus ? this.statusLabels[nextStatus] : '';
  };

  canUpdateStatus = (order: Order): boolean => {
    // For initiated orders, we show accept/refuse buttons instead of next status
    if (order.status === 'paid') {
      return false; // Use separate validation methods
    }
    return (
      this.getNextStatus(order.status) !== null &&
      !this.isOrderLoading(order.id)
    );
  };

  // New methods for order validation
  canValidateOrder = (order: Order): boolean => {
    return (
      (order.status === 'initiated' || order.status === 'paid') &&
      !this.isOrderLoading(order.id)
    );
  };

  async acceptOrder(order: Order) {
    console.log('Accepting order:', order.id, order.orderNumber);

    // Add order to loading set early to prevent multiple clicks
    this.setOrderLoading(order.id, true);

    try {
      // 1. First, capture the payment
      console.log('Retrieving payment for order:', order.id);
      const payment = await this.supabaseAuthService.getPaymentByOrderId(
        order.id
      );

      if (!payment) {
        throw new Error('Aucun paiement trouvé pour cette commande');
      }

      console.log('Found payment:', payment);

      // Only capture if payment provider is PayGreen and status is not already captured
      if (payment.provider === 'paygreen' && payment.status !== 'completed') {
        console.log('Capturing PayGreen payment:', payment.provider_payment_id);

        try {
          // Get current vendor for payment capture
          const currentVendor = this.vendorService.getCurrentVendor();
          if (!currentVendor) {
            throw new Error('No vendor context available for payment capture');
          }

          const captureResponse = await firstValueFrom(
            this.paymentService.capturePayment(
              currentVendor.id,
              payment.provider_payment_id,
              'paygreen'
            )
          );

          console.log('Payment capture response:', captureResponse);

          // Update payment status in database
          await this.supabaseAuthService.updatePaymentStatus(
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

  async refuseOrder(order: Order, refuseReason?: string) {
    // Prevent multiple simultaneous updates for the same order
    if (this.isOrderLoading(order.id)) {
      return;
    }

    // Add order to loading set
    this.setOrderLoading(order.id, true);

    try {
      if (refuseReason) {
        await this.ordersService.updateOrderWithRefuseReason(order.id, 'refused', refuseReason);
      } else {
        await this.updateOrderStatus(order, 'refused');
      }
      
      this.snackBar.open('Commande refusée', 'Fermer', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Error refusing order:', error);
      this.snackBar.open('Erreur lors du refus de la commande', 'Fermer', {
        duration: 5000,
      });
    } finally {
      // Remove order from loading set
      this.setOrderLoading(order.id, false);
    }
  }

  openOrderDetailsDialog(order: Order) {
    const dialogRef = this.dialog.open(OrderDetailsDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      data: {
        order,
        onAccept: () => this.acceptOrder(order),
        onRefuse: (refuseReason?: string) => this.refuseOrder(order, refuseReason),
        onUpdateStatus: (status: OrderStatus) =>
          this.updateOrderStatus(order, status),
      },
    });

    dialogRef.afterClosed().subscribe(() => {
      // Dialog closed - refresh might be needed if order was updated
    });
  }

  formatScheduledTime = (date: Date | undefined): string => {
    if (!date) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

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

  formatScheduledDate = (date: Date | undefined): string => {
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
  };

  // Utility method to refresh orders manually
  async refreshOrders() {
    this.isLoading.set(true);
    try {
      await this.ordersService.loadOrders();

      // Check for new orders and play sound if found
      await this.checkForNewOrders();

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

  // Sound notification toggle method
  toggleSoundNotifications() {
    const currentState = this.soundNotificationService.isSoundEnabled();
    this.soundNotificationService.setEnabled(!currentState);

    // Show feedback message
    const message = !currentState
      ? 'Notifications sonores activées'
      : 'Notifications sonores désactivées';
    this.snackBar.open(message, 'OK', { duration: 2000 });
  }

  // Debug method to track status changes
  debugOrderStatus(order: Order): string {
    const statusLabel = this.statusLabels[order.status];
    console.log(
      `Order ${order.id} (${order.orderNumber}) status: ${order.status} -> "${statusLabel}"`
    );
    return statusLabel;
  }

  // Order tracking methods for new order detection
  private initializeOrderTracking() {
    // Subscribe to orders changes to track initial state
    this.ordersService.orders$.subscribe((orders) => {
      if (this.previousOrderCount === 0) {
        // First load - initialize tracking
        this.previousOrderCount = orders.length;
        this.previousOrderIds = new Set(orders.map((order) => order.id));
        console.log(
          `Initialized order tracking with ${this.previousOrderCount} orders`
        );
      }
    });
  }

  private async checkForNewOrders() {
    try {
      const currentOrders = this.ordersService.getCurrentOrders();
      const currentOrderCount = currentOrders.filter(order => order.status !== 'initiated').length;
      const currentOrderIds = new Set(currentOrders.filter(order => order.status !== 'initiated').map((order) => order.id));

      // Check if there are new orders
      const newOrderCount = currentOrderCount - this.previousOrderCount;

      if (newOrderCount > 0) {
        // Find which orders are new
        const newOrderIds = new Set(
          [...currentOrderIds].filter((id) => !this.previousOrderIds.has(id))
        );

        if (newOrderIds.size > 0) {
          console.log(
            `🎵 New orders detected: ${newOrderIds.size} new order(s)`
          );

          // Play notification sound
          await this.soundNotificationService.playNewOrderSound();

          // Show notification in snackbar
          this.snackBar.open(
            `${newOrderIds.size} nouvelle${
              newOrderIds.size > 1 ? 's' : ''
            } commande${newOrderIds.size > 1 ? 's' : ''} reçue${
              newOrderIds.size > 1 ? 's' : ''
            } !`,
            'OK',
            {
              duration: 4000,
              panelClass: ['new-order-snackbar'],
            }
          );
        }
      }

      // Update tracking state
      this.previousOrderCount = currentOrderCount;
      this.previousOrderIds = currentOrderIds;
    } catch (error) {
      console.error('Error checking for new orders:', error);
    }
  }
}
