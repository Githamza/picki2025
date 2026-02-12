import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ChangeDetectionStrategy } from '@angular/core';
import { VendorService } from '../../../../services/vendor.service';
import { RestaurantInfoDataService } from '../../restaurant-info-data.service';

@Component({
  selector: 'app-messages',
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
    MatSlideToggleModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="onSave()">
      <mat-card class="info-section">
        <mat-card-header>
          <mat-icon mat-card-avatar>message</mat-icon>
          <mat-card-title>Messages personnalisés</mat-card-title>
          <mat-card-subtitle>Personnalisez les messages affichés à vos clients</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="contact-form" formGroupName="customMessages">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Message de fermeture (titre)</mat-label>
              <input
                matInput
                formControlName="closedMessage"
                placeholder="On est fermé actuellement"
              />
              <mat-icon matSuffix>store</mat-icon>
              <mat-hint>Titre affiché dans la popup quand le restaurant est fermé</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Description de fermeture</mat-label>
              <input
                matInput
                formControlName="closedDescription"
                placeholder="N'hésitez pas à revenir plus tard."
              />
              <mat-icon matSuffix>description</mat-icon>
              <mat-hint>Description affichée sous le titre de la popup de fermeture</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Message de suspension des commandes</mat-label>
              <input
                matInput
                formControlName="ordersSuspendedMessage"
                placeholder="les commandes en ligne sont actuellement suspendues"
              />
              <mat-icon matSuffix>pause_circle</mat-icon>
              <mat-hint>Message affiché dans la barre quand les commandes sont suspendues</mat-hint>
            </mat-form-field>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="info-section">
        <mat-card-header>
          <mat-icon mat-card-avatar>info</mat-icon>
          <mat-card-title>Message d'information</mat-card-title>
          <mat-card-subtitle>Affichez un bandeau d'information pour vos clients</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="contact-form" formGroupName="infoMessage">
            <div class="toggle-row">
              <mat-slide-toggle
                formControlName="enabled"
                color="primary"
              >
                Activer le bandeau d'information
              </mat-slide-toggle>
            </div>

            <mat-form-field
              appearance="outline"
              class="full-width"
              *ngIf="form.get('infoMessage.enabled')?.value"
            >
              <mat-label>Message d'information</mat-label>
              <input
                matInput
                formControlName="message"
                placeholder="Ex: Nouveau menu disponible dès lundi !"
              />
              <mat-icon matSuffix>campaign</mat-icon>
              <mat-hint>Ce message sera affiché en haut de la page pour tous vos clients</mat-hint>
            </mat-form-field>
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

    .toggle-row {
      margin-bottom: 16px;
    }
  `],
})
export class MessagesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private vendorService = inject(VendorService);
  private dataService = inject(RestaurantInfoDataService);
  private snackBar = inject(MatSnackBar);

  form!: FormGroup;
  isSaving = signal(false);

  ngOnInit() {
    const info = this.dataService.restaurantInfo();
    this.form = this.fb.group({
      customMessages: this.fb.group({
        closedMessage: [info?.vendor.closed_message || ''],
        closedDescription: [info?.vendor.closed_description || ''],
        ordersSuspendedMessage: [info?.vendor.orders_suspended_message || ''],
      }),
      infoMessage: this.fb.group({
        enabled: [info?.vendor.info_message_enabled ?? false],
        message: [info?.vendor.info_message || ''],
      }),
    });
  }

  async onSave() {
    this.isSaving.set(true);
    try {
      const val = this.form.value.customMessages;
      const infoVal = this.form.value.infoMessage;
      await this.vendorService.saveRestaurantInfo({
        customMessages: {
          closed_message: val.closedMessage?.trim() || null,
          closed_description: val.closedDescription?.trim() || null,
          orders_suspended_message: val.ordersSuspendedMessage?.trim() || null,
          info_message: infoVal.message?.trim() || null,
          info_message_enabled: infoVal.enabled ?? false,
        },
      });
      await this.dataService.refreshVendor();
      this.snackBar.open('Messages sauvegardés', 'Fermer', { duration: 3000, panelClass: ['success-snackbar'] });
    } catch {
      this.snackBar.open('Erreur lors de la sauvegarde', 'Fermer', { duration: 5000, panelClass: ['error-snackbar'] });
    } finally {
      this.isSaving.set(false);
    }
  }

  onReset() {
    const info = this.dataService.restaurantInfo();
    this.form.patchValue({
      customMessages: {
        closedMessage: info?.vendor.closed_message || '',
        closedDescription: info?.vendor.closed_description || '',
        ordersSuspendedMessage: info?.vendor.orders_suspended_message || '',
      },
      infoMessage: {
        enabled: info?.vendor.info_message_enabled ?? false,
        message: info?.vendor.info_message || '',
      },
    });
    this.snackBar.open('Modifications annulées', 'Fermer', { duration: 2000 });
  }
}
