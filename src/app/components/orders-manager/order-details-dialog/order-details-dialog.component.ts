import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogRef,
  MatDialogModule,
  MAT_DIALOG_DATA,
  MatDialog,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Order, OrderStatus } from '../../../models/order.model';
import { RefuseReasonDialogComponent } from '../refuse-reason-dialog/refuse-reason-dialog.component';
import { SupabaseAuthService } from '../../../services/supabase-auth.service';
import { MapLocationViewerComponent } from '../../../shared/components/map-location-viewer/map-location-viewer.component';
import { VendorCurrencyPipe } from '../../../shared/pipes/vendor-currency.pipe';

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
    MapLocationViewerComponent,
    VendorCurrencyPipe,
  ],
  template: `
    <div class="order-details-dialog">
      <div class="dialog-header">
        <h2 mat-dialog-title>
          Commande #{{ data.order.orderNumber }}
        </h2>
        <div class="header-total">
          <span class="total-amount">{{
            data.order.totalAmount
              | vendorCurrency
          }}</span>
        </div>
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
        <div class="content-grid">
          <!-- Left Section: Order Items + Notes (3/4 width) -->
          <div class="left-section">
            @if (data.order.tableNumber) {
            <div class="table-section">
              <mat-icon>table_restaurant</mat-icon>
              <span>Table {{ data.order.tableNumber }}</span>
            </div>
            }

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
                    @if (item.customisationSelections && item.customisationSelections.length > 0) {
                    <div class="customisation-details">
                      @for (
                        customisation of item.customisationSelections;
                        track customisation.customisationId
                      ) {
                      <div class="customisation-detail">
                        <span class="customisation-name">{{ customisation.customisationName }}:</span>
                        @for (
                          option of customisation.selectedOptions;
                          track option.optionId;
                          let last = $last
                        ) {
                        <span class="option-name">
                          {{ option.optionName }}@if (option.priceAdjustment > 0) {
                            <span class="price-supplement"> (+{{ option.priceAdjustment | vendorCurrency }})</span>
                          }@if (!last) {, }
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
                        | vendorCurrency
                    }}</span
                  >
                </div>
                }
              </div>
            </div>

            @if (data.order.notes) {
            <div class="order-notes">
              <mat-icon>note</mat-icon>
              <span>{{ data.order.notes }}</span>
            </div>
            }
          </div>

          <!-- Right Section: Status + Customer (1/4 width) -->
          <div class="right-section">
            <!-- Status and Type Info -->
            <div class="status-section">
              <h4 class="section-title-small">Statut</h4>
              <mat-chip [color]="statusColors[data.order.status]" selected>
                {{ statusLabels[data.order.status] }}
              </mat-chip>
              @if (data.order.payAtCheckout) {
              <mat-chip color="warn" selected>
                <mat-icon matChipAvatar>payments</mat-icon>
                À payer au retrait
              </mat-chip>
              }
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

            @if (data.order.orderType === 'delivery') {
              <mat-divider class="section-divider"></mat-divider>

              <div class="customer-section">
                <h4 class="section-title-small">Livraison</h4>

                @if (isLoadingDelivery()) {
                  <div class="delivery-loading">
                    <mat-spinner diameter="28"></mat-spinner>
                  </div>
                } @else if (deliveryInfo()) {
                  <div class="customer-info">
                    <span class="contact-item">
                      <mat-icon>location_on</mat-icon>
                      {{ deliveryInfo()?.dropoff_line1 }}
                    </span>
                    <span class="contact-item">
                      <mat-icon>place</mat-icon>
                      {{ deliveryInfo()?.dropoff_postal_code }}
                      {{ deliveryInfo()?.dropoff_city }}
                    </span>
                  </div>

                  @if (deliveryCoords()) {
                    <div class="delivery-map">
                      <app-map-location-viewer
                        [coordinates]="deliveryCoords()!"
                      ></app-map-location-viewer>
                    </div>
                  }
                } @else {
                  <div class="customer-info">
                    <span class="contact-item">
                      <mat-icon>info</mat-icon>
                      Aucune position enregistrée.
                    </span>
                  </div>
                }
              </div>
            }

            <mat-divider class="section-divider"></mat-divider>

            <!-- Customer Info -->
            <div class="customer-section">
              <h4 class="section-title-small">Client</h4>
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
        </div>
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
          (click)="updateStatus()"
          [disabled]="isProcessing()"
          [class]="'order-action-button status-button-' + data.order.status"
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
        max-width: 800px;
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
        gap: 16px;

        h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 500;
        }

        .header-total {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
          padding: 4px 12px;
          background: var(--mat-sys-primary-container);
          color: var(--mat-sys-on-primary-container);
          border-radius: 20px;
          font-weight: 500;

          .total-label {
            font-size: 13px;
            font-weight: 500;
          }

          .total-amount {
            font-size: 16px;
            font-weight: 600;
          }
        }

        .close-button {
          margin-left: 0;
        }
      }

      mat-dialog-content {
        flex: 1;
        overflow-y: auto;
        padding: 10px 14px;
        min-height: 0;
      }

      .content-grid {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 16px;
        align-items: start;

        @media (max-width: 768px) {
          grid-template-columns: 1fr;
          gap: 12px;
        }
      }

      .left-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
      }

      .right-section {
        display: flex;
        flex-direction: column;
        gap: 12px;
        position: sticky;
        top: 0;
        align-self: start;

        @media (max-width: 768px) {
          position: static;
        }
      }

      .section-title-small {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 600;
        margin: 0 0 8px 0;
        color: var(--mat-sys-on-surface);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .section-divider {
        margin: 8px 0;
      }

      .status-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px 12px;
        background-color: var(--mat-sys-surface-container);
        border-radius: 8px;

        mat-chip {
          font-size: 11px;
          font-weight: 500;
          height: 24px;
          min-height: 24px;
          width: 100%;
          justify-content: center;

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
          white-space: nowrap;
          padding: 4px 8px;
          background-color: var(--mat-sys-secondary-container);
          border-radius: 4px;

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
        display: flex;
        flex-direction: column;
        padding: 10px 12px;
        background-color: var(--mat-sys-surface-container);
        border-radius: 8px;
      }

      .customer-info {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;

        .customer-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--mat-sys-on-surface);
          margin-bottom: 4px;
        }

        .contact-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--mat-sys-on-surface-variant);
          word-break: break-word;

          mat-icon {
            font-size: 13px;
            width: 13px;
            height: 13px;
            color: var(--mat-sys-primary);
            flex-shrink: 0;
          }
        }
      }

      .delivery-loading {
        display: flex;
        justify-content: center;
        padding: 12px 0;
      }

      .delivery-map {
        margin-top: 10px;
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

          .customisation-details {
            margin-top: 2px;
            padding: 6px;
            border-left: 2px solid var(--mat-sys-tertiary);
            background-color: var(--mat-sys-tertiary-container);
            border-radius: 4px;
          }

          .customisation-detail {
            margin-bottom: 2px;
            font-size: 16px;
            color: var(--mat-sys-on-surface-variant);
            line-height: 1.3;

            &:last-child {
              margin-bottom: 0;
            }

            .customisation-name {
              font-weight: 500;
              color: var(--mat-sys-tertiary);
            }

            .option-name {
              color: var(--mat-sys-on-tertiary-container);
              
              .price-supplement {
                font-weight: 600;
                color: var(--mat-sys-tertiary);
                margin-left: 2px;
              }
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

        // Status-specific button colors
        &.status-button-paid,
        &.status-button-todo {
          --mat-fab-foreground-color: #ffffff;
          --mat-fab-state-layer-color: #ffffff;
          --mat-fab-ripple-color: rgba(255, 255, 255, 0.1);
          --mat-fab-hover-state-layer-opacity: 0.08;
          --mat-fab-focus-state-layer-opacity: 0.12;
          --mat-fab-pressed-state-layer-opacity: 0.12;
          --mat-fab-container-color: #00acc1; // Cyan/Teal for "À traiter" and "En cours"
          --mat-fab-hover-container-elevation: 4;
          --mat-fab-focus-container-elevation: 4;
          --mat-fab-pressed-container-elevation: 8;
          --mat-fab-disabled-container-color: rgba(0, 0, 0, 0.12);
          --mat-fab-disabled-foreground-color: rgba(0, 0, 0, 0.38);

          &:hover:not([disabled]) {
            --mat-fab-container-color: #0097a7; // Darker cyan on hover
          }
        }

        &.status-button-ongoing {
          --mat-fab-foreground-color: #ffffff;
          --mat-fab-state-layer-color: #ffffff;
          --mat-fab-ripple-color: rgba(255, 255, 255, 0.1);
          --mat-fab-hover-state-layer-opacity: 0.08;
          --mat-fab-focus-state-layer-opacity: 0.12;
          --mat-fab-pressed-state-layer-opacity: 0.12;
          --mat-fab-container-color: #4caf50; // Green for "Prête" button
          --mat-fab-hover-container-elevation: 4;
          --mat-fab-focus-container-elevation: 4;
          --mat-fab-pressed-container-elevation: 8;
          --mat-fab-disabled-container-color: rgba(0, 0, 0, 0.12);
          --mat-fab-disabled-foreground-color: rgba(0, 0, 0, 0.38);

          &:hover:not([disabled]) {
            --mat-fab-container-color: #45a049; // Darker green on hover
          }
        }

        &.status-button-done {
          --mat-fab-foreground-color: #ffffff;
          --mat-fab-state-layer-color: #ffffff;
          --mat-fab-ripple-color: rgba(255, 255, 255, 0.1);
          --mat-fab-hover-state-layer-opacity: 0.08;
          --mat-fab-focus-state-layer-opacity: 0.12;
          --mat-fab-pressed-state-layer-opacity: 0.12;
          --mat-fab-container-color: #66bb6a; // Lighter green for "Récupérée" button
          --mat-fab-hover-container-elevation: 4;
          --mat-fab-focus-container-elevation: 4;
          --mat-fab-pressed-container-elevation: 8;
          --mat-fab-disabled-container-color: rgba(0, 0, 0, 0.12);
          --mat-fab-disabled-foreground-color: rgba(0, 0, 0, 0.38);

          &:hover:not([disabled]) {
            --mat-fab-container-color: #81c784; // Even lighter green on hover
          }
        }
      }
    `,
  ],
})
export class OrderDetailsDialogComponent {
  dialogRef = inject(MatDialogRef<OrderDetailsDialogComponent>);
  dialog = inject(MatDialog);
  data = inject<{ order: Order; onAccept?: () => void; onRefuse?: (reason?: string) => void; onUpdateStatus?: (status: OrderStatus) => void }>(MAT_DIALOG_DATA);
  private supabaseAuth = inject(SupabaseAuthService);

