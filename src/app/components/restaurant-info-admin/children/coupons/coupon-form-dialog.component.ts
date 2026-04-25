import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import {
  CouponDiscountType,
  CouponInsert,
  CouponRow,
  CouponUpdate,
} from '../../../../models/coupon.model';

export interface CouponFormDialogData {
  vendorId: string;
  /** Existing coupon when editing, otherwise the dialog is in "create" mode. */
  coupon?: CouponRow;
}

export type CouponFormResult =
  | { mode: 'create'; payload: CouponInsert }
  | { mode: 'update'; id: string; payload: CouponUpdate };

interface CouponFormControls {
  code: FormControl<string>;
  discountType: FormControl<CouponDiscountType>;
  discountPercent: FormControl<number | null>;
  discountValue: FormControl<number | null>;
  validFrom: FormControl<Date | null>;
  validUntil: FormControl<Date | null>;
  hasMaxUses: FormControl<boolean>;
  maxUses: FormControl<number | null>;
  hasMinSubtotal: FormControl<boolean>;
  minSubtotal: FormControl<number | null>;
  isActive: FormControl<boolean>;
}

const CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function plusDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function dateRangeValidator(
  control: AbstractControl
): ValidationErrors | null {
  const from = control.get('validFrom')?.value as Date | null | undefined;
  const until = control.get('validUntil')?.value as Date | null | undefined;
  if (from && until && until.getTime() <= from.getTime()) {
    return { rangeInvalid: true };
  }
  return null;
}

