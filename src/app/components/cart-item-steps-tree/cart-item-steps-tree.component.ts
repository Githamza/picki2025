import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatExpansionModule } from '@angular/material/expansion';
import { CartMultiStepMetadata } from '../../models/multi-step-product.model';

type StepSelections = CartMultiStepMetadata['stepSelections'];

@Component({
  selector: 'app-cart-item-steps-tree',
  imports: [CommonModule, MatExpansionModule],
  template: `
    @if (selectedOptions().length) {
      <mat-expansion-panel
        class="steps-expansion"
        togglePosition="before"
        hideToggle="false"
      >
        <mat-expansion-panel-header class="steps-expansion-header">
          <div class="steps-expansion-header-content">
            <ng-content select="[stepsHeader]"></ng-content>
          </div>
        </mat-expansion-panel-header>
        <div class="selected-options">
          <span
            *ngFor="let optionName of selectedOptions(); let last = last"
            class="selected-option"
          >
            {{ optionName }}<span *ngIf="!last">, </span>
          </span>
        </div>
      </mat-expansion-panel>
    }
  `,
  styles: [
      `
.mat-expansion-panel:not([class*=mat-elevation-z]) {
    box-shadow: none;
}
      :host {
        display: block;
      }
      .steps-expansion {
        background: transparent;
        box-shadow: none;
      }
      .mat-expansion-panel:not(.mat-expanded) .mat-expansion-panel-header:not([aria-disabled=true]):hover {
        background: transparent;
      }
      .steps-expansion-header {
        padding: 0;
        background: transparent;
        padding-left: 10px;
      }
      .steps-expansion-header-content {
        display: flex;
        width: 100%;
      }
      .selected-options {
        padding: 4px 0 0 0;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.9em;
      }
      .selected-option {
        color: var(--mat-sys-on-surface-variant);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartItemStepsTreeComponent {
  readonly steps = input<StepSelections | null>(null);
  readonly selectedOptions = computed(() =>
    (this.steps() ?? []).flatMap((step) =>
      step.selectedOptions.map((option) => option.optionName)
    )
  );
}

