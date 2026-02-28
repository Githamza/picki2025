import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ChangeDetectionStrategy } from '@angular/core';
import { VendorService } from '../../../../services/vendor.service';
import { RestaurantInfoDataService } from '../../restaurant-info-data.service';
import { ImageUploadComponent } from '../../../../shared/components/image-upload/image-upload.component';

@Component({
  selector: 'app-apparence',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatSnackBarModule,
    ImageUploadComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="onSave()">
      <mat-card class="info-section branding-section">
        <mat-card-header>
          <mat-icon mat-card-avatar>image</mat-icon>
          <mat-card-title>Image de marque</mat-card-title>
          <mat-card-subtitle>Personnalisez l'apparence de votre restaurant</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <!-- Banner Image -->
          <div class="branding-item">
            <div class="branding-label">
              <mat-icon>panorama</mat-icon>
              <div class="branding-label-text">
                <span class="label-title">Image de bannière</span>
                <span class="label-hint">Format recommandé : 1200x400px</span>
              </div>
            </div>
            <div class="banner-preview-container" *ngIf="form.get('bannerUrl')?.value">
              <img
                [src]="form.get('bannerUrl')?.value"
                alt="Bannière du restaurant"
                class="banner-preview"
              />
            </div>
            <app-image-upload
              formControlName="bannerUrl"
              label="URL de la bannière"
              placeholder="https://... ou téléchargez une image"
              [folder]="vendorId"
            ></app-image-upload>
          </div>

          <mat-divider class="branding-divider"></mat-divider>

          <!-- Logo -->
          <div class="branding-item">
            <div class="branding-label">
              <mat-icon>store</mat-icon>
              <div class="branding-label-text">
                <span class="label-title">Logo du restaurant</span>
                <span class="label-hint">Format recommandé : 200x200px (carré)</span>
              </div>
            </div>
            <app-image-upload
              formControlName="logoUrl"
              label="URL du logo"
              placeholder="https://... ou téléchargez une image"
              [folder]="vendorId"
            ></app-image-upload>
          </div>
        </mat-card-content>
      </mat-card>

      <div class="actions">
        <button
          mat-raised-button
          color="primary"
          type="submit"
          [disabled]="isSaving()"
          class="save-button"
        >
          <mat-icon>save</mat-icon>
          {{ isSaving() ? 'Enregistrement...' : 'Enregistrer' }}
        </button>
        <button
          mat-button
          type="button"
          (click)="onReset()"
          [disabled]="isSaving()"
          class="reset-button"
        >
          <mat-icon>refresh</mat-icon>
          Annuler
        </button>
      </div>
    </form>
  `,
  styles: [`
    @use '../../../restaurant-info-admin/children/shared-styles' as shared;
    @include shared.child-section;

    .branding-section mat-card-content {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .branding-item {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .branding-label {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .branding-label mat-icon {
      color: var(--mat-sys-primary);
      margin-top: 2px;
    }

    .branding-label-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .label-title {
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-on-surface);
    }

    .label-hint {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .banner-preview-container {
      width: 100%;
      max-height: 200px;
      border-radius: var(--mat-sys-corner-medium);
      overflow: hidden;
      border: 1px solid var(--mat-sys-outline-variant);
    }

    .banner-preview {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .branding-divider {
      margin: 8px 0;
    }
  `],
})
export class ApparenceComponent implements OnInit {
  private fb = inject(FormBuilder);
  private vendorService = inject(VendorService);
  private dataService = inject(RestaurantInfoDataService);
  private snackBar = inject(MatSnackBar);

  form!: FormGroup;
  isSaving = signal(false);
  vendorId: string = '';

  ngOnInit() {
    const info = this.dataService.restaurantInfo();
    this.vendorId = this.vendorService.getCurrentVendor()?.id || '';
    this.form = this.fb.group({
      bannerUrl: [this.dataService.bannerUrl()],
      logoUrl: [info?.vendor.logo_url || ''],
    });
  }

  async onSave() {
    this.isSaving.set(true);
    try {
      const currentVendor = this.vendorService.getCurrentVendor();
      if (!currentVendor) throw new Error('No vendor selected');

      const bannerUrl = this.form.value.bannerUrl || '';
      const logoUrl = this.form.value.logoUrl || '';

      if (bannerUrl) {
        await this.vendorService.upsertVendorBanner(currentVendor.id, bannerUrl);
      }

      if (logoUrl !== currentVendor.logo_url) {
        await this.vendorService.updateVendorLogo(currentVendor.id, logoUrl);
      }

      await this.dataService.refreshVendor();
      this.snackBar.open('Apparence sauvegardée', 'Fermer', { duration: 3000, panelClass: ['success-snackbar'] });
    } catch {
      this.snackBar.open('Erreur lors de la sauvegarde', 'Fermer', { duration: 5000, panelClass: ['error-snackbar'] });
    } finally {
      this.isSaving.set(false);
    }
  }

  onReset() {
    const info = this.dataService.restaurantInfo();
    this.form.patchValue({
      bannerUrl: this.dataService.bannerUrl(),
      logoUrl: info?.vendor.logo_url || '',
    });
    this.snackBar.open('Modifications annulées', 'Fermer', { duration: 2000 });
  }
}
