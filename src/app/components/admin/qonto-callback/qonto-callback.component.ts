import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';

import { QontoAdminService } from '../../../services/qonto-admin.service';
import { VendorService } from '../../../services/vendor.service';

/**
 * OAuth landing page for the Qonto connection (SPEC-QONTO-TERMINAL.md T9).
 * Qonto redirects here with ?code&state; the code is exchanged server-side
 * (qonto-oauth edge function) and the admin returns to the Paiement page.
 */
@Component({
  selector: 'app-qonto-callback',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="qonto-callback">
      <ng-container [ngSwitch]="state()">
        <ng-container *ngSwitchCase="'pending'">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Connexion de votre compte Qonto…</p>
        </ng-container>

        <ng-container *ngSwitchCase="'error'">
          <mat-icon class="error-icon">error_outline</mat-icon>
          <p>La connexion à Qonto a échoué. Vous pouvez réessayer.</p>
          <div class="callback-actions">
            <button mat-flat-button color="primary" type="button" (click)="onRetry()">
              Réessayer
            </button>
            <button mat-stroked-button type="button" (click)="backToPaiement()">
              Retour aux paiements
            </button>
          </div>
        </ng-container>
      </ng-container>
    </div>
  `,
  styles: [
    `
      .qonto-callback {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        padding: 48px 24px;
        text-align: center;
      }

      .error-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--mat-sys-error);
      }

      .callback-actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        justify-content: center;
      }
    `,
  ],
})
export class QontoCallbackComponent implements OnInit {
  private readonly qontoService = inject(QontoAdminService);
  private readonly vendorService = inject(VendorService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly state = signal<'pending' | 'error'>('pending');

  ngOnInit() {
    void this.exchange();
  }

  private async exchange() {
    const { code, state } = this.route.snapshot.queryParams;
    const vendor = this.vendorService.getCurrentVendor();
    if (!code || !state || !vendor) {
      this.state.set('error');
      return;
    }
    try {
      await this.qontoService.exchange(
        vendor.id,
        String(code),
        String(state),
        `${window.location.origin}/admin/qonto/callback`
      );
      this.router.navigate(['/admin/restaurant-info/paiement'], {
        replaceUrl: true,
      });
    } catch (error) {
      console.error('Qonto code exchange failed:', error);
      this.state.set('error');
    }
  }

  async onRetry() {
    const vendor = this.vendorService.getCurrentVendor();
    if (!vendor) {
      this.backToPaiement();
      return;
    }
    try {
      const url = await this.qontoService.authorizeUrl(
        vendor.id,
        `${window.location.origin}/admin/qonto/callback`
      );
      window.location.href = url;
    } catch (error) {
      console.error('Qonto retry failed:', error);
      this.state.set('error');
    }
  }

  backToPaiement() {
    this.router.navigate(['/admin/restaurant-info/paiement'], {
      replaceUrl: true,
    });
  }
}
