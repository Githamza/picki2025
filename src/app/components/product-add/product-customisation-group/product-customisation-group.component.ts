import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { MatRadioModule, MatRadioChange } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  Customisation,
  CustomisationOption,
} from '../../../models/customisation.interface';
import { VendorCurrencyPipe } from '../../../shared/pipes/vendor-currency.pipe';

@Component({
  selector: 'app-product-customisation-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatRadioModule, MatCheckboxModule, VendorCurrencyPipe],
  templateUrl: './product-customisation-group.component.html',
  styleUrl: './product-customisation-group.component.scss',
})
export class ProductCustomisationGroupComponent {
  customisation = input.required<Customisation>();
  selectedIds = input<number[]>([]);
  selectionChange = output<number[]>();

  getSelectedOptionId(): number | null {
    const ids = this.selectedIds();
    return ids.length > 0 ? ids[0] : null;
  }

  isOptionSelected(optionId: number): boolean {
    return this.selectedIds().includes(optionId);
  }

  getHint(): string {
    const customisation = this.customisation();
    const current = this.selectedIds().length;

    if (customisation.selection_type === 'single-select') {
      return customisation.is_required
        ? 'Choisissez une option *'
        : 'Choisissez une option (optionnel)';
    }

    const min = customisation.min_selections;
    const max = customisation.max_selections;
    const required = customisation.is_required ? ' *' : '';

    if (min === max) {
      return `Choisissez exactement ${min} option${min > 1 ? 's' : ''}${required} (${current}/${min})`;
    } else if (min > 0) {
      return `Choisissez ${min} à ${max} options${required} (${current}/${max})`;
    } else {
      return `Choisissez jusqu'à ${max} option${max > 1 ? 's' : ''}${required} (${current}/${max})`;
    }
  }

  onRadioChange(event: MatRadioChange): void {
    const option = this.customisation().options?.find((o) => o.id === event.value);
    if (option?.is_available) {
      this.selectionChange.emit([event.value]);
    }
  }

  onCheckboxChange(option: CustomisationOption, event: { checked: boolean }): void {
    if (!option.is_available) return;

    const current = [...this.selectedIds()];

    if (event.checked) {
      if (!current.includes(option.id) && current.length < this.customisation().max_selections) {
        this.selectionChange.emit([...current, option.id]);
      }
    } else {
      this.selectionChange.emit(current.filter((id) => id !== option.id));
    }
  }
}
