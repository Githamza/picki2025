import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AppliedCoupon } from '../../models/coupon.model';
import { VendorCurrencyPipe } from '../../shared/pipes/vendor-currency.pipe';

/**
 * Presentational coupon input. Renders either an empty input (with apply
 * button) or a chip-style summary of the applied coupon (with remove button).
 * The container is responsible for calling the validation service and
 * updating the NgRx state; this component only emits intent.
 */
@Component({
  selector: 'app-coupon-input',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    VendorCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (applied(); as coupon) {
      <div class="coupon-applied" role="status" aria-live="polite">
        <mat-icon class="coupon-icon" aria-hidden="true">local_offer</mat-icon>
        <div class="coupon-info">
          <span class="coupon-code">{{ coupon.code }}</span>
          <span class="coupon-discount">
            -{{ coupon.discountAmount | vendorCurrency }}
          </span>
        </div>
        <button
          mat-icon-button
          type="button"
          class="coupon-remove"
          aria-label="Retirer le code promo"
          [disabled]="busy()"
          (click)="onRemove()"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>
    } @else {
      <form class="coupon-form" (ngSubmit)="onApply()">
        <mat-form-field appearance="outline" class="coupon-field">
          <mat-label>Code promo</mat-label>
          <input
            matInput
            type="text"
            autocomplete="off"
            autocapitalize="characters"
            [formControl]="codeControl"
            [maxlength]="32"
            (input)="onInputChange()"
            aria-describedby="coupon-error"
          />
          <mat-icon matIconPrefix>local_offer</mat-icon>
          @if (errorMessage(); as msg) {
            <mat-error id="coupon-error">{{ msg }}</mat-error>
          }
        </mat-form-field>
        <button
          mat-flat-button
          type="submit"
          class="coupon-submit"
          color="primary"
          [disabled]="!canSubmit() || busy()"
        >
          @if (busy()) {
            <mat-spinner diameter="18" />
          } @else {
            Appliquer
          }
        </button>
      </form>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .coupon-form {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }

      .coupon-field {
        flex: 1 1 auto;
        min-width: 0;
      }

      .coupon-submit {
        flex: 0 0 auto;
        height: 56px;
        min-width: 96px;
        margin-top: 0;
      }

      :host ::ng-deep .coupon-field .mat-mdc-form-field-subscript-wrapper {
        font-size: 0.75rem;
      }

      .coupon-applied {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: var(--mat-sys-tertiary-container);
        color: var(--mat-sys-on-tertiary-container);
        border-radius: var(--mat-sys-corner-medium);
      }

      .coupon-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }

      .coupon-info {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        min-width: 0;
        gap: 2px;
      }

      .coupon-code {
        font: var(--mat-sys-label-large);
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .coupon-discount {
        font: var(--mat-sys-body-small);
      }

      .coupon-remove {
        flex-shrink: 0;
        color: inherit;
      }

      @media (max-width: 600px) {
        .coupon-form {
          gap: 6px;
        }
        .coupon-submit {
          height: 56px;
          min-width: 84px;
          padding: 0 12px;
        }
      }
    `,
  ],
})
export class CouponInputComponent {
  readonly applied = input<AppliedCoupon | undefined>(undefined);
  readonly busy = input<boolean>(false);
  readonly error = input<string | null>(null);

  readonly apply = output<string>();
  readonly remove = output<void>();

  readonly codeControl = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(3)],
  });

  private readonly localError = signal<string | null>(null);

  readonly errorMessage = computed(
    () => this.error() ?? this.localError()
  );

  readonly canSubmit = computed(() => {
    const value = (this.codeControl.value || '').trim();
    return value.length >= 3;
  });

  constructor() {
    effect(() => {
      const err = this.error();
      if (err) {
        this.localError.set(null);
      }
    });
  }

  protected onInputChange(): void {
    this.localError.set(null);
    const v = this.codeControl.value;
    if (v && v !== v.toUpperCase()) {
      const start = (document.activeElement as HTMLInputElement)?.selectionStart;
      this.codeControl.setValue(v.toUpperCase(), { emitEvent: false });
      if (start !== undefined && document.activeElement instanceof HTMLInputElement) {
        document.activeElement.setSelectionRange(start, start);
      }
    }
  }

  protected onApply(): void {
    if (!this.canSubmit() || this.busy()) return;
    const code = this.codeControl.value.trim().toUpperCase();
    this.apply.emit(code);
  }

  protected onRemove(): void {
    if (this.busy()) return;
    this.codeControl.reset('');
    this.localError.set(null);
    this.remove.emit();
  }
}
