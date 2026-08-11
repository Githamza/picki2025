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
  /** True when no payment screen follows (counter payment / kiosk):
   *  the submit button says so instead of "paiement". */
  payAtCounter?: boolean;
  /** Kiosk (FR4): only ask for the phone number, entered on a large
   *  on-screen numeric keypad. Name/email are filled with placeholders. */
  phoneOnly?: boolean;
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

      <!-- Step 2 (kiosk): phone number only, on-screen numeric keypad -->
      @if (currentStep() === 'userInfo' && phoneOnly) {
        <h2 mat-dialog-title>
          <mat-icon>phone</mat-icon>
          Votre numéro de téléphone
        </h2>

        <mat-dialog-content>
          <p class="dialog-description">
            Saisissez votre numéro pour être prévenu quand la commande est
            prête.
          </p>

          <form [formGroup]="userForm" class="user-form">
            <mat-form-field class="full-width">
              <mat-label>Téléphone</mat-label>
              <input
                matInput
                class="phone-display"
                type="tel"
                inputmode="none"
                formControlName="phone"
                placeholder="06 12 34 56 78"
                readonly
              />
              <mat-icon matSuffix>phone</mat-icon>
              <mat-hint>10 chiffres, ex. 0612345678</mat-hint>
            </mat-form-field>

            <div class="keypad">
              @for (digit of keypadDigits; track digit) {
                <button
                  mat-stroked-button
                  type="button"
                  class="keypad-key"
                  (click)="appendDigit(digit)"
                >
                  {{ digit }}
                </button>
              }
              <span aria-hidden="true"></span>
              <button
                mat-stroked-button
                type="button"
                class="keypad-key"
                (click)="appendDigit('0')"
              >
                0
              </button>
              <button
                mat-stroked-button
                type="button"
                class="keypad-key"
                (click)="eraseDigit()"
                aria-label="Effacer le dernier chiffre"
              >
                <mat-icon>backspace</mat-icon>
              </button>
            </div>
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
            <mat-icon>receipt_long</mat-icon>
            Valider la commande
          </button>
        </mat-dialog-actions>
      }

      <!-- Step 2: User Info Form -->
      @if (currentStep() === 'userInfo' && !phoneOnly) {
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
              <mat-label>Nom</mat-label>
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
              <mat-label>Prenom</mat-label>
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
              <mat-label>Email</mat-label>
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
              <mat-label>Telephone</mat-label>
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
            <mat-icon>{{ dialogData.payAtCounter ? 'receipt_long' : 'payment' }}</mat-icon>
            {{
              dialogData.payAtCounter
                ? 'Valider la commande'
                : 'Continuer vers le paiement'
            }}
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

      .phone-display {
        font-size: 1.4rem;
        letter-spacing: 3px;
        text-align: center;
      }

      .keypad {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-top: 12px;
      }

      .keypad-key {
        height: 64px;
        font-size: 1.5rem;
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

  readonly phoneOnly = !!this.dialogData.phoneOnly;

  currentStep = signal<'preference' | 'userInfo'>(
    this.dialogData.needsPreferenceStep ? 'preference' : 'userInfo'
  );

  selectorResult = signal<DiningPreferenceSelectorResult | null>(null);

  readonly keypadDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  userForm: FormGroup;

  constructor() {
    const phoneValidators = [
      Validators.required,
      Validators.pattern(/^(\+33|0)[1-9](\d{8})$/),
    ];
    this.userForm = this.phoneOnly
      ? this.fb.group({ phone: ['', phoneValidators] })
      : this.fb.group({
          nom: ['', [Validators.required, Validators.minLength(2)]],
          prenom: ['', [Validators.required, Validators.minLength(2)]],
          email: ['', [Validators.required, Validators.email]],
          phone: ['', phoneValidators],
        });
  }

  appendDigit(digit: string): void {
    const control = this.userForm.get('phone');
    const value: string = control?.value ?? '';
    if (value.length >= 10) {
      return;
    }
    control?.setValue(value + digit);
  }

  eraseDigit(): void {
    const control = this.userForm.get('phone');
    const value: string = control?.value ?? '';
    control?.setValue(value.slice(0, -1));
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
    if (this.userForm.invalid) {
      return;
    }
    // Kiosk: only the phone is asked; name/email get placeholders the
    // ticket and dashboard render gracefully (no email is sent for
    // pay-at-counter orders).
    const userInfo: UserInfo = this.phoneOnly
      ? {
          nom: 'Kiosque',
          prenom: 'Client',
          email: '',
          phone: this.userForm.value.phone.trim(),
        }
      : {
          nom: this.userForm.value.nom.trim(),
          prenom: this.userForm.value.prenom.trim(),
          email: this.userForm.value.email.trim(),
          phone: this.userForm.value.phone?.trim() || undefined,
        };
    this.dialogRef.close(userInfo);
  }
}
