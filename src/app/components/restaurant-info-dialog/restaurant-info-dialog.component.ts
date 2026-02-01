import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { materialComponents } from '../../material.components';
import {
  VendorService,
  type Vendor,
  type BusinessHours,
  type RestaurantInfo,
} from '../../services/vendor.service';

@Component({
  selector: 'app-restaurant-info-dialog',
  imports: [CommonModule, ...materialComponents],
  template: `
    <div class="restaurant-info-dialog">
      <mat-dialog-content>
        <div class="dialog-header">
          <div class="restaurant-header">
            <img
              *ngIf="data.vendor.logo_url"
              [src]="data.vendor.logo_url"
              [alt]="data.vendor.business_name + ' logo'"
              class="restaurant-logo"
            />
            <mat-icon
              *ngIf="!data.vendor.logo_url"
              class="restaurant-logo-fallback"
            >
              restaurant
            </mat-icon>
            <h2>{{ data.vendor.business_name }}</h2>
          </div>
        </div>

        <div class="info-sections">
          <!-- Business Hours Section -->
          <mat-card class="info-card">
            <mat-card-header>
              <mat-icon mat-card-avatar>schedule</mat-icon>
              <mat-card-title>Horaires d'ouverture</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="business-hours">
                <div *ngFor="let hours of data.businessHours" class="day-hours">
                  <span class="day">{{ hours.day }}</span>
                  <span class="hours" [class.closed]="hours.is_closed">
                    {{
                      hours.is_closed
                        ? 'Fermé'
                        : hours.open_time + ' - ' + hours.close_time
                    }}
                  </span>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Contact Information Section -->
          <mat-card class="info-card">
            <mat-card-header>
              <mat-icon mat-card-avatar>contact_phone</mat-icon>
              <mat-card-title>Contact</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="contact-info">
                <div *ngIf="data.contact.phone" class="contact-item">
                  <mat-icon>phone</mat-icon>
                  <span>{{ data.contact.phone }}</span>
                </div>
                <div *ngIf="data.contact.email" class="contact-item">
                  <mat-icon>email</mat-icon>
                  <span>{{ data.contact.email }}</span>
                </div>
                <div *ngIf="data.contact.website" class="contact-item">
                  <mat-icon>language</mat-icon>
                  <a [href]="data.contact.website" target="_blank">{{
                    data.contact.website
                  }}</a>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Address Section -->
          <mat-card class="info-card">
            <mat-card-header>
              <mat-icon mat-card-avatar>location_on</mat-icon>
              <mat-card-title>Adresse</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="address-info">
                <p>{{ data.address.street }}</p>
                <p>{{ data.address.postal_code }} {{ data.address.city }}</p>
                <p>{{ data.address.country }}</p>
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="onClose()">
          <mat-icon>close</mat-icon>
          Fermer
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .restaurant-info-dialog {
        max-width: 600px;
        background: var(--mat-sys-surface-container-high);
        color: var(--mat-sys-on-surface);
      }

      .dialog-header {
        margin-bottom: 16px;
      }

      .restaurant-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 16px;
      }

      .restaurant-logo {
        width: 48px;
        height: 48px;
        border-radius: 8px;
        object-fit: cover;
        background: var(--mat-sys-surface-container);
      }

      .restaurant-logo-fallback {
        width: 48px;
        height: 48px;
        font-size: 48px;
        color: var(--mat-sys-primary);
      }

      .restaurant-header h2 {
        margin: 0;
        color: var(--mat-sys-on-surface);
        font: var(--mat-sys-headline-medium);
      }

      .info-sections {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .info-card {
        border-radius: 12px;
        background: var(--mat-sys-surface-container);
        box-shadow: var(--mat-sys-level1);
      }

      .info-card mat-card-header mat-icon[mat-card-avatar] {
        color: var(--mat-sys-primary);
      }

      .business-hours {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .day-hours {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }

      .day-hours:last-child {
        border-bottom: none;
      }

      .day {
        font-weight: 500;
        color: var(--mat-sys-on-surface);
      }

      .hours {
        color: var(--mat-sys-on-surface-variant);
      }

      .hours.closed {
        color: var(--mat-sys-error);
        font-style: italic;
      }

      .contact-info {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .contact-item {
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--mat-sys-on-surface);
      }

      .contact-item mat-icon {
        color: var(--mat-sys-primary);
      }

      .contact-item a {
        color: var(--mat-sys-primary);
        text-decoration: none;
      }

      .contact-item a:hover {
        text-decoration: underline;
        color: var(--mat-sys-primary);
      }

      .address-info p {
        margin: 4px 0;
        color: var(--mat-sys-on-surface-variant);
      }

      mat-dialog-actions {
        padding: 16px 24px;
        border-top: 1px solid var(--mat-sys-outline-variant);
        background: var(--mat-sys-surface-container-high);
      }

      mat-dialog-actions button {
        border-radius: 20px;
        color: var(--mat-sys-primary);
      }
    `,
  ],
})
export class RestaurantInfoDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<RestaurantInfoDialogComponent>);
  protected data = inject<RestaurantInfo>(MAT_DIALOG_DATA);

  ngOnInit() {
    // You can add any initialization logic here
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
