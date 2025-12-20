import { Component, Inject, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule, MatCheckboxChange } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import {
  Customisation,
  CustomisationOption,
} from '../../../models/customisation.interface';
import { ProductStepOption } from '../../../models/multi-step-product.model';
import { VendorCurrencyPipe } from '../../../shared/pipes/vendor-currency.pipe';

export interface CustomisationSelectionDialogData {
  product: ProductStepOption;
  customisations: Customisation[];
  existingSelections?: Map<number, number[]>;
}

export interface CustomisationSelectionResult {
  selections: Map<number, number[]>;
}

@Component({
  selector: 'app-customisation-selection-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatRadioModule,
    MatCheckboxModule,
    MatDividerModule,
    FormsModule,
    VendorCurrencyPipe,
  ],
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>
        <mat-icon>tune</mat-icon>
        <span>Personnaliser {{ data.product.name }}</span>
      </h2>
      <button mat-icon-button (click)="onClose()">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <div mat-dialog-content class="dialog-content">
      <div class="customisations-container">
        @for (customisation of data.customisations; track customisation.id) {
          @if (customisation.is_available) {
            <mat-card class="customisation-card" appearance="outlined">
              <mat-card-header>
                <mat-card-title>
                  {{ customisation.name }}
                  @if (customisation.is_required) {
                    <span class="required-indicator">*</span>
                  }
                </mat-card-title>
                @if (customisation.description) {
                  <mat-card-subtitle>{{ customisation.description }}</mat-card-subtitle>
                }
              </mat-card-header>

              <mat-card-content>
                <div class="selection-hint">
                  {{ getCustomisationHint(customisation) }}
                </div>

                <!-- Single Select Options -->
                @if (customisation.selection_type === 'single-select') {
                  <div class="options-list single-select">
                    @for (option of customisation.options; track option.id) {
                      @if (option.is_available) {
                        <div 
                          class="option-item"
                          [class.selected]="isOptionSelected(customisation.id, option.id)"
                          (click)="onSingleSelectOption(customisation, option)"
                        >
                          <div class="option-content">
                            @if (option.image_url) {
                              <img 
                                [src]="option.image_url" 
                                [alt]="option.name" 
                                class="option-image"
                              />
                            }
                            <div class="option-info">
                              <div class="option-name">{{ option.name }}</div>
                              @if (option.description) {
                                <div class="option-description">{{ option.description }}</div>
                              }
                            </div>
                            @if (option.price_adjustment && option.price_adjustment !== 0) {
                              <div class="option-price">
                                {{ option.price_adjustment > 0 ? '+' : '' }}{{ option.price_adjustment | vendorCurrency }}
                              </div>
                            }
                          </div>
                          <div class="selection-indicator">
                            @if (isOptionSelected(customisation.id, option.id)) {
                              <mat-icon>check_circle</mat-icon>
                            } @else {
                              <mat-icon>radio_button_unchecked</mat-icon>
                            }
                          </div>
                        </div>
                      }
                    }
                  </div>
                }

                <!-- Multi Select Options -->
                @if (customisation.selection_type === 'multi-select') {
                  <div class="options-list multi-select">
                    @for (option of customisation.options; track option.id) {
                      @if (option.is_available) {
                        <div 
                          class="option-item"
                          [class.selected]="isOptionSelected(customisation.id, option.id)"
                          [class.disabled]="!canSelectMoreOptions(customisation) && !isOptionSelected(customisation.id, option.id)"
                          (click)="onMultiSelectOption(customisation, option)"
                        >
                          <div class="option-content">
                            @if (option.image_url) {
                              <img 
                                [src]="option.image_url" 
                                [alt]="option.name" 
                                class="option-image"
                              />
                            }
                            <div class="option-info">
                              <div class="option-name">{{ option.name }}</div>
                              @if (option.description) {
                                <div class="option-description">{{ option.description }}</div>
                              }
                            </div>
                            @if (option.price_adjustment && option.price_adjustment !== 0) {
                              <div class="option-price">
                                {{ option.price_adjustment > 0 ? '+' : '' }}{{ option.price_adjustment | vendorCurrency }}
                              </div>
                            }
                          </div>
                          <div class="selection-indicator">
                            @if (isOptionSelected(customisation.id, option.id)) {
                              <mat-icon>check_box</mat-icon>
                            } @else {
                              <mat-icon>check_box_outline_blank</mat-icon>
                            }
                          </div>
                        </div>
                      }
                    }
                  </div>
                }
              </mat-card-content>
            </mat-card>
          }
        }
      </div>
    </div>

    <div mat-dialog-actions class="dialog-actions">
      <button mat-button (click)="onClose()">
        Annuler
      </button>
      <button
        matButton="filled"
        (click)="onValidate()"
        [disabled]="!canValidate()"
      >
        <mat-icon>check</mat-icon>
        Valider
      </button>
    </div>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }

    .dialog-header h2 {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      font-size: 1.25rem;
      font-weight: 500;
      text-overflow: ellipsis;
      overflow:hidden;
      white-space: nowrap;
      color: var(--mat-sys-on-surface);
      span {
        text-overflow: ellipsis;
        overflow:hidden;
        white-space: nowrap;
      }
    }

    .dialog-content {
      padding: 16px 24px;
      max-height: 70vh;
      overflow-y: auto;
    }

    .customisations-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }



    .customisation-card mat-card-title {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 1.1rem;
      font-weight: 500;
    }

    .required-indicator {
      color: var(--mat-sys-error);
      font-weight: bold;
    }

    .selection-hint {
      font-size: 0.875rem;
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 12px;
    }

    .options-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .option-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .option-item:hover:not(.disabled) {
      background-color: var(--mat-sys-surface-variant);
      border-color: var(--mat-sys-primary);
    }

    .option-item.selected {
      background-color: rgba(var(--mat-sys-primary-rgb, 103, 80, 164), 0.1);
      border-color: var(--mat-sys-primary);
      border-width: 2px;
    }

    .option-item.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .option-content {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }

    .option-image {
      width: 48px;
      height: 48px;
      object-fit: cover;
      border-radius: 4px;
    }

    .option-info {
      flex: 1;
    }

    .option-name {
      font-weight: 500;
      color: var(--mat-sys-on-surface);
    }

    .option-description {
      font-size: 0.875rem;
      color: var(--mat-sys-on-surface-variant);
      margin-top: 4px;
    }

    .option-price {
      font-weight: 500;
      color: var(--mat-sys-primary);
      margin-left: 12px;
    }

    .selection-indicator {
      display: flex;
      align-items: center;
      margin-left: 12px;
    }

    .selection-indicator mat-icon {
      color: var(--mat-sys-primary);
    }

    .dialog-actions {
      padding: 16px 24px;
      border-top: 1px solid var(--mat-sys-outline-variant);
      justify-content: flex-end;
      gap: 8px;
    }

    @media (max-width: 600px) {
      .dialog-content {
        padding: 12px;
      }

      .option-content {
        flex-direction: column;
        align-items: flex-start;
      }

      .option-image {
        width: 100%;
        height: auto;
        max-height: 150px;
      }

      .option-price {
        margin-left: 0;
        margin-top: 8px;
      }
    }
  `],
})
export class CustomisationSelectionDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<CustomisationSelectionDialogComponent>);

  // Local selections state
  customisationSelections = new Map<number, number[]>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: CustomisationSelectionDialogData
  ) {}

  ngOnInit(): void {
    // Initialize selections from existing data
    if (this.data.existingSelections) {
      this.customisationSelections = new Map(this.data.existingSelections);
    } else {
      // Initialize empty selections for each customisation
      this.data.customisations.forEach((customisation) => {
        this.customisationSelections.set(customisation.id, []);
      });
    }
  }

  onSingleSelectOption(customisation: Customisation, option: CustomisationOption): void {
    if (!option.is_available) return;

    // Set the selection
    this.customisationSelections.set(customisation.id, [option.id]);

    // If this is the last required customisation and it's single-select, auto-validate
    if (this.shouldAutoValidate()) {
      setTimeout(() => {
        this.onValidate();
      }, 300);
    }
  }

  onMultiSelectOption(customisation: Customisation, option: CustomisationOption): void {
    if (!option.is_available) return;

    const currentSelections = this.customisationSelections.get(customisation.id) || [];
    const index = currentSelections.indexOf(option.id);

    if (index > -1) {
      // Remove if already selected
      const newSelections = currentSelections.filter((id) => id !== option.id);
      this.customisationSelections.set(customisation.id, newSelections);
    } else {
      // Add if not selected and haven't exceeded max selections
      if (currentSelections.length < customisation.max_selections) {
        this.customisationSelections.set(customisation.id, [
          ...currentSelections,
          option.id,
        ]);
      }
    }
  }

  isOptionSelected(customisationId: number, optionId: number): boolean {
    const selections = this.customisationSelections.get(customisationId) || [];
    return selections.includes(optionId);
  }

  canSelectMoreOptions(customisation: Customisation): boolean {
    const currentSelections = this.customisationSelections.get(customisation.id) || [];
    return currentSelections.length < customisation.max_selections;
  }

  getCustomisationHint(customisation: Customisation): string {
    const currentSelections =
      this.customisationSelections.get(customisation.id) || [];

    if (customisation.selection_type === 'single-select') {
      return customisation.is_required
        ? 'Choisissez une option *'
        : 'Choisissez une option (optionnel)';
    } else if (customisation.selection_type === 'multi-select') {
      const min = customisation.min_selections;
      const max = customisation.max_selections;
      const current = currentSelections.length;

      if (min === max) {
        return `Choisissez exactement ${min} option${min > 1 ? 's' : ''}${
          customisation.is_required ? ' *' : ''
        } (${current}/${min})`;
      } else if (min > 0) {
        return `Choisissez ${min} à ${max} options${
          customisation.is_required ? ' *' : ''
        } (${current}/${max})`;
      } else {
        return `Choisissez jusqu'à ${max} option${max > 1 ? 's' : ''}${
          customisation.is_required ? ' *' : ''
        } (${current}/${max})`;
      }
    }
    return '';
  }

  canValidate(): boolean {
    // Check all required customisations have valid selections
    for (const customisation of this.data.customisations) {
      if (!customisation.is_available) continue;
      if (!customisation.is_required) continue;

      const selections = this.customisationSelections.get(customisation.id) || [];
      
      if (customisation.selection_type === 'single-select') {
        if (selections.length === 0) return false;
      } else if (customisation.selection_type === 'multi-select') {
        if (selections.length < customisation.min_selections) return false;
        if (selections.length > customisation.max_selections) return false;
      }
    }
    return true;
  }

  shouldAutoValidate(): boolean {
    // Auto-validate if all customisations are single-select and all required ones are filled
    const allSingleSelect = this.data.customisations
      .filter((c) => c.is_available)
      .every((c) => c.selection_type === 'single-select');

    if (!allSingleSelect) return false;

    return this.canValidate();
  }

  onValidate(): void {
    if (!this.canValidate()) return;

    const result: CustomisationSelectionResult = {
      selections: this.customisationSelections,
    };

    this.dialogRef.close(result);
  }

  onClose(): void {
    this.dialogRef.close(null);
  }
}

