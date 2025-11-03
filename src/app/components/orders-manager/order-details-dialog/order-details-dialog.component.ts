import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogRef,
  MatDialogModule,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Order, OrderStatus } from '../../../models/order.model';

@Component({
  selector: 'app-order-details-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="order-details-dialog">
      <div class="dialog-header">
        <h2 mat-dialog-title>
          Commande #{{ data.order.orderNumber }}
        </h2>
        <button
          mat-icon-button
          (click)="closeDialog()"
          class="close-button"
          [disabled]="isProcessing()"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content>
        <!-- Two-column layout for status and customer -->
        <div class="top-sections-grid">
          <!-- Status and Type Info -->
          <div class="status-section">
            <mat-chip [color]="statusColors[data.order.status]" selected>
              {{ statusLabels[data.order.status] }}
            </mat-chip>
            @if (data.order.orderType !== 'eat-in') {
            <mat-chip
              [color]="
                data.order.orderType === 'take-away' ? 'primary' : 'accent'
              "
              class="order-type-chip"
            >
              <mat-icon matChipAvatar>{{
                data.order.orderType === 'take-away'
                  ? 'shopping_bag'
                  : 'local_shipping'
              }}</mat-icon>
              {{
                data.order.orderType === 'take-away'
                  ? 'À Emporter'
                  : 'Livraison'
              }}
            </mat-chip>
            }
            @if (data.order.timing === 'asap') {
            <mat-chip color="warn">
              <mat-icon matChipAvatar>schedule</mat-icon>
              IMMÉDIAT
            </mat-chip>
            }
            @if (
              data.order.timing === 'later' && data.order.scheduledTime
            ) {
            <div class="scheduled-time">
              <mat-icon>access_time</mat-icon>
              {{ formatScheduledDate(data.order.scheduledTime) }} à
              {{ formatScheduledTime(data.order.scheduledTime) }}
            </div>
            }
          </div>

          <!-- Customer Info -->
          <div class="customer-section">
            <div class="customer-info">
              <span class="customer-name">
                {{ data.order.customer.firstName }}
                {{ data.order.customer.lastName }}
              </span>
              <span class="contact-item">
                <mat-icon>email</mat-icon>
                {{ data.order.customer.email }}
              </span>
              @if (data.order.customer.phone) {
              <span class="contact-item">
                <mat-icon>phone</mat-icon>
                {{ data.order.customer.phone }}
              </span>
              }
            </div>
          </div>
        </div>

        @if (data.order.tableNumber) {
        <div class="table-section">
          <mat-icon>table_restaurant</mat-icon>
          <span>Table {{ data.order.tableNumber }}</span>
        </div>
        }

        <mat-divider></mat-divider>

        <!-- Order Items -->
        <div class="items-section">
          <h3 class="section-title">
            <mat-icon>restaurant</mat-icon>
            Articles ({{ data.order.items.length }})
          </h3>
          <div class="order-items">
            @for (item of data.order.items; track item.productId + $index) {
            <div class="order-item">
              <span class="item-quantity">{{ item.quantity }}x</span>
              <div class="item-details">
                <span class="item-name">{{ item.productName }}</span>
                @if (item.metadata) {
                <div class="multi-step-details">
                  @for (
                    step of item.metadata.stepSelections;
                    track step.stepName
                  ) {
                  <div class="step-detail">
                    <span class="step-name">{{ step.stepName }}:</span>
                    @for (
                      option of step.selectedOptions;
                      track option.optionName;
                      let last = $last
                    ) {
                    <span class="option-name">
                      {{ option.optionName }}@if (!last) {, }
                    </span>
                    }
                  </div>
                  }
                </div>
                }
                @if (item.comment) {
                <div class="item-comment">
                  <mat-icon>comment</mat-icon>
                  <span>{{ item.comment }}</span>
                </div>
                }
              </div>
              <span
                class="item-price"
                [style.visibility]="
                  item.price * item.quantity > 0 ? 'visible' : 'hidden'
                "
                >{{
                  item.price * item.quantity
                    | currency : 'EUR' : 'symbol' : '1.2-2' : 'fr'
                }}</span
              >
            </div>
            }
          </div>
        </div>

        <mat-divider></mat-divider>

        <!-- Order Total -->
        <div class="order-total">
          <strong>Total:</strong>
          <span>{{
            data.order.totalAmount
              | currency : 'EUR' : 'symbol' : '1.2-2' : 'fr'
          }}</span>
        </div>

        @if (data.order.notes) {
        <div class="order-notes">
          <mat-icon>note</mat-icon>
          <span>{{ data.order.notes }}</span>
        </div>
        }


      </mat-dialog-content>

      <mat-dialog-actions>
        <!-- Validation buttons for initiated/paid orders -->
        @if (canValidateOrder(data.order)) {
        <div class="validation-buttons">
        <button
            mat-fab
            extended
            (click)="refuseOrder()"
            [disabled]="isProcessing()"
            class="order-action-button refuse-button"
          >
            @if (isProcessing()) {
            <mat-spinner diameter="16"></mat-spinner>
            } @else {
            <mat-icon>cancel</mat-icon>
            }
            @if (!isProcessing()) {
            <span class="order-action-button-text">Refuser</span>
            }
          </button>
          <button
            mat-fab
            extended
            (click)="acceptOrder()"
            [disabled]="isProcessing()"
            class="order-action-button accept-button"
          >
            @if (isProcessing()) {
            <mat-spinner diameter="16"></mat-spinner>
            } @else {
            <mat-icon>check_circle</mat-icon>
            }
            @if (!isProcessing()) {
            <span class="order-action-button-text">Accepter la commande</span>
            }
          </button>

        </div>
        }

        <!-- Regular status update button for other statuses -->
        @if (canUpdateStatus(data.order)) {
        <button
          mat-fab
          extended
          [color]="buttonColors[data.order.status]"
          (click)="updateStatus()"
          [disabled]="isProcessing()"
          class="order-action-button"
        >
          @if (isProcessing()) {
          <mat-spinner diameter="16"></mat-spinner>
          } @else {
          <mat-icon>{{ buttonIcons[data.order.status] }}</mat-icon>
          }
          @if (!isProcessing()) {
          <span class="order-action-button-text">
            {{ getNextStatusLabel(data.order.status) }}
          </span>
          }
        </button>
        }

      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      ::ng-deep .mat-mdc-dialog-surface {
        display: flex !important;
        flex-direction: column !important;
        max-height: 90vh !important;
        overflow: hidden !important;
      }

      .order-details-dialog {
        max-width: 600px;
        width: 100%;
        display: flex;
        flex-direction: column;
        max-height: 90vh;
        overflow: hidden;
      }

      .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0px 16px;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        flex-shrink: 0;

        h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 500;
        }

        .close-button {
          margin-left: auto;
        }
      }

      mat-dialog-content {
        flex: 1;
        overflow-y: auto;
        padding: 10px 14px;
        min-height: 0;
      }

      .top-sections-grid {
        display: grid;
        grid-template-rows: 1fr 1fr;
        gap: 8px;
        margin-bottom: 8px;

        @media (max-width: 640px) {
          grid-template-columns: 1fr;
        }
      }

      .status-section {
        display: flex;
        flex-wrap: nowrap;
        gap: 6px;
        align-items: center;
        padding: 6px 8px;
        background-color: var(--mat-sys-surface-container);
        border-radius: 6px;
        overflow-x: auto;

        mat-chip {
          font-size: 11px;
          font-weight: 500;
          height: 24px;
          min-height: 24px;
          flex-shrink: 0;

          mat-icon {
            margin-right: 4px;
            font-size: 13px;
            width: 13px;
            height: 13px;
          }
        }

        .scheduled-time {
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--mat-sys-on-surface-variant);
          font-size: 11px;
          flex-shrink: 0;
          white-space: nowrap;

          mat-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
            color: var(--mat-sys-tertiary);
          }
        }
      }

      .section-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        font-weight: 500;
        margin: 0 0 6px 0;
        color: var(--mat-sys-on-surface);

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: var(--mat-sys-primary);
        }
      }

      .customer-section {
        padding: 6px 8px;
        background-color: var(--mat-sys-surface-container);
        border-radius: 6px;
        display: flex;
        align-items: center;
      }

      .customer-info {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: nowrap;
        width: 100%;
        overflow-x: auto;

        .customer-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--mat-sys-on-surface);
          flex-shrink: 0;
        }

        .contact-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--mat-sys-on-surface-variant);
          flex-shrink: 0;
          white-space: nowrap;

          mat-icon {
            font-size: 13px;
            width: 13px;
            height: 13px;
            color: var(--mat-sys-primary);
          }
        }
      }

      .table-section {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        background-color: var(--mat-sys-primary-container);
        border-radius: 6px;
        margin-bottom: 8px;
        color: var(--mat-sys-on-primary-container);
        font-weight: 500;
        font-size: 12px;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }

      .items-section {
        margin-bottom: 8px;
      }

      .order-items {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      .order-item {
        display: grid;
        grid-template-columns: 35px 1fr auto;
        gap: 6px;
        padding: 6px 8px;
        background-color: var(--mat-sys-surface-container);
        border-radius: 6px;

        .item-quantity {
          font-weight: 600;
          font-size: 12px;
          color: var(--mat-sys-primary);
          text-align: center;
          padding: 3px 6px;
          background-color: var(--mat-sys-primary-container);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          height: fit-content;
        }

        .item-details {
          display: flex;
          flex-direction: column;
          gap: 4px;

          .item-name {
            color: var(--mat-sys-on-surface);
            font-weight: 500;
            font-size: 13px;
            line-height: 1.3;
          }

          .multi-step-details {
            margin-top: 2px;
            padding: 6px;
            border-left: 2px solid var(--mat-sys-primary);
            background-color: var(--mat-sys-primary-container);
            border-radius: 4px;
          }

          .step-detail {
            margin-bottom: 2px;
            font-size: 16px;
            color: var(--mat-sys-on-surface-variant);
            line-height: 1.3;

            &:last-child {
              margin-bottom: 0;
            }

            .step-name {
              font-weight: 500;
              color: var(--mat-sys-primary);
            }

            .option-name {
              color: var(--mat-sys-on-primary-container);
            }
          }

          .item-comment {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            font-style: italic;
            color: var(--mat-sys-on-surface-variant);
            background-color: var(--mat-sys-secondary-container);
            padding: 3px 6px;
            border-radius: 4px;
            border-left: 2px solid var(--mat-sys-secondary);
            line-height: 1.3;

            mat-icon {
              font-size: 12px;
              width: 12px;
              height: 12px;
              color: var(--mat-sys-secondary);
            }
          }
        }

        .item-price {
          font-weight: 600;
          font-size: 12px;
          color: var(--mat-sys-on-surface);
          display: flex;
          align-items: center;
        }
      }

      mat-divider {
        margin: 6px 0;
      }

      .order-total {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 14px;
        padding: 8px;
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
        border-radius: 6px;
        margin-bottom: 6px;
        font-weight: 500;

        strong {
          font-weight: 500;
        }

        span {
          font-weight: 600;
          font-size: 16px;
        }
      }

      .order-notes {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        font-size: 11px;
        color: var(--mat-sys-on-surface-variant);
        font-style: italic;
        padding: 6px 8px;
        background-color: var(--mat-sys-secondary-container);
        border-radius: 6px;
        border-left: 2px solid var(--mat-sys-secondary);
        margin-bottom: 6px;
        line-height: 1.3;

        mat-icon {
          font-size: 13px;
          width: 13px;
          height: 13px;
          margin-top: 1px;
          color: var(--mat-sys-secondary);
        }
      }



      mat-dialog-actions {
        padding: 8px 14px;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        flex-wrap: wrap;
        border-top: 1px solid var(--mat-sys-outline-variant);
        flex-shrink: 0;
      }

      .validation-buttons {
        display: flex;
        gap: 10px;
        flex: 1;

        .order-action-button {
          min-width: 120px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 500;
          border-radius: 21px;

          mat-icon {
            margin: 0;
            font-size: 16px;
            width: 16px;
            height: 16px;
          }

          .order-action-button-text {
            display: flex;
            align-items: center;
            line-height: 1;
          }

          mat-spinner {
            margin: 0;
          }
        }

        .accept-button {
          flex: 2;
          --mat-fab-foreground-color: #ffffff;
          --mat-fab-state-layer-color: #ffffff;
          --mat-fab-ripple-color: rgba(255, 255, 255, 0.1);
          --mat-fab-hover-state-layer-opacity: 0.08;
          --mat-fab-focus-state-layer-opacity: 0.12;
          --mat-fab-pressed-state-layer-opacity: 0.12;
          --mat-fab-container-color: #4caf50;
          --mat-fab-hover-container-elevation: 4;
          --mat-fab-focus-container-elevation: 4;
          --mat-fab-pressed-container-elevation: 8;
          --mat-fab-disabled-container-color: rgba(0, 0, 0, 0.12);
          --mat-fab-disabled-foreground-color: rgba(0, 0, 0, 0.38);

          &:hover:not([disabled]) {
            --mat-fab-container-color: #45a049;
          }
        }

        .refuse-button {
          flex: 1;
          --mat-fab-foreground-color: #ffffff;
          --mat-fab-state-layer-color: #ffffff;
          --mat-fab-ripple-color: rgba(255, 255, 255, 0.1);
          --mat-fab-hover-state-layer-opacity: 0.08;
          --mat-fab-focus-state-layer-opacity: 0.12;
          --mat-fab-pressed-state-layer-opacity: 0.12;
          --mat-fab-container-color: #f44336;
          --mat-fab-hover-container-elevation: 4;
          --mat-fab-focus-container-elevation: 4;
          --mat-fab-pressed-container-elevation: 8;
          --mat-fab-disabled-container-color: rgba(0, 0, 0, 0.12);
          --mat-fab-disabled-foreground-color: rgba(0, 0, 0, 0.38);

          &:hover:not([disabled]) {
            --mat-fab-container-color: #d32f2f;
          }
        }
      }

      .order-action-button {
        width: 100%;
        height: 42px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 500;
        border-radius: 21px;
        min-width: 140px;

        mat-icon {
          margin: 0;
          font-size: 16px;
          width: 16px;
          height: 16px;
        }

        .order-action-button-text {
          display: flex;
          align-items: center;
          line-height: 1;
        }

        mat-spinner {
          margin: 0;
        }
      }
    `,
  ],
})
export class OrderDetailsDialogComponent {
  dialogRef = inject(MatDialogRef<OrderDetailsDialogComponent>);
  data = inject<{ order: Order; onAccept?: () => void; onRefuse?: () => void; onUpdateStatus?: (status: OrderStatus) => void }>(MAT_DIALOG_DATA);

  isProcessing = this.data.onAccept ? signal(false) : signal(false);

  statusLabels: Record<OrderStatus, string> = {
    initiated: 'En attente de validation',
    paid: 'Payée',
    refused: 'Refusée',
    todo: 'À traiter',
    ongoing: 'En cours',
    done: 'Prête',
    picked: 'Récupérée',
  };

  statusColors: Record<OrderStatus, string> = {
    initiated: 'warn',
    paid: 'accent',
    refused: '',
    todo: 'accent',
    ongoing: 'accent',
    done: 'primary',
    picked: '',
  };

  buttonColors: Record<OrderStatus, string> = {
    initiated: '',
    paid: 'accent',
    refused: '',
    todo: 'accent',
    ongoing: 'primary',
    done: '',
    picked: '',
  };

  buttonIcons: Record<OrderStatus, string> = {
    initiated: '',
    paid: 'play_arrow',
    refused: '',
    todo: 'play_arrow',
    ongoing: 'check_circle',
    done: 'done_all',
    picked: '',
  };

  canValidateOrder(order: Order): boolean {
    return order.status === 'initiated' || order.status === 'paid';
  }

  canUpdateStatus(order: Order): boolean {
    const nextStatus = this.getNextStatus(order.status);
    return nextStatus !== null && order.status !== 'paid';
  }

  getNextStatus(currentStatus: OrderStatus): OrderStatus | null {
    const statusFlow: Record<OrderStatus, OrderStatus | null> = {
      initiated: null,
      paid: 'todo',
      refused: null,
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

  formatScheduledTime(date: Date | undefined): string {
    if (!date) return '';
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

  async acceptOrder() {
    if (!this.data.onAccept) return;
    this.isProcessing.set(true);
    try {
      await this.data.onAccept();
      this.closeDialog();
    } catch (error) {
      console.error('Error accepting order:', error);
    } finally {
      this.isProcessing.set(false);
    }
  }

  async refuseOrder() {
    if (!this.data.onRefuse) return;
    this.isProcessing.set(true);
    try {
      await this.data.onRefuse();
      this.closeDialog();
    } catch (error) {
      console.error('Error refusing order:', error);
    } finally {
      this.isProcessing.set(false);
    }
  }

  async updateStatus() {
    const nextStatus = this.getNextStatus(this.data.order.status);
    if (!nextStatus || !this.data.onUpdateStatus) return;
    this.isProcessing.set(true);
    try {
      await this.data.onUpdateStatus(nextStatus);
      this.closeDialog();
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      this.isProcessing.set(false);
    }
  }

  closeDialog() {
    this.dialogRef.close();
  }
}