@Component({
  selector: 'app-coupon-form-dialog',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'fr-FR' },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title class="title">
      <mat-icon aria-hidden="true">local_offer</mat-icon>
      {{ isEditing() ? 'Modifier le code promo' : 'Nouveau code promo' }}
    </h2>

    <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
      <mat-dialog-content class="content">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Code</mat-label>
          <input
            matInput
            type="text"
            formControlName="code"
            autocomplete="off"
            autocapitalize="characters"
            [maxlength]="32"
            (input)="onCodeInput($event)"
          />
          <mat-hint align="end">{{ form.controls.code.value.length }}/32</mat-hint>
          @if (form.controls.code.touched && form.controls.code.invalid) {
            <mat-error>3 à 32 caractères : lettres majuscules, chiffres, "-" ou "_".</mat-error>
          }
        </mat-form-field>

        <div class="field-block">
          <span class="block-label">Type de réduction</span>
          <mat-button-toggle-group
            formControlName="discountType"
            class="type-toggle"
            aria-label="Type de réduction"
          >
            <mat-button-toggle value="percentage">Pourcentage</mat-button-toggle>
            <mat-button-toggle value="fixed">Montant fixe</mat-button-toggle>
          </mat-button-toggle-group>
        </div>

        @if (form.controls.discountType.value === 'percentage') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Pourcentage</mat-label>
            <input
              matInput
              type="number"
              inputmode="decimal"
              formControlName="discountPercent"
              min="1"
              max="100"
              step="1"
            />
            <span matTextSuffix>%</span>
            @if (form.controls.discountPercent.touched && form.controls.discountPercent.invalid) {
              <mat-error>Entrez une valeur entre 1 et 100.</mat-error>
            }
          </mat-form-field>
        } @else {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Montant</mat-label>
            <input
              matInput
              type="number"
              inputmode="decimal"
              formControlName="discountValue"
              min="0.01"
              step="0.01"
            />
            <span matTextSuffix>{{ currencySymbol() }}</span>
            @if (form.controls.discountValue.touched && form.controls.discountValue.invalid) {
              <mat-error>Entrez un montant supérieur à 0.</mat-error>
            }
          </mat-form-field>
        }

        <div class="dates">
          <mat-form-field appearance="outline">
            <mat-label>Valide du</mat-label>
            <input
              matInput
              [matDatepicker]="fromPicker"
              formControlName="validFrom"
            />
            <mat-datepicker-toggle matIconSuffix [for]="fromPicker" />
            <mat-datepicker #fromPicker />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Au</mat-label>
            <input
              matInput
              [matDatepicker]="untilPicker"
              [min]="form.controls.validFrom.value"
              formControlName="validUntil"
            />
            <mat-datepicker-toggle matIconSuffix [for]="untilPicker" />
            <mat-datepicker #untilPicker />
          </mat-form-field>
        </div>
        @if (form.errors?.['rangeInvalid']) {
          <p class="form-error">La date de fin doit être postérieure à la date de début.</p>
        }

        <div class="field-block">
          <mat-checkbox formControlName="hasMaxUses">
            Limiter le nombre d'utilisations
          </mat-checkbox>
          @if (form.controls.hasMaxUses.value) {
            <mat-form-field appearance="outline" class="inline-field">
              <mat-label>Nombre maximum</mat-label>
              <input
                matInput
                type="number"
                inputmode="numeric"
                min="1"
                step="1"
                formControlName="maxUses"
              />
              @if (form.controls.maxUses.touched && form.controls.maxUses.invalid) {
                <mat-error>Doit être un entier &gt; 0.</mat-error>
              }
            </mat-form-field>
          }
        </div>

        <div class="field-block">
          <mat-checkbox formControlName="hasMinSubtotal">
            Exiger un panier minimum
          </mat-checkbox>
          @if (form.controls.hasMinSubtotal.value) {
            <mat-form-field appearance="outline" class="inline-field">
              <mat-label>Montant minimum du panier</mat-label>
              <input
                matInput
                type="number"
                inputmode="decimal"
                min="0.01"
                step="0.01"
                formControlName="minSubtotal"
              />
              <span matTextSuffix>{{ currencySymbol() }}</span>
              @if (form.controls.minSubtotal.touched && form.controls.minSubtotal.invalid) {
                <mat-error>Entrez un montant supérieur à 0.</mat-error>
              }
            </mat-form-field>
          }
        </div>

        <mat-checkbox formControlName="isActive">
          Coupon actif
        </mat-checkbox>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="actions">
        <button mat-button type="button" (click)="onCancel()">Annuler</button>
        <button
          mat-flat-button
          color="primary"
          type="submit"
          [disabled]="submitting()"
        >
          {{ isEditing() ? 'Enregistrer' : 'Créer' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
      }

      .title mat-icon {
        color: var(--mat-sys-primary);
      }

      .content {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding-top: 8px;
        min-width: min(540px, 92vw);
      }

      .full-width {
        width: 100%;
      }

      .field-block {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .block-label {
        font: var(--mat-sys-label-large);
        color: var(--mat-sys-on-surface-variant);
      }

      .type-toggle {
        align-self: flex-start;
      }

      .dates {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .inline-field {
        width: 100%;
        max-width: 280px;
      }

      .form-error {
        margin: 0;
        color: var(--mat-sys-error);
        font: var(--mat-sys-body-small);
      }

      .actions {
        padding: 8px 0 0;
      }

      @media (max-width: 600px) {
        .content {
          min-width: 0;
          width: 100%;
        }
        .dates {
          grid-template-columns: 1fr;
        }
        .inline-field {
          max-width: 100%;
        }
        .type-toggle {
          align-self: stretch;
        }
      }
    `,
  ],
})
export class CouponFormDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<CouponFormDialogComponent, CouponFormResult>
  );
  protected readonly data: CouponFormDialogData = inject(MAT_DIALOG_DATA);

  protected readonly submitting = signal(false);

  protected readonly isEditing = computed(() => !!this.data.coupon);

  protected readonly currencySymbol = computed(() => {
    // Symbol is locale/currency dependent; the existing app uses Intl in the
    // VendorCurrencyPipe. Inside the dialog we just show the ISO code as a
    // discreet suffix, which avoids leaking locale logic into this layer.
    return '';
  });

  protected readonly form: FormGroup<CouponFormControls> = this.buildForm();

  private buildForm(): FormGroup<CouponFormControls> {
    const c = this.data.coupon;
    const initialFrom = c?.valid_from ? new Date(c.valid_from) : startOfToday();
    const initialUntil = c?.valid_until
      ? new Date(c.valid_until)
      : plusDays(startOfToday(), 30);

    const group = new FormGroup<CouponFormControls>(
      {
        code: new FormControl<string>(c?.code ?? '', {
          nonNullable: true,
          validators: [Validators.required, Validators.pattern(CODE_PATTERN)],
        }),
        discountType: new FormControl<CouponDiscountType>(
          c?.discount_type ?? 'percentage',
          { nonNullable: true, validators: [Validators.required] }
        ),
        discountPercent: new FormControl<number | null>(
          c?.discount_percent ?? null,
          [Validators.min(1), Validators.max(100)]
        ),
        discountValue: new FormControl<number | null>(c?.discount_value ?? null, [
          Validators.min(0.01),
        ]),
        validFrom: new FormControl<Date | null>(initialFrom, {
          validators: [Validators.required],
        }),
        validUntil: new FormControl<Date | null>(initialUntil, {
          validators: [Validators.required],
        }),
        hasMaxUses: new FormControl<boolean>(c?.max_uses !== null && c?.max_uses !== undefined, {
          nonNullable: true,
        }),
        maxUses: new FormControl<number | null>(c?.max_uses ?? null, [
          Validators.min(1),
        ]),
        hasMinSubtotal: new FormControl<boolean>(
          c?.min_subtotal !== null && c?.min_subtotal !== undefined,
          { nonNullable: true }
        ),
        minSubtotal: new FormControl<number | null>(c?.min_subtotal ?? null, [
          Validators.min(0.01),
        ]),
        isActive: new FormControl<boolean>(c?.is_active ?? true, {
          nonNullable: true,
        }),
      },
      { validators: [dateRangeValidator] }
    );

    // Mutually exclusive: keep the inactive control nulled out, with the
    // proper required validator on the active one.
    group.controls.discountType.valueChanges.subscribe((type) => {
      if (type === 'percentage') {
        group.controls.discountValue.setValue(null);
        group.controls.discountValue.clearValidators();
        group.controls.discountValue.updateValueAndValidity({ emitEvent: false });
        group.controls.discountPercent.setValidators([
          Validators.required,
          Validators.min(1),
          Validators.max(100),
        ]);
        group.controls.discountPercent.updateValueAndValidity({ emitEvent: false });
      } else {
        group.controls.discountPercent.setValue(null);
        group.controls.discountPercent.clearValidators();
        group.controls.discountPercent.updateValueAndValidity({ emitEvent: false });
        group.controls.discountValue.setValidators([
          Validators.required,
          Validators.min(0.01),
        ]);
        group.controls.discountValue.updateValueAndValidity({ emitEvent: false });
      }
    });

    // Activate the right validator on initial load.
    queueMicrotask(() =>
      group.controls.discountType.setValue(group.controls.discountType.value)
    );

    group.controls.hasMaxUses.valueChanges.subscribe((enabled) => {
      if (!enabled) group.controls.maxUses.setValue(null);
    });
    group.controls.hasMinSubtotal.valueChanges.subscribe((enabled) => {
      if (!enabled) group.controls.minSubtotal.setValue(null);
    });

    return group;
  }

  protected onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const upper = input.value.toUpperCase();
    if (input.value !== upper) {
      const cursor = input.selectionStart;
      this.form.controls.code.setValue(upper, { emitEvent: false });
      input.value = upper;
      if (cursor !== null) input.setSelectionRange(cursor, cursor);
    }
  }

  protected onSubmit(): void {
    if (this.submitting()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const v = this.form.getRawValue();
    const validFrom = v.validFrom!;
    const validUntil = endOfDay(v.validUntil!);

    const basePayload = {
      code: v.code.trim().toUpperCase(),
      discount_type: v.discountType,
      discount_percent: v.discountType === 'percentage' ? v.discountPercent : null,
      discount_value: v.discountType === 'fixed' ? v.discountValue : null,
      valid_from: validFrom.toISOString(),
      valid_until: validUntil.toISOString(),
      max_uses: v.hasMaxUses ? v.maxUses : null,
      min_subtotal: v.hasMinSubtotal ? v.minSubtotal : null,
      is_active: v.isActive,
    };

    if (this.data.coupon) {
      this.dialogRef.close({
        mode: 'update',
        id: this.data.coupon.id,
        payload: basePayload as CouponUpdate,
      });
    } else {
      this.dialogRef.close({
        mode: 'create',
        payload: {
          ...basePayload,
          vendor_id: this.data.vendorId,
        } as CouponInsert,
      });
    }
  }

  protected onCancel(): void {
    this.dialogRef.close();
  }
}
