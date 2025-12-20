import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogRef,
  MatDialogModule,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { RefuseReason, RefuseReasonLabels } from '../../../models/refuse-reason.enum';
import { Order } from '../../../models/order.model';

@Component({
  selector: 'app-refuse-reason-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
  ],
  template: `
    <div class="refuse-reason-dialog">
      <div class="dialog-header">
        <h2 mat-dialog-title>
          <mat-icon>cancel</mat-icon>
          Motif de refus
        </h2>
        <button
          mat-icon-button
          (click)="closeDialog()"
          class="close-button"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content>
        <p class="dialog-description">
          Veuillez sélectionner ou indiquer le motif de refus de la commande
          #{{ data.order.orderNumber }}
        </p>

        <div class="reasons-section">
          <h3 class="section-label">Sélectionner un motif</h3>
          <mat-chip-listbox [(ngModel)]="selectedReason" (ngModelChange)="onReasonChange()">
            @for (reason of predefinedReasons; track reason.value) {
              <mat-chip-option [value]="reason.value">
                {{ reason.label }}
              </mat-chip-option>
            }
          </mat-chip-listbox>
        </div>

        <div class="custom-reason-section">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Motif personnalisé</mat-label>
            <textarea
              matInput
              [(ngModel)]="customReason"
              (ngModelChange)="onCustomReasonChange()"
              placeholder="Décrivez le motif de refus..."
              rows="3"
              maxlength="500"
            ></textarea>
            <mat-hint align="end">{{ customReason.length }}/500</mat-hint>
          </mat-form-field>
        </div>

        @if (showError()) {
          <div class="error-message">
            <mat-icon>error</mat-icon>
            <span>Veuillez sélectionner un motif ou entrer un motif personnalisé</span>
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions>
        <button
          mat-button
          (click)="closeDialog()"
        >
          Annuler
        </button>
        <button
          matButton="filled"
          color="warn"
          (click)="submitRefusal()"
          [disabled]="!isValid()"
        >
          Confirmer le refus
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .refuse-reason-dialog {
        min-width: 500px;
        max-width: 600px;

        @media (max-width: 768px) {
          min-width: 0;
          max-width: 100%;
        }
      }

      .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        border-bottom: 1px solid var(--mat-sys-outline-variant);

        h2 {
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 20px;
          font-weight: 500;
          color: var(--mat-sys-error);

          mat-icon {
            font-size: 24px;
            width: 24px;
            height: 24px;
          }
        }

        .close-button {
          margin-left: 0;
        }
      }

      mat-dialog-content {
        padding: 24px;
      }

      .dialog-description {
        margin: 0 0 24px 0;
        color: var(--mat-sys-on-surface-variant);
        font-size: 14px;
        line-height: 1.5;
      }

      .reasons-section {
        margin-bottom: 24px;

        .section-label {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 500;
          color: var(--mat-sys-on-surface);
        }

        mat-chip-listbox {
          width: 100%;
        }

        mat-chip-option {
          margin: 4px;
        }
      }

      .custom-reason-section {
        margin-bottom: 16px;

        .full-width {
          width: 100%;
        }
      }

      .error-message {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background-color: var(--mat-sys-error-container);
        color: var(--mat-sys-on-error-container);
        border-radius: 8px;
        font-size: 14px;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
      }

      mat-dialog-actions {
        padding: 16px 24px;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        border-top: 1px solid var(--mat-sys-outline-variant);

        button {
          mat-icon {
            margin-right: 4px;
          }
        }
      }
    `,
  ],
})
export class RefuseReasonDialogComponent {
  dialogRef = inject(MatDialogRef<RefuseReasonDialogComponent>);
  data = inject<{ order: Order }>(MAT_DIALOG_DATA);

  selectedReason: RefuseReason | null = null;
  customReason = '';
  showError = signal(false);

  predefinedReasons = [
    { value: RefuseReason.OUT_OF_STOCK, label: RefuseReasonLabels[RefuseReason.OUT_OF_STOCK] },
    { value: RefuseReason.RESTAURANT_CLOSED, label: RefuseReasonLabels[RefuseReason.RESTAURANT_CLOSED] },
    { value: RefuseReason.TOO_BUSY, label: RefuseReasonLabels[RefuseReason.TOO_BUSY] },
    { value: RefuseReason.TECHNICAL_ISSUE, label: RefuseReasonLabels[RefuseReason.TECHNICAL_ISSUE] },
    { value: RefuseReason.INVALID_ORDER, label: RefuseReasonLabels[RefuseReason.INVALID_ORDER] },
  ];

  onReasonChange() {
    this.showError.set(false);
  }

  onCustomReasonChange() {
    this.showError.set(false);
    // If custom reason is entered, select CUSTOM reason
    if (this.customReason.trim()) {
      this.selectedReason = RefuseReason.CUSTOM;
    }
  }

  isValid(): boolean {
    return this.selectedReason !== null || this.customReason.trim().length > 0;
  }

  submitRefusal() {
    if (!this.isValid()) {
      this.showError.set(true);
      return;
    }

    const reason = this.selectedReason;
    const customText = this.customReason.trim();

    // If custom text is provided, use it regardless of selected reason
    const refuseReason = customText 
      ? `${RefuseReasonLabels[RefuseReason.CUSTOM]}: ${customText}`
      : (reason ? RefuseReasonLabels[reason] : '');

    this.dialogRef.close({ confirmed: true, reason: refuseReason });
  }

  closeDialog() {
    this.dialogRef.close({ confirmed: false });
  }
}

