import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RestaurantInfoDataService } from './restaurant-info-data.service';
import { ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-restaurant-info-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, MatIconModule, MatProgressSpinnerModule],
  providers: [RestaurantInfoDataService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="restaurant-info-shell">
      <div class="header">
        <h2>
          <mat-icon>restaurant</mat-icon>
          Mes Informations Restaurant
        </h2>
        <p class="subtitle">Gérez les informations de votre restaurant</p>
      </div>

      <div class="content" *ngIf="dataService.isLoaded()">
        <router-outlet></router-outlet>
      </div>

      <div class="loading" *ngIf="!dataService.isLoaded()">
        <mat-spinner diameter="50"></mat-spinner>
        <p>Chargement des informations...</p>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      background: var(--mat-sys-surface);
    }

    .restaurant-info-shell {
      padding: 24px;
      max-width: 800px;
      margin: 0 auto;
    }

    .header {
      margin-bottom: 32px;
      padding: 24px;
      text-align: center;
      background: var(--mat-sys-surface-container-low);
      border-radius: var(--mat-sys-corner-extra-large);
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

    .content {
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding-bottom: 24px;
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

    @media (max-width: 600px) {
      .restaurant-info-shell {
        padding: 16px;
      }

      .header h2 {
        font: var(--mat-sys-headline-small);
      }

      .header {
        padding: 16px;
        margin: -16px -16px 24px -16px;
        border-radius: 0;
      }
    }
  `],
})
export class RestaurantInfoShellComponent implements OnInit {
  dataService = inject(RestaurantInfoDataService);

  ngOnInit() {
    this.dataService.loadRestaurantInfo();
  }
}
