import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { take, filter } from 'rxjs/operators';
import { CouponAdminService } from '../../../../services/coupon-admin.service';
import { VendorService } from '../../../../services/vendor.service';
import { CouponRow } from '../../../../models/coupon.model';
import { CouponListComponent } from './coupon-list.component';
import {
  CouponFormDialogComponent,
  CouponFormResult,
} from './coupon-form-dialog.component';

@Component({
  selector: 'app-coupons-admin-page',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    CouponListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card class="info-section">
      <mat-card-header>
        <mat-icon mat-card-avatar>local_offer</mat-icon>
        <mat-card-title>Codes promo</mat-card-title>
        <mat-card-subtitle>
          Créez des codes pour offrir des réductions à vos clients.
        </mat-card-subtitle>
      </mat-card-header>

      <mat-card-content class="content">
        <div class="toolbar">
          <span class="count">
            {{ activeCount() }} actif{{ activeCount() > 1 ? 's' : '' }}
            sur {{ coupons().length }}
          </span>
          <button
            mat-flat-button
            color="primary"
            type="button"
            class="new-btn"
            (click)="openCreateDialog()"
          >
            <mat-icon>add</mat-icon>
            Nouveau code
          </button>
        </div>

        @if (loading()) {
          <div class="loading">
            <mat-spinner diameter="32" />
            <span>Chargement...</span>
          </div>
        } @else {
          <app-coupon-list
            [coupons]="coupons()"
            (edit)="openEditDialog($event)"
            (delete)="confirmDelete($event)"
            (toggleActive)="onToggleActive($event)"
          />
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [
    `
      @use '../../../restaurant-info-admin/children/shared-styles' as shared;
      @include shared.child-section;

      .content {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .count {
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);
      }

      .new-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .loading {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 24px;
        background: var(--mat-sys-surface-container-high);
        border-radius: var(--mat-sys-corner-medium);
        font: var(--mat-sys-body-medium);
        color: var(--mat-sys-on-surface-variant);
      }

      @media (max-width: 600px) {
        .toolbar {
          flex-direction: column;
          align-items: stretch;
        }
        .new-btn {
          justify-content: center;
        }
      }
    `,
  ],
})
export class CouponsAdminPageComponent {
  private readonly couponSvc = inject(CouponAdminService);
  private readonly vendor = inject(VendorService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  protected readonly coupons = signal<CouponRow[]>([]);
  protected readonly loading = signal(true);

  protected readonly activeCount = computed(
    () => this.coupons().filter((c) => c.is_active).length
  );

  constructor() {
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    const vendorId = await this.resolveVendorId();
    if (!vendorId) {
      this.loading.set(false);
      this.snack.open(
        'Aucun restaurant sélectionné. Reconnectez-vous pour continuer.',
        'Fermer',
        { duration: 5000, panelClass: ['error-snackbar'] }
      );
      return;
    }
    await this.refresh(vendorId);
  }

  private async resolveVendorId(): Promise<string | null> {
    const current = this.vendor.getCurrentVendor();
    if (current?.id) return current.id;

    try {
      const v = await firstValueFrom(
        this.vendor.currentVendor$.pipe(
          filter((vv): vv is NonNullable<typeof vv> => !!vv?.id),
          take(1)
        )
      );
      return v?.id ?? null;
    } catch {
      return null;
    }
  }

  private async refresh(vendorId?: string): Promise<void> {
    const id = vendorId ?? this.vendor.getCurrentVendor()?.id;
    if (!id) return;
    this.loading.set(true);
    try {
      const list = await this.couponSvc.list(id);
      this.coupons.set(list);
    } catch (err) {
      this.snack.open((err as Error).message, 'Fermer', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    } finally {
      this.loading.set(false);
    }
  }

  protected openCreateDialog(): void {
    const vendorId = this.vendor.getCurrentVendor()?.id;
    if (!vendorId) return;

    const ref = this.dialog.open<
      CouponFormDialogComponent,
      { vendorId: string },
      CouponFormResult
    >(CouponFormDialogComponent, {
      data: { vendorId },
      width: '560px',
      maxWidth: '94vw',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });

    ref.afterClosed().subscribe((result) => this.handleDialogResult(result));
  }

  protected openEditDialog(coupon: CouponRow): void {
    const vendorId = this.vendor.getCurrentVendor()?.id;
    if (!vendorId) return;

    const ref = this.dialog.open<
      CouponFormDialogComponent,
      { vendorId: string; coupon: CouponRow },
      CouponFormResult
    >(CouponFormDialogComponent, {
      data: { vendorId, coupon },
      width: '560px',
      maxWidth: '94vw',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });

    ref.afterClosed().subscribe((result) => this.handleDialogResult(result));
  }

  private async handleDialogResult(
    result: CouponFormResult | undefined
  ): Promise<void> {
    if (!result) return;

    try {
      if (result.mode === 'create') {
        await this.couponSvc.create(result.payload);
        this.snack.open('Code promo créé.', 'Fermer', { duration: 3000 });
      } else {
        await this.couponSvc.update(result.id, result.payload);
        this.snack.open('Code promo mis à jour.', 'Fermer', { duration: 3000 });
      }
      await this.refresh();
    } catch (err) {
      this.snack.open((err as Error).message, 'Fermer', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    }
  }

  protected async onToggleActive(event: {
    id: string;
    isActive: boolean;
  }): Promise<void> {
    const previous = this.coupons();
    this.coupons.update((list) =>
      list.map((c) =>
        c.id === event.id ? { ...c, is_active: event.isActive } : c
      )
    );
    try {
      await this.couponSvc.setActive(event.id, event.isActive);
    } catch (err) {
      this.coupons.set(previous);
      this.snack.open((err as Error).message, 'Fermer', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    }
  }

  protected async confirmDelete(coupon: CouponRow): Promise<void> {
    const ok = window.confirm(
      `Supprimer définitivement le code "${coupon.code}" ?`
    );
    if (!ok) return;

    try {
      await this.couponSvc.remove(coupon.id);
      this.coupons.update((list) => list.filter((c) => c.id !== coupon.id));
      this.snack.open('Code promo supprimé.', 'Fermer', { duration: 3000 });
    } catch (err) {
      this.snack.open((err as Error).message, 'Fermer', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    }
  }
}
