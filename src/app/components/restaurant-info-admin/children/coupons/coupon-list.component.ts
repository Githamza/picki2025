import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CouponDisplayStatus, CouponRow } from '../../../../models/coupon.model';
import { VendorCurrencyPipe } from '../../../../shared/pipes/vendor-currency.pipe';
import { CouponStatusPipe } from './coupon-status.pipe';

interface StatusMeta {
  label: string;
  className: string;
}

const STATUS_META: Record<CouponDisplayStatus, StatusMeta> = {
  active: { label: 'Actif', className: 'status-active' },
  scheduled: { label: 'Programmé', className: 'status-scheduled' },
  expired: { label: 'Expiré', className: 'status-expired' },
  exhausted: { label: 'Épuisé', className: 'status-exhausted' },
  inactive: { label: 'Désactivé', className: 'status-inactive' },
};

/**
 * Presentational coupon list. Receives coupons via an input and emits intent
 * (edit / toggle / delete) without touching services or the store.
 */
@Component({
  selector: 'app-coupon-list',
  imports: [
    DatePipe,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatSlideToggleModule,
    MatTooltipModule,
    VendorCurrencyPipe,
    CouponStatusPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (coupons().length === 0) {
      <div class="empty">
        <mat-icon class="empty-icon" aria-hidden="true">local_offer</mat-icon>
        <p class="empty-title">Aucun code promo pour l'instant.</p>
        <p class="empty-subtitle">
          Créez votre premier code pour offrir une réduction à vos clients.
        </p>
      </div>
    } @else {
      <ul class="list" role="list">
        @for (coupon of coupons(); track coupon.id) {
          <li class="list-item">
            <div class="list-row">
              <div class="head">
                <span class="code">{{ coupon.code }}</span>
                <span
                  class="status-chip"
                  [class]="statusMeta(coupon | couponStatus).className"
                >
                  {{ statusMeta(coupon | couponStatus).label }}
                </span>
              </div>
              <div class="actions">
                <mat-slide-toggle
                  hideIcon
                  color="primary"
                  [checked]="coupon.is_active"
                  matTooltip="Activer / désactiver"
                  (change)="toggleActive.emit({ id: coupon.id, isActive: $event.checked })"
                  [aria-label]="'Activer le coupon ' + coupon.code"
                />
                <button
                  mat-icon-button
                  type="button"
                  [matMenuTriggerFor]="actionsMenu"
                  [attr.aria-label]="'Plus d\\'actions pour ' + coupon.code"
                >
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #actionsMenu="matMenu">
                  <button mat-menu-item type="button" (click)="edit.emit(coupon)">
                    <mat-icon>edit</mat-icon>
                    <span>Modifier</span>
                  </button>
                  <button
                    mat-menu-item
                    type="button"
                    class="danger-action"
                    (click)="delete.emit(coupon)"
                  >
                    <mat-icon>delete</mat-icon>
                    <span>Supprimer</span>
                  </button>
                </mat-menu>
              </div>
            </div>

            <dl class="meta">
              <div class="meta-row">
                <dt>Réduction</dt>
                <dd>
                  @if (coupon.discount_type === 'percentage') {
                    {{ coupon.discount_percent }}%
                  } @else {
                    {{ coupon.discount_value ?? 0 | vendorCurrency }}
                  }
                </dd>
              </div>
              <div class="meta-row">
                <dt>Validité</dt>
                <dd>
                  {{ coupon.valid_from | date: 'shortDate' }}
                  →
                  {{ coupon.valid_until | date: 'shortDate' }}
                </dd>
              </div>
              <div class="meta-row">
                <dt>Utilisations</dt>
                <dd>
                  {{ coupon.current_uses
                  }}@if (coupon.max_uses !== null) {
                    / {{ coupon.max_uses }}
                  } @else {
                    <span class="muted"> / illimité</span>
                  }
                </dd>
              </div>
              @if (coupon.min_subtotal !== null) {
                <div class="meta-row">
                  <dt>Min. panier</dt>
                  <dd>{{ coupon.min_subtotal | vendorCurrency }}</dd>
                </div>
              }
            </dl>
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 32px 16px;
        background: var(--mat-sys-surface-container);
        border-radius: var(--mat-sys-corner-large);
        text-align: center;
        color: var(--mat-sys-on-surface-variant);
      }

      .empty-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        color: var(--mat-sys-primary);
      }

      .empty-title {
        margin: 0;
        font: var(--mat-sys-title-small);
        color: var(--mat-sys-on-surface);
      }

      .empty-subtitle {
        margin: 0;
        font: var(--mat-sys-body-small);
      }

      .list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .list-item {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        background: var(--mat-sys-surface-container);
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: var(--mat-sys-corner-large);
      }

      .list-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .head {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1 1 auto;
        min-width: 0;
        flex-wrap: wrap;
      }

      .code {
        font: var(--mat-sys-title-small);
        font-weight: 600;
        letter-spacing: 0.04em;
        color: var(--mat-sys-on-surface);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .status-chip {
        font: var(--mat-sys-label-small);
        padding: 4px 10px;
        border-radius: var(--mat-sys-corner-full);
        white-space: nowrap;
      }

      .status-active {
        background: var(--mat-sys-tertiary-container);
        color: var(--mat-sys-on-tertiary-container);
      }

      .status-scheduled {
        background: var(--mat-sys-secondary-container);
        color: var(--mat-sys-on-secondary-container);
      }

      .status-expired,
      .status-exhausted {
        background: var(--mat-sys-error-container);
        color: var(--mat-sys-on-error-container);
      }

      .status-inactive {
        background: var(--mat-sys-surface-container-high);
        color: var(--mat-sys-on-surface-variant);
      }

      .actions {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }

      .danger-action {
        color: var(--mat-sys-error);
      }

      .meta {
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .meta-row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        align-items: baseline;
        font: var(--mat-sys-body-medium);
      }

      .meta-row dt {
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-body-small);
      }

      .meta-row dd {
        margin: 0;
        text-align: right;
        color: var(--mat-sys-on-surface);
        font-weight: 500;
      }

      .muted {
        color: var(--mat-sys-on-surface-variant);
        font-weight: 400;
      }

      @media (max-width: 600px) {
        .list-item {
          padding: 14px;
        }
        .meta-row {
          font: var(--mat-sys-body-small);
        }
      }
    `,
  ],
})
export class CouponListComponent {
  readonly coupons = input.required<CouponRow[]>();

  readonly edit = output<CouponRow>();
  readonly delete = output<CouponRow>();
  readonly toggleActive = output<{ id: string; isActive: boolean }>();

  protected statusMeta(status: CouponDisplayStatus): StatusMeta {
    return STATUS_META[status];
  }

  // Allow templates to access STATUS_META indirectly without leaking the const.
  protected readonly count = computed(() => this.coupons().length);
}
