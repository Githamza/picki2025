import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ChangeDetectionStrategy } from '@angular/core';
import { VendorService } from '../../../../services/vendor.service';
import { RestaurantInfoDataService } from '../../restaurant-info-data.service';

@Component({
  selector: 'app-stocks',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
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
          <mat-icon mat-card-avatar>inventory_2</mat-icon>
          <mat-card-title>Gestion des stocks</mat-card-title>
          <mat-card-subtitle>Paramètres de réinitialisation automatique</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="order-types">
            <mat-checkbox formControlName="dailyStockResetEnabled">
              Effacer les stocks systématiquement quotidiennement
            </mat-checkbox>
          </div>
          <p class="hint-text">
            Si activé, tous les stocks seront remis à « illimité » chaque jour à minuit.
          </p>
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
  `],
})
export class StocksComponent implements OnInit {
  private fb = inject(FormBuilder);
  private vendorService = inject(VendorService);
  private dataService = inject(RestaurantInfoDataService);
  private snackBar = inject(MatSnackBar);

  form!: FormGroup;
  isSaving = signal(false);

  ngOnInit() {
    const info = this.dataService.restaurantInfo();
    this.form = this.fb.group({
      dailyStockResetEnabled: [(info?.vendor as any)?.daily_stock_reset_enabled ?? true],
    });
  }

  async onSave() {
    this.isSaving.set(true);
    try {
      await this.vendorService.saveRestaurantInfo({
        dailyStockResetEnabled: !!this.form.value.dailyStockResetEnabled,
      });
      await this.dataService.refreshVendor();
      this.snackBar.open('Stocks sauvegardés', 'Fermer', { duration: 3000, panelClass: ['success-snackbar'] });
    } catch {
      this.snackBar.open('Erreur lors de la sauvegarde', 'Fermer', { duration: 5000, panelClass: ['error-snackbar'] });
    } finally {
      this.isSaving.set(false);
    }
  }

  onReset() {
    const info = this.dataService.restaurantInfo();
    this.form.patchValue({
      dailyStockResetEnabled: (info?.vendor as any)?.daily_stock_reset_enabled ?? true,
    });
    this.snackBar.open('Modifications annulées', 'Fermer', { duration: 2000 });
  }
}