  isProcessing = this.data.onAccept ? signal(false) : signal(false);

  readonly isLoadingDelivery = signal<boolean>(false);
  readonly deliveryInfo = signal<any | null>(null);
  readonly deliveryCoords = signal<{ lat: number; lng: number } | null>(null);

  constructor() {
    this.loadDeliveryInfoIfNeeded();
  }

  private async loadDeliveryInfoIfNeeded(): Promise<void> {
    if (this.data.order.orderType !== 'delivery') return;
    this.isLoadingDelivery.set(true);
    try {
      const delivery = await this.supabaseAuth.getOrderDeliveryByOrderId(
        this.data.order.id
      );
      this.deliveryInfo.set(delivery);
      const lat = Number((delivery as any)?.dropoff_lat);
      const lng = Number((delivery as any)?.dropoff_lng);
      if (isFinite(lat) && isFinite(lng)) {
        this.deliveryCoords.set({ lat, lng });
      } else {
        this.deliveryCoords.set(null);
      }
    } catch (e) {
      console.error('Failed to load order delivery info:', e);
      this.deliveryInfo.set(null);
      this.deliveryCoords.set(null);
    } finally {
      this.isLoadingDelivery.set(false);
    }
  }

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
    
    // Close current dialog
    this.dialogRef.close({ action: 'refuse-requested' });
    
    // Open refuse reason dialog
    const refuseReasonDialogRef = this.dialog.open(RefuseReasonDialogComponent, {
      data: { order: this.data.order },
      disableClose: false,
      width: '600px',
      maxWidth: '90vw',
    });

    const result = await refuseReasonDialogRef.afterClosed().toPromise();
    
    if (result?.confirmed) {
      // User confirmed the refusal with a reason
      this.isProcessing.set(true);
      try {
        await this.data.onRefuse(result.reason);
      } catch (error) {
        console.error('Error refusing order:', error);
      } finally {
        this.isProcessing.set(false);
      }
    } else {
      // User cancelled, reopen the order details dialog
      this.dialog.open(OrderDetailsDialogComponent, {
        data: this.data,
        disableClose: false,
        width: '800px',
        maxWidth: '95vw',
      });
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
