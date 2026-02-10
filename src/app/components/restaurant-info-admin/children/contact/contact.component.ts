import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ChangeDetectionStrategy } from '@angular/core';
import { VendorService } from '../../../../services/vendor.service';
import { RestaurantInfoDataService } from '../../restaurant-info-data.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="onSave()">
      <!-- Contact Information -->
      <mat-card class="info-section">
        <mat-card-header>
          <mat-icon mat-card-avatar>contact_phone</mat-icon>
          <mat-card-title>Informations de contact</mat-card-title>
          <mat-card-subtitle>Vos coordonnées pour les clients</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="contact-form" formGroupName="contact">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Téléphone</mat-label>
              <input matInput formControlName="phone" placeholder="+33 X XX XX XX XX" />
              <mat-icon matSuffix>phone</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email" placeholder="contact@restaurant.fr" />
              <mat-icon matSuffix>email</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Site web</mat-label>
              <input matInput type="url" formControlName="website" placeholder="https://restaurant.fr" />
              <mat-icon matSuffix>language</mat-icon>
            </mat-form-field>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Address -->
      <mat-card class="info-section">
        <mat-card-header>
          <mat-icon mat-card-avatar>location_on</mat-icon>
          <mat-card-title>Adresse du restaurant</mat-card-title>
          <mat-card-subtitle>Adresse physique de votre établissement</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="address-form" formGroupName="address">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Adresse</mat-label>
              <input matInput formControlName="street" placeholder="123 Rue Example" />
              <mat-icon matSuffix>home</mat-icon>
            </mat-form-field>

            <div class="address-row">
              <mat-form-field appearance="outline" class="postal-code">
                <mat-label>Code postal</mat-label>
                <input matInput formControlName="postal_code" placeholder="37000" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="city">
                <mat-label>Ville</mat-label>
                <input matInput formControlName="city" placeholder="Tours" />
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Pays</mat-label>
              <input matInput formControlName="country" placeholder="France" />
              <mat-icon matSuffix>public</mat-icon>
            </mat-form-field>
          </div>
        </mat-card-content>
      </mat-card>

      <div class="actions">
        <button
          mat-raised-button
          color="primary"
          type="submit"
          [disabled]="form.invalid || isSaving()"
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

    .address-row {
      display: flex;
      gap: 16px;
    }

    .postal-code {
      flex: 0 0 140px;
    }

    .city {
      flex: 1;
    }

    @media (max-width: 600px) {
      .address-row {
        flex-direction: column;
        gap: 0;
      }

      .postal-code {
        flex: 1;
      }
    }
  `],
})
export class ContactComponent implements OnInit {
  private fb = inject(FormBuilder);
  private vendorService = inject(VendorService);
  private dataService = inject(RestaurantInfoDataService);
  private snackBar = inject(MatSnackBar);

  form!: FormGroup;
  isSaving = signal(false);

  ngOnInit() {
    const info = this.dataService.restaurantInfo();
    this.form = this.fb.group({
      contact: this.fb.group({
        phone: [info?.contact.phone || ''],
        email: [info?.contact.email || '', [Validators.email]],
        website: [info?.contact.website || ''],
      }),
      address: this.fb.group({
        street: [info?.address.street || ''],
        city: [info?.address.city || ''],
        postal_code: [info?.address.postal_code || ''],
        country: [info?.address.country || ''],
      }),
    });
  }

  async onSave() {
    if (this.form.invalid) return;
    this.isSaving.set(true);
    try {
      await this.vendorService.saveRestaurantInfo({
        contact: this.form.value.contact,
        address: this.form.value.address,
      });
      await this.dataService.refreshVendor();
      this.snackBar.open('Contact sauvegardé', 'Fermer', { duration: 3000, panelClass: ['success-snackbar'] });
    } catch {
      this.snackBar.open('Erreur lors de la sauvegarde', 'Fermer', { duration: 5000, panelClass: ['error-snackbar'] });
    } finally {
      this.isSaving.set(false);
    }
  }

  onReset() {
    const info = this.dataService.restaurantInfo();
    this.form.patchValue({
      contact: {
        phone: info?.contact.phone || '',
        email: info?.contact.email || '',
        website: info?.contact.website || '',
      },
      address: {
        street: info?.address.street || '',
        city: info?.address.city || '',
        postal_code: info?.address.postal_code || '',
        country: info?.address.country || '',
      },
    });
    this.snackBar.open('Modifications annulées', 'Fermer', { duration: 2000 });
  }
}
