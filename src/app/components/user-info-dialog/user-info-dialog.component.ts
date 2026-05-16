import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  MatDialogRef,
  MatDialogModule,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  DiningPreferenceSelectorComponent,
  DiningPreferenceSelectorResult,
} from '../../shared/components/dining-preference-selector/dining-preference-selector.component';
import { DiningPreferenceService } from '../../services/dining-preference.service';
import { OrderType } from '../../services/vendor.service';

export interface UserInfo {
  nom: string;
  prenom: string;
  email: string;
  phone?: string;
}

export interface UserInfoDialogData {
  needsPreferenceStep: boolean;
  enabledOrderTypes: OrderType[];
  currentPreference?: OrderType | null;
  currentTiming?: 'asap' | 'later' | null;
  currentScheduledTime?: string | null;
  currentTableNumber?: string | null;
}

@Component({
  selector: 'app-user-info-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    DiningPreferenceSelectorComponent,
  ],
  template: `
    <div class="user-info-dialog">
      <!-- Step 1: Preference Selection -->
      @if (currentStep() === 'preference') {
        <h2 mat-dialog-title>
          <mat-icon>restaurant_menu</mat-icon>
          Preferences de commande
        </h2>

        <mat-dialog-content>
          <p class="dialog-description">
            Veuillez choisir votre mode de commande avant de continuer.
          </p>

          <app-dining-preference-selector
            [compact]="true"
            [enabledOrderTypes]="dialogData.enabledOrderTypes"
            [initialPreference]="dialogData.currentPreference ?? null"
            [initialTiming]="dialogData.currentTiming ?? null"
            [initialScheduledTime]="dialogData.currentScheduledTime ?? null"
            [initialTableNumber]="dialogData.currentTableNumber ?? null"
            (selectionChanged)="onSelectorChanged($event)"
          />
        </mat-dialog-content>

        <mat-dialog-actions align="end">
          <button mat-button (click)="onCancel()" type="button">
            <mat-icon>close</mat-icon>
            Annuler
          </button>
          <button
            mat-flat-button
            color="primary"
            (click)="onConfirmPreference()"
            [disabled]="!selectorResult() || !selectorResult()?.isValid"
            type="button"
          >
            <mat-icon>check</mat-icon>
            Confirmer
          </button>
        </mat-dialog-actions>
      }

      <!-- Step 2: User Info Form -->
      @if (currentStep() === 'userInfo') {
        <h2 mat-dialog-title>
          <mat-icon>person</mat-icon>
          Informations de commande
        </h2>

        <mat-dialog-content>
          <p class="dialog-description">
            Veuillez renseigner vos informations pour finaliser votre commande.
          </p>

          <form [formGroup]="userForm" class="user-form">
            <mat-form-field class="full-width">
              <mat-label>Nom *</mat-label>
              <input
                matInput
                formControlName="nom"
                placeholder="Votre nom de famille"
                autocomplete="family-name"
              />
              <mat-icon matSuffix>person</mat-icon>
              <mat-error *ngIf="userForm.get('nom')?.hasError('required')">
                Le nom est obligatoire
              </mat-error>
              <mat-error *ngIf="userForm.get('nom')?.hasError('minlength')">
                Le nom doit contenir au moins 2 caracteres
              </mat-error>
            </mat-form-field>

            <mat-form-field class="full-width">
              <mat-label>Prenom *</mat-label>
              <input
                matInput
                formControlName="prenom"
                placeholder="Votre prenom"
                autocomplete="given-name"
              />
              <mat-icon matSuffix>person_outline</mat-icon>
              <mat-error *ngIf="userForm.get('prenom')?.hasError('required')">
                Le prenom est obligatoire
              </mat-error>
              <mat-error *ngIf="userForm.get('prenom')?.hasError('minlength')">
                Le prenom doit contenir au moins 2 caracteres
              </mat-error>
            </mat-form-field>

            <mat-form-field class="full-width">
              <mat-label>Email *</mat-label>
              <input
                matInput
                type="email"
                formControlName="email"
                placeholder="votre.email@exemple.com"
                autocomplete="email"
              />
              <mat-icon matSuffix>email</mat-icon>
              <mat-error *ngIf="userForm.get('email')?.hasError('required')">
                L'email est obligatoire
              </mat-error>
              <mat-error *ngIf="userForm.get('email')?.hasError('email')">
                Veuillez saisir un email valide
              </mat-error>
            </mat-form-field>

            <mat-form-field class="full-width">
              <mat-label>Telephone *</mat-label>
              <input
                matInput
                type="tel"
                formControlName="phone"
                placeholder="+33 6 12 34 56 78"
                autocomplete="tel"
              />
              <mat-icon matSuffix>phone</mat-icon>
              <mat-error *ngIf="userForm.get('phone')?.hasError('required')">
                Le telephone est obligatoire
              </mat-error>
              <mat-error *ngIf="userForm.get('phone')?.hasError('pattern')">
                Format de telephone invalide
              </mat-error>
            </mat-form-field>
          </form>
        </mat-dialog-content>

        <mat-dialog-actions align="end">
          <button mat-button (click)="onCancel()" type="button">
            <mat-icon>close</mat-icon>
            Annuler
          </button>
          <button
            mat-flat-button
            color="primary"
            (click)="onConfirm()"
            [disabled]="userForm.invalid"
            type="button"
          >
            <mat-icon>payment</mat-icon>
            Continuer vers le paiement
          </button>
        </mat-dialog-actions>
      }
    </div>
  `,
  styles: [
    `
      .user-info-dialog {
        min-width: 400px;
        max-width: 500px;
      }

      .dialog-description {
        margin-bottom: 20px;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.95rem;
      }

      .user-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .full-width {
        width: 100%;
      }

      mat-dialog-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 0;
      }

      mat-dialog-content {
        padding: 20px 24px;
      }

      mat-dialog-actions {
        padding: 16px 24px;
        gap: 12px;
      }

      mat-dialog-actions button {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      mat-form-field {
        margin-bottom: 8px;
      }

      .mat-mdc-form-field-subscript-wrapper {
        margin-top: 4px;
      }

      @media (max-width: 480px) {
        .user-info-dialog {
          min-width: 320px;
          max-width: 90vw;
        }
      }
    `,
  ],
})
export class UserInfoDialogComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<UserInfoDialogComponent>);
  private diningPreferenceService = inject(DiningPreferenceService);
  readonly dialogData: UserInfoDialogData = inject(MAT_DIALOG_DATA, {
    optional: true,
  }) ?? { needsPreferenceStep: false, enabledOrderTypes: [] };

  currentStep = signal<'preference' | 'userInfo'>(
    this.dialogData.needsPreferenceStep ? 'preference' : 'userInfo'
  );

  selectorResult = signal<DiningPreferenceSelectorResult | null>(null);

  userForm: FormGroup;

  constructor() {
    this.userForm = this.fb.group({
      nom: ['', [Validators.required, Validators.minLength(2)]],
      prenom: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [
        '',
        [Validators.required, Validators.pattern(/^(\+33|0)[1-9](\d{8})$/)],
      ],
    });
  }

  onSelectorChanged(result: DiningPreferenceSelectorResult): void {
    this.selectorResult.set(result);
  }

  onConfirmPreference(): void {
    const result = this.selectorResult();
    if (!result?.isValid) return;

    let timing = result.timing;
    let scheduledDate: Date | undefined;
    let scheduledTime: string | undefined;

    if (timing === 'later') {
      if (result.scheduledTime) {
        scheduledDate = result.scheduledDate;
        scheduledTime = result.scheduledTime;
      } else {
        timing = null;
      }
    }

    this.diningPreferenceService.setDiningPreference({
      preference: result.preference,
      timing,
      scheduledDate,
      scheduledTime,
      tableNumber: result.tableNumber,
    });

    this.currentStep.set('userInfo');
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    if (this.userForm.valid) {
      const userInfo: UserInfo = {
        nom: this.userForm.value.nom.trim(),
        prenom: this.userForm.value.prenom.trim(),
        email: this.userForm.value.email.trim(),
        phone: this.userForm.value.phone?.trim() || undefined,
      };
      this.dialogRef.close(userInfo);
    }
  }
}
