import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { RestaurantInfoDataService } from '../../restaurant-info-admin/restaurant-info-data.service';
import { ImpressionComponent } from '../../restaurant-info-admin/children/impression/impression.component';

/**
 * Device setup page for the shop APK (`/kiosk/setup`).
 *
 * Printer settings live in per-app Capacitor Preferences, so the shop APK
 * needs its own configuration surface: the admin "Impression" page only
 * exists in the admin APK's storage. This page reuses that same component,
 * providing the RestaurantInfoDataService the admin shell normally provides.
 *
 * Reached via the attract screen's hidden maintenance gesture
 * (see attract-screen.component.ts).
 */
@Component({
  selector: 'app-kiosk-setup',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ImpressionComponent,
  ],
  providers: [RestaurantInfoDataService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kiosk-setup">
      <button mat-stroked-button class="back-button" (click)="backToKiosk()">
        <mat-icon>arrow_back</mat-icon>
        Retour à la borne
      </button>

      <div class="header">
        <h2>
          <mat-icon>print</mat-icon>
          Réglages de cette borne
        </h2>
        <p class="subtitle">
          Configurez l'imprimante à tickets de cette tablette. Les réglages
          sont enregistrés sur cet appareil uniquement.
        </p>
      </div>

      @if (dataService.isLoaded()) {
        <app-impression />
      } @else {
        <div class="loading">
          <mat-spinner diameter="50"></mat-spinner>
          <p>Chargement des réglages...</p>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: var(--mat-sys-surface);
      }

      .kiosk-setup {
        padding: 24px;
        max-width: 800px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .header {
        padding: 24px;
        text-align: center;
        background: var(--mat-sys-surface-container-low);
        border-radius: var(--mat-sys-corner-extra-large);
      }

      /* Kiosk-sized touch target (SPEC FR4: ≥64px). */
      .back-button {
        align-self: flex-start;
        min-height: 64px;
        padding: 0 24px;
      }

      .header h2 {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin: 0 0 8px 0;
        font: var(--mat-sys-headline-medium);
        color: var(--mat-sys-on-surface);
      }

      .header h2 mat-icon {
        color: var(--mat-sys-primary);
      }

      .subtitle {
        margin: 0;
        font: var(--mat-sys-body-medium);
        color: var(--mat-sys-on-surface-variant);
      }

      .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 64px;
        background: var(--mat-sys-surface-container);
        border-radius: var(--mat-sys-corner-large);
      }

      .loading p {
        font: var(--mat-sys-body-medium);
        color: var(--mat-sys-on-surface-variant);
      }
    `,
  ],
})
export class KioskSetupComponent implements OnInit {
  protected readonly dataService = inject(RestaurantInfoDataService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.dataService.loadRestaurantInfo();
  }

  backToKiosk(): void {
    // The entry guard re-resolves the storefront, so this works even after
    // a session change.
    this.router.navigateByUrl('/kiosk');
  }
}
