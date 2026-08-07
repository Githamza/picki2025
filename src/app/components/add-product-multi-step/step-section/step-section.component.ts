import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';

import {
  ProductStep,
  ProductStepOption,
} from '../../../models/multi-step-product.model';
import { ProductOptionCardComponent } from '../product-option-card/product-option-card.component';

/**
 * Constraint hint shown above the options (SPEC.md FR4d): surfaced
 * upfront, counting down as the customer picks — never a post-hoc error.
 */
export function selectionHint(step: ProductStep, selectedCount: number): string {
  if (step.stepType === 'single-select') {
    return selectedCount === 0 ? 'Choisissez une option' : '';
  }
  const min = step.isRequired ? Math.max(step.minSelections, 1) : step.minSelections;
  const max = step.maxSelections;
  if (selectedCount === 0) {
    return min === max ? `Choisissez ${min} option${min > 1 ? 's' : ''}` : `Choisissez ${min} à ${max} options`;
  }
  if (selectedCount < min) {
    const remaining = min - selectedCount;
    return `Encore ${remaining} choix`;
  }
  if (selectedCount < max) {
    const remaining = max - selectedCount;
    return `Encore ${remaining} choix possible${remaining > 1 ? 's' : ''}`;
  }
  return '';
}

/**
 * One step of a multi-step product (SPEC.md FR4d).
 *
 * The shared engine for both shells: the scrolling page (phone / tablet
 * portrait) renders sections stacked, the kiosk phase reuses it one step
 * per screen. Collapsed + satisfied, the section header itself is the
 * recap — there is no separate summary step.
 */
@Component({
  selector: 'app-step-section',
  standalone: true,
  imports: [
    MatIconModule,
    MatButtonModule,
    MatRippleModule,
    ProductOptionCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './step-section.component.html',
  styleUrl: './step-section.component.scss',
})
export class StepSectionComponent {
  readonly step = input.required<ProductStep>();
  readonly selectedOptionIds = input<number[]>([]);
  readonly active = input(false);
  /** Option ids rendered as out of stock (parent owns cart/stock math). */
  readonly outOfStockOptionIds = input<number[]>([]);

  readonly optionClicked = output<{ step: ProductStep; optionId: number }>();
  readonly imageClicked = output<{ imageUrl: string; imageName: string }>();
  /** Header tap on a collapsed section — parent re-activates the step. */
  readonly edit = output<void>();

  readonly availableOptions = computed(() =>
    this.step().options.filter((option) => option.isAvailable)
  );

  readonly selectedOptions = computed(() =>
    this.step().options.filter((option) =>
      this.selectedOptionIds().includes(option.id)
    )
  );

  readonly isSatisfied = computed(() => {
    const step = this.step();
    const count = this.selectedOptionIds().length;
    if (!step.isRequired && count === 0) return false;
    const min = step.isRequired ? Math.max(step.minSelections, 1) : step.minSelections;
    return count >= min && count <= step.maxSelections;
  });

  readonly statusLabel = computed(() =>
    this.step().isRequired ? 'Obligatoire' : 'Optionnel'
  );

  readonly hint = computed(() => {
    const count = this.selectedOptionIds().length;
    // The zero-state prompt duplicates the vendor's own description when
    // one exists — only the live countdown adds information then.
    if (count === 0 && this.step().description) {
      return '';
    }
    return selectionHint(this.step(), count);
  });

  readonly selectedNames = computed(() =>
    this.selectedOptions()
      .map((option) => option.name)
      .join(', ')
  );

  isSelected(option: ProductStepOption): boolean {
    return this.selectedOptionIds().includes(option.id);
  }

  isOutOfStock(option: ProductStepOption): boolean {
    return this.outOfStockOptionIds().includes(option.id);
  }
}
