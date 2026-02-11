import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ChangeDetectionStrategy } from '@angular/core';
import { VendorService, type BusinessHours } from '../../../../services/vendor.service';
import { RestaurantInfoDataService } from '../../restaurant-info-data.service';

@Component({
  selector: 'app-horaires',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="onSave()">
      <mat-card class="info-section">
        <mat-card-header>
          <mat-icon mat-card-avatar>schedule</mat-icon>
          <mat-card-title>Horaires d'ouverture</mat-card-title>
          <mat-card-subtitle>Définissez vos heures d'ouverture pour chaque jour</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="business-hours-form" formArrayName="businessHours">
            <div
              *ngFor="let dayControl of businessHoursArray.controls; let i = index"
              [formGroupName]="i"
              class="day-block"
              [class.day-closed]="dayControl.get('is_closed')?.value"
            >
              <div class="day-row">
                <div class="day-info">
                  <span class="day-name">{{ getDayName(i) }}</span>
                </div>

                <mat-checkbox
                  formControlName="is_closed"
                  class="closed-checkbox"
                  (change)="onClosedToggle(i)"
                >
                  Fermé
                </mat-checkbox>

                <div class="time-controls" *ngIf="!dayControl.get('is_closed')?.value">
                  <mat-form-field appearance="outline" class="time-field" subscriptSizing="dynamic">
                    <mat-label>Ouverture</mat-label>
                    <input matInput type="time" formControlName="open_time" />
                  </mat-form-field>

                  <span class="time-separator">-</span>

                  <mat-form-field appearance="outline" class="time-field" subscriptSizing="dynamic">
                    <mat-label>Fermeture</mat-label>
                    <input matInput type="time" formControlName="close_time" />
                  </mat-form-field>
                </div>

                <div class="closed-indicator" *ngIf="dayControl.get('is_closed')?.value">
                  <span class="closed-text">Fermé toute la journée</span>
                </div>
              </div>

              <!-- Pickup Hours Section -->
              <div class="pickup-section" *ngIf="!dayControl.get('is_closed')?.value">
                <button
                  mat-button
                  type="button"
                  class="pickup-toggle-btn"
                  [class.active]="dayControl.get('pickup_enabled')?.value"
                  (click)="onTogglePickup(i)"
                >
                  <mat-icon>{{ dayControl.get('pickup_enabled')?.value ? 'check_circle' : 'add_circle_outline' }}</mat-icon>
                  {{ dayControl.get('pickup_enabled')?.value ? 'Horaires Click&Collect actifs' : 'Définir horaires Click&Collect' }}
                </button>

                <div class="pickup-hours" *ngIf="dayControl.get('pickup_enabled')?.value">
                  <mat-form-field appearance="outline" class="time-field" subscriptSizing="dynamic">
                    <mat-label>Début retrait</mat-label>
                    <input matInput type="time" formControlName="pickup_open_time" />
                  </mat-form-field>

                  <span class="time-separator">-</span>

                  <mat-form-field appearance="outline" class="time-field" subscriptSizing="dynamic">
                    <mat-label>Fin retrait</mat-label>
                    <input matInput type="time" formControlName="pickup_close_time" />
                  </mat-form-field>
                </div>
              </div>
            </div>
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

    .business-hours-form {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .day-block {
      border-radius: var(--mat-sys-corner-medium);
      border: 1px solid var(--mat-sys-outline-variant);
      transition: border-color 0.15s ease, background-color 0.15s ease;
      overflow: hidden;
    }

    .day-block:hover {
      border-color: var(--mat-sys-outline);
    }

    .day-block.day-closed {
      background: var(--mat-sys-surface-container-low);
      border-style: dashed;
    }

    .day-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
    }

    .day-info {
      min-width: 90px;
    }

    .day-name {
      font: var(--mat-sys-title-small);
      color: var(--mat-sys-on-surface);
    }

    .day-closed .day-name {
      color: var(--mat-sys-on-surface-variant);
    }

    .closed-checkbox {
      flex-shrink: 0;
    }

    .time-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }

    .time-field {
      width: 130px;
    }

    .time-separator {
      font: var(--mat-sys-body-large);
      color: var(--mat-sys-on-surface-variant);
      padding: 0 2px;
    }

    .closed-indicator {
      margin-left: auto;
    }

    .closed-text {
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
      font-style: italic;
    }

    .pickup-section {
      padding: 8px 16px 12px;
      border-top: 1px solid var(--mat-sys-outline-variant);
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }

    .pickup-toggle-btn {
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }

    .pickup-toggle-btn.active {
      color: var(--mat-sys-tertiary);
    }

    .pickup-hours {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
      padding-left: 8px;
      align-self: end;
    }

    @media (max-width: 600px) {
      .day-row {
        flex-wrap: wrap;
        gap: 8px 16px;
      }

      .day-info {
        min-width: 80px;
      }

      .time-controls {
        width: 100%;
        margin-left: 0;
      }

      .time-field {
        flex: 1;
        width: auto;
        min-width: 0;
      }

      .closed-indicator {
        margin-left: 0;
      }

      .pickup-section {
        margin: 0;
      }

      .pickup-hours {
        width: 100%;
        padding-left: 0;
      }

      .pickup-hours .time-field {
        flex: 1;
        width: auto;
        min-width: 0;
      }
    }
  `],
})
export class HorairesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private vendorService = inject(VendorService);
  private dataService = inject(RestaurantInfoDataService);
  private snackBar = inject(MatSnackBar);

  form!: FormGroup;
  isSaving = signal(false);

  private dayNames = [
    'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi',
  ];

  get businessHoursArray(): FormArray {
    return this.form.get('businessHours') as FormArray;
  }

  getDayName(index: number): string {
    return this.dayNames[index];
  }

  ngOnInit() {
    const info = this.dataService.restaurantInfo();
    const hours = info?.businessHours || [];
    this.form = this.fb.group({
      businessHours: this.fb.array(
        hours.length > 0
          ? this.createBusinessHoursControls(hours)
          : this.createEmptyBusinessHoursControls()
      ),
    });
  }

  private createBusinessHoursControls(businessHours: BusinessHours[]): FormGroup[] {
    const sorted = [...businessHours].sort((a, b) => {
      return this.dayNames.indexOf(a.day) - this.dayNames.indexOf(b.day);
    });
    return sorted.map((h) =>
      this.fb.group({
        is_closed: [h.is_closed],
        open_time: [h.open_time, h.is_closed ? [] : [Validators.required]],
        close_time: [h.close_time, h.is_closed ? [] : [Validators.required]],
        pickup_enabled: [h.pickup_enabled ?? false],
        pickup_open_time: [h.pickup_open_time ?? null],
        pickup_close_time: [h.pickup_close_time ?? null],
      })
    );
  }

  private createEmptyBusinessHoursControls(): FormGroup[] {
    return this.dayNames.map(() =>
      this.fb.group({
        is_closed: [false],
        open_time: ['11:00', [Validators.required]],
        close_time: ['23:00', [Validators.required]],
        pickup_enabled: [false],
        pickup_open_time: [null],
        pickup_close_time: [null],
      })
    );
  }

  onClosedToggle(dayIndex: number) {
    const dayControl = this.businessHoursArray.at(dayIndex);
    const isClosed = dayControl.get('is_closed')?.value;

    if (isClosed) {
      dayControl.get('open_time')?.setValue(null);
      dayControl.get('close_time')?.setValue(null);
      dayControl.get('open_time')?.clearValidators();
      dayControl.get('close_time')?.clearValidators();
      // Disable pickup when closing
      dayControl.get('pickup_enabled')?.setValue(false);
      dayControl.get('pickup_open_time')?.setValue(null);
      dayControl.get('pickup_close_time')?.setValue(null);
    } else {
      dayControl.get('open_time')?.setValue('11:00');
      dayControl.get('close_time')?.setValue('23:00');
      dayControl.get('open_time')?.setValidators([Validators.required]);
      dayControl.get('close_time')?.setValidators([Validators.required]);
    }

    dayControl.get('open_time')?.updateValueAndValidity();
    dayControl.get('close_time')?.updateValueAndValidity();
  }

  onTogglePickup(dayIndex: number) {
    const dayControl = this.businessHoursArray.at(dayIndex);
    const currentValue = dayControl.get('pickup_enabled')?.value;

    if (!currentValue) {
      // Enabling: copy opening hours as defaults
      const openTime = dayControl.get('open_time')?.value;
      const closeTime = dayControl.get('close_time')?.value;
      dayControl.get('pickup_enabled')?.setValue(true);
      dayControl.get('pickup_open_time')?.setValue(openTime);
      dayControl.get('pickup_close_time')?.setValue(closeTime);
    } else {
      // Disabling: clear pickup times
      dayControl.get('pickup_enabled')?.setValue(false);
      dayControl.get('pickup_open_time')?.setValue(null);
      dayControl.get('pickup_close_time')?.setValue(null);
    }
  }

  async onSave() {
    if (this.form.invalid) return;
    this.isSaving.set(true);
    try {
      await this.vendorService.saveRestaurantInfo({
        businessHours: this.form.value.businessHours,
      });
      await this.dataService.refreshVendor();
      this.snackBar.open('Horaires sauvegardés', 'Fermer', { duration: 3000, panelClass: ['success-snackbar'] });
    } catch {
      this.snackBar.open('Erreur lors de la sauvegarde', 'Fermer', { duration: 5000, panelClass: ['error-snackbar'] });
    } finally {
      this.isSaving.set(false);
    }
  }

  onReset() {
    const info = this.dataService.restaurantInfo();
    const hours = info?.businessHours || [];
    this.form.setControl(
      'businessHours',
      this.fb.array(
        hours.length > 0
          ? this.createBusinessHoursControls(hours)
          : this.createEmptyBusinessHoursControls()
      )
    );
    this.snackBar.open('Modifications annulées', 'Fermer', { duration: 2000 });
  }
}
