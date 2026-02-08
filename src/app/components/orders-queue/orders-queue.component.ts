import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { interval, Subscription } from 'rxjs';
import { SupabaseService } from '../../services/supabase.service';
import { VendorService } from '../../services/vendor.service';

interface QueueOrder {
  order_number: string;
  status: string;
  order_type: string;
  created_at: string;
}

@Component({
  selector: 'app-orders-queue',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="queue-container">
      <h1 class="queue-title">Suivi des commandes</h1>

      <div *ngIf="isLoading && !orders.length" class="loading-container">
        <mat-spinner diameter="48"></mat-spinner>
        <p>Chargement des commandes...</p>
      </div>

      <div *ngIf="!isLoading && !orders.length" class="empty-state">
        <mat-icon class="empty-icon">receipt_long</mat-icon>
        <p>Aucune commande en cours</p>
      </div>

      <div *ngIf="orders.length" class="kanban-board">
        <!-- Confirmed column (paid + todo) -->
        <div class="kanban-column">
          <div class="column-header column-confirmed">
            <mat-icon>check_circle</mat-icon>
            <span>Confirmée</span>
            <span class="column-count">{{ confirmedOrders.length }}</span>
          </div>
          <div class="column-body">
            <div
              *ngFor="let order of confirmedOrders"
              class="order-card"
            >
              <span class="order-number">{{ order.order_number }}</span>
              <div class="order-meta">
                <mat-icon class="type-icon">{{ getOrderTypeIcon(order.order_type) }}</mat-icon>
                <span class="status-badge status-confirmed">Confirmée</span>
              </div>
            </div>
          </div>
        </div>

        <!-- In Preparation column (ongoing) -->
        <div class="kanban-column">
          <div class="column-header column-ongoing">
            <mat-icon>local_fire_department</mat-icon>
            <span>En préparation</span>
            <span class="column-count">{{ ongoingOrders.length }}</span>
          </div>
          <div class="column-body">
            <div
              *ngFor="let order of ongoingOrders"
              class="order-card"
            >
              <span class="order-number">{{ order.order_number }}</span>
              <div class="order-meta">
                <mat-icon class="type-icon">{{ getOrderTypeIcon(order.order_type) }}</mat-icon>
                <span class="status-badge status-ongoing">En préparation</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Ready column (done) -->
        <div class="kanban-column">
          <div class="column-header column-done">
            <mat-icon>task_alt</mat-icon>
            <span>Prête</span>
            <span class="column-count">{{ readyOrders.length }}</span>
          </div>
          <div class="column-body">
            <div
              *ngFor="let order of readyOrders"
              class="order-card"
            >
              <span class="order-number">{{ order.order_number }}</span>
              <div class="order-meta">
                <mat-icon class="type-icon">{{ getOrderTypeIcon(order.order_type) }}</mat-icon>
                <span class="status-badge status-done">Prête</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .queue-container {
        min-height: 100vh;
        padding: 24px;
        background: var(--mat-sys-surface);
        color: var(--mat-sys-on-surface);
      }

      .queue-title {
        text-align: center;
        font: var(--mat-sys-headline-medium);
        color: var(--mat-sys-on-surface);
        margin: 0 0 24px 0;
      }

      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        padding: 60px 20px;
        color: var(--mat-sys-on-surface-variant);
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 60px 20px;
        color: var(--mat-sys-on-surface-variant);
      }

      .empty-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: var(--mat-sys-outline-variant);
      }

      .kanban-board {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
      }

      .kanban-column {
        background: var(--mat-sys-surface-container);
        border-radius: var(--mat-sys-corner-large);
        overflow: hidden;
        box-shadow: var(--mat-sys-level1);
      }

      .column-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 14px 16px;
        font: var(--mat-sys-title-medium);
      }

      .column-count {
        margin-left: auto;
        background: color-mix(in srgb, currentColor 20%, transparent);
        padding: 2px 10px;
        border-radius: var(--mat-sys-corner-full);
        font: var(--mat-sys-label-medium);
      }

      .column-confirmed {
        background: var(--mat-sys-primary);
        color: var(--mat-sys-on-primary);
      }

      .column-ongoing {
        background: var(--mat-sys-secondary);
        color: var(--mat-sys-on-secondary);
      }

      .column-done {
        background: var(--mat-sys-tertiary);
        color: var(--mat-sys-on-tertiary);
      }

      .column-body {
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 120px;
      }

      .order-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        background: var(--mat-sys-surface-container-low);
        border-radius: var(--mat-sys-corner-medium);
        border: 1px solid var(--mat-sys-outline-variant);
      }

      .order-number {
        font: var(--mat-sys-title-large);
        color: var(--mat-sys-on-surface);
      }

      .order-meta {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .type-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: var(--mat-sys-on-surface-variant);
      }

      .status-badge {
        padding: 3px 10px;
        border-radius: var(--mat-sys-corner-full);
        font: var(--mat-sys-label-small);
        text-transform: uppercase;
      }

      .status-confirmed {
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
      }

      .status-ongoing {
        background: var(--mat-sys-secondary-container);
        color: var(--mat-sys-on-secondary-container);
      }

      .status-done {
        background: var(--mat-sys-tertiary-container);
        color: var(--mat-sys-on-tertiary-container);
      }

      @media (max-width: 768px) {
        .queue-container {
          padding: 16px;
        }

        .queue-title {
          font: var(--mat-sys-headline-small);
          margin-bottom: 16px;
        }

        .kanban-board {
          grid-template-columns: 1fr;
        }

        .order-number {
          font: var(--mat-sys-title-medium);
        }
      }
    `,
  ],
})
export class OrdersQueueComponent implements OnInit, OnDestroy {
  private supabaseService = inject(SupabaseService);
  private vendorService = inject(VendorService);

  orders: QueueOrder[] = [];
  isLoading = true;

  private autoRefreshSubscription?: Subscription;

  get confirmedOrders(): QueueOrder[] {
    return this.orders.filter(
      (o) => o.status === 'paid' || o.status === 'todo'
    );
  }

  get ongoingOrders(): QueueOrder[] {
    return this.orders.filter((o) => o.status === 'ongoing');
  }

  get readyOrders(): QueueOrder[] {
    return this.orders.filter((o) => o.status === 'done');
  }

  ngOnInit() {
    this.loadOrders();
    this.autoRefreshSubscription = interval(10000).subscribe(() => {
      this.loadOrders();
    });
  }

  ngOnDestroy() {
    if (this.autoRefreshSubscription) {
      this.autoRefreshSubscription.unsubscribe();
    }
  }

  getOrderTypeIcon(orderType: string): string {
    const iconMap: Record<string, string> = {
      'eat-in': 'restaurant',
      'take-away': 'takeout_dining',
      delivery: 'delivery_dining',
    };
    return iconMap[orderType] || 'receipt';
  }

  private async loadOrders() {
    const vendor = this.vendorService.getCurrentVendor();
    if (!vendor) return;

    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('orders')
        .select('order_number, status, order_type, created_at')
        .eq('vendor_id', vendor.id)
        .in('status', ['paid', 'todo', 'ongoing', 'done'])
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading orders queue:', error);
        return;
      }

      this.orders = (data as QueueOrder[]) || [];
    } catch (error) {
      console.error('Error loading orders queue:', error);
    } finally {
      this.isLoading = false;
    }
  }
}
