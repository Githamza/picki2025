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
              class="day-row"
            >
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
                <mat-form-field appearance="outline" class="time-field">
                  <mat-label>Ouverture</mat-label>
                  <input matInput type="time" formControlName="open_time" />
                </mat-form-field>

                <span class="time-separator">-</span>

                <mat-form-field appearance="outline" class="time-field">
                  <mat-label>Fermeture</mat-label>
                  <input matInput type="time" formControlName="close_time" />
                </mat-form-field>
              </div>

              <div class="closed-indicator" *ngIf="dayControl.get('is_closed')?.value">
                <span class="closed-text">Fermé toute la journée</span>
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
      gap: 8px;
    }

    .day-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      background: var(--mat-sys-surface-container-high);
      border-radius: var(--mat-sys-corner-medium);
      transition: background-color 0.15s ease;
    }

    .day-row:hover {
      background: var(--mat-sys-surface-container-highest);
    }

    .day-info {
      min-width: 100px;
    }

    .day-name {
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-on-surface);
    }

    .closed-checkbox {
      min-width: 80px;
    }

    .time-controls {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }

    .time-field {
      width: 120px;
    }

    .time-separator {
      font: var(--mat-sys-body-large);
      color: var(--mat-sys-on-surface-variant);
    }

    .closed-indicator {
      flex: 1;
      text-align: center;
    }

    .closed-text {
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-error);
      font-style: italic;
    }

    @media (max-width: 600px) {
      .day-row {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }

      .day-info {
        min-width: unset;
      }

      .time-controls {
        justify-content: space-between;
      }

      .time-field {
        flex: 1;
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
      })
    );
  }

  private createEmptyBusinessHoursControls(): FormGroup[] {
    return this.dayNames.map(() =>
      this.fb.group({
        is_closed: [false],
        open_time: ['11:00', [Validators.required]],
        close_time: ['23:00', [Validators.required]],
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
    } else {
      dayControl.get('open_time')?.setValue('11:00');
      dayControl.get('close_time')?.setValue('23:00');
      dayControl.get('open_time')?.setValidators([Validators.required]);
      dayControl.get('close_time')?.setValidators([Validators.required]);
    }

    dayControl.get('open_time')?.updateValueAndValidity();
    dayControl.get('close_time')?.updateValueAndValidity();
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
