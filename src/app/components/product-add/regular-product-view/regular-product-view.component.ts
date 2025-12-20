import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  inject,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatRippleModule } from '@angular/material/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule, MatRadioChange } from '@angular/material/radio';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { Observable, Subject, combineLatest } from 'rxjs';
import {
  takeUntil,
  filter,
  shareReplay,
  distinctUntilChanged,
} from 'rxjs/operators';
import { Product, ProductService } from '../../../services/product.service';
import * as MultiStepProductActions from '../../../store/actions/multi-step-product.actions';
import * as MultiStepProductSelectors from '../../../store/selectors/multi-step-product.selectors';
import { AppState } from '../../../store/models/app.state';
import {
  ProductStep,
  ProductStepOption,
} from '../../../models/multi-step-product.model';
import {
  Customisation,
  CustomisationOption,
} from '../../../models/customisation.interface';
import { PRODUCT_PLACEHOLDER_IMAGE } from '../../../shared/utils/image-placeholder';

@Component({
  selector: 'app-regular-product-view',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
    MatListModule,
    MatRippleModule,
    MatBadgeModule,
    MatCheckboxModule,
    MatRadioModule,
    FormsModule,
  ],
  templateUrl: './regular-product-view.component.html',
  styleUrl: './regular-product-view.component.scss',
})
export class RegularProductViewComponent
  implements OnInit, OnDestroy, OnChanges
{
  @Input() product!: Product;
  @Input() quantity: number = 1;

  @Output() quantityIncrement = new EventEmitter<void>();
  @Output() quantityDecrement = new EventEmitter<void>();
  @Output() removeItem = new EventEmitter<void>();
  @Output() addToCart = new EventEmitter<{
    product: Product;
    comment?: string;
    customisationSelections?: Map<number, number[]>;
  }>();

  private store = inject(Store<AppState>);
  private dialog = inject(MatDialog);
  private productService = inject(ProductService);
  private destroy$ = new Subject<void>();
  private isInitialized = false;

  comment = signal('');
  selectedOptionIds: number[] = [];
  currentStep: ProductStep | null = null;
  stepOptions: ProductStepOption[] = [];
  totalPrice = 0;
  readonly placeholderImage = PRODUCT_PLACEHOLDER_IMAGE;

  // Customisation properties
  productCustomisations: Customisation[] = [];
  customisationSelections = new Map<number, number[]>(); // Map of customisation ID to selected option IDs

  // Observables for single-step products (kept for backward compatibility)
  steps$!: Observable<ProductStep[]>;
  configuration$!: Observable<any>;
  stepSelections$!: Observable<any>;
  isConfigurationComplete$!: Observable<boolean>;

  onIncrementQuantity(): void {
    this.quantityIncrement.emit();
  }

  onDecrementQuantity(): void {
    this.quantityDecrement.emit();
  }

  onRemoveItem(): void {
    this.removeItem.emit();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // If product changes, update customisations
    if (changes['product'] && this.product) {
      this.loadProductCustomisations();
    }
  }

  ngOnInit(): void {
    this.loadProductCustomisations();
    this.calculateTotalPrice();
  }

  private loadProductCustomisations(): void {
    if (this.product?.hasCustomisations) {
      // If customisations are already loaded, use them
      if (this.product.customisations) {
        this.productCustomisations = this.product.customisations;
        this.initializeCustomisationSelections();
      } else {
        // Load customisations for this product
        this.productService.getProductWithCustomisations(this.product.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe((productWithCustomisations) => {
            if (productWithCustomisations?.customisations) {
              this.productCustomisations = productWithCustomisations.customisations;
              this.initializeCustomisationSelections();
            }
          });
      }
    }
  }

  private initializeCustomisationSelections(): void {
    // Initialize selections map
    this.customisationSelections.clear();
    this.productCustomisations.forEach((customisation) => {
      this.customisationSelections.set(customisation.id, []);
    });
  }

  private initializeMultiStepObservables(): void {
    this.isInitialized = true;

    // Initialize multi-step observables with shareReplay to prevent multiple subscriptions
    this.steps$ = this.store
      .select(MultiStepProductSelectors.selectProductSteps)
      .pipe(
        distinctUntilChanged(
          (prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)
        ),
        shareReplay(1)
      );

    this.configuration$ = this.store
      .select(MultiStepProductSelectors.selectMultiStepConfiguration)
      .pipe(shareReplay(1));

    this.stepSelections$ = this.store
      .select(MultiStepProductSelectors.selectStepSelections)
      .pipe(
        distinctUntilChanged(
          (prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)
        ),
        shareReplay(1)
      );

    this.isConfigurationComplete$ = this.store
      .select(MultiStepProductSelectors.selectIsConfigurationComplete)
      .pipe(shareReplay(1));

    // Subscribe to steps to get the single step
    this.steps$
      .pipe(
        takeUntil(this.destroy$),
        filter((steps) => steps.length > 0)
      )
      .subscribe((steps) => {
        const nonSummarySteps = steps.filter(
          (step) => step.stepType !== 'summary'
        );
        if (nonSummarySteps.length === 1) {
          this.currentStep = nonSummarySteps[0];
          this.stepOptions = this.currentStep.options || [];
        }
      });

    // Subscribe to step selections to track current selections
    this.stepSelections$
      .pipe(takeUntil(this.destroy$))
      .subscribe((selections) => {
        const firstStepSelection = Object.values(selections)[0] as any;
        if (firstStepSelection) {
          this.selectedOptionIds = firstStepSelection.selectedOptionIds || [];
        }
      });

    // Calculate total price
    combineLatest([
      this.store
        .select(MultiStepProductSelectors.selectTotalPrice)
        .pipe(shareReplay(1)),
      this.configuration$,
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([price, config]) => {
        this.totalPrice =
          price || config?.baseProduct?.price || this.product.price;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.isInitialized = false;
  }

  onOptionCardClicked(event: { step: ProductStep; optionId: number }): void {
    const option = this.stepOptions.find((opt) => opt.id === event.optionId);
    if (!option || !option.isAvailable) return;

    if (event.step.stepType === 'single-select') {
      // For single select, replace the selection
      this.selectedOptionIds = [option.id];
    } else if (event.step.stepType === 'multi-select') {
      // For multi select, toggle the option
      const index = this.selectedOptionIds.indexOf(option.id);
      if (index > -1) {
        this.selectedOptionIds = this.selectedOptionIds.filter(
          (id) => id !== option.id
        );
      } else {
        // Check if we haven't exceeded max selections
        if (this.selectedOptionIds.length < event.step.maxSelections) {
          this.selectedOptionIds = [...this.selectedOptionIds, option.id];
        }
      }
    }

    // Update the store
    this.store.dispatch(
      MultiStepProductActions.updateStepSelection({
        stepId: event.step.id,
        selectedOptionIds: this.selectedOptionIds,
      })
    );
  }

  isOptionSelected(optionId: number): boolean {
    return this.selectedOptionIds.includes(optionId);
  }

  formatPrice(price: number): string {
    return `${(price || 0).toFixed(2)} €`;
  }

  getSelectionHint(): string {
    if (!this.currentStep) return '';

    if (this.currentStep.stepType === 'single-select') {
      return this.currentStep.isRequired
        ? 'Choisissez une option *'
        : 'Choisissez une option (optionnel)';
    } else if (this.currentStep.stepType === 'multi-select') {
      const min = this.currentStep.minSelections;
      const max = this.currentStep.maxSelections;
      const current = this.selectedOptionIds.length;

      if (min === max) {
        return `Choisissez exactement ${min} option${min > 1 ? 's' : ''}${
          this.currentStep.isRequired ? ' *' : ''
        } (${current}/${min})`;
      } else {
        return `Choisissez ${min} à ${max} options${
          this.currentStep.isRequired ? ' *' : ''
        } (${current}/${max})`;
      }
    }
    return '';
  }

  trackByOptionId(index: number, option: ProductStepOption): number {
    return option.id;
  }

  // Customisation methods
  onCustomisationOptionClicked(
    customisation: Customisation,
    option: CustomisationOption
  ): void {
    if (!option.is_available) return;

    const currentSelections =
      this.customisationSelections.get(customisation.id) || [];

    if (customisation.selection_type === 'single-select') {
      // For single select, replace the selection
      this.customisationSelections.set(customisation.id, [option.id]);
    } else if (customisation.selection_type === 'multi-select') {
      // For multi select, toggle the option
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

    this.calculateTotalPrice();
  }

  getSelectedOptionId(customisationId: number): number | null {
    const selections = this.customisationSelections.get(customisationId) || [];
    return selections.length > 0 ? selections[0] : null;
  }

  onRadioChange(
    customisation: Customisation,
    event: MatRadioChange
  ): void {
    const option = customisation.options?.find((o) => o.id === event.value);
    if (option && option.is_available) {
      this.customisationSelections.set(customisation.id, [event.value]);
      this.calculateTotalPrice();
    }
  }

  onCheckboxChange(
    customisation: Customisation,
    option: CustomisationOption,
    event: { checked: boolean }
  ): void {
    if (!option.is_available) return;

    const currentSelections =
      this.customisationSelections.get(customisation.id) || [];

    if (event.checked) {
      // Add option if not selected and haven't exceeded max selections
      if (
        !currentSelections.includes(option.id) &&
        currentSelections.length < customisation.max_selections
      ) {
        this.customisationSelections.set(customisation.id, [
          ...currentSelections,
          option.id,
        ]);
      }
    } else {
      // Remove option if selected
      const newSelections = currentSelections.filter((id) => id !== option.id);
      this.customisationSelections.set(customisation.id, newSelections);
    }

    this.calculateTotalPrice();
  }

  isCustomisationOptionSelected(
    customisationId: number,
    optionId: number
  ): boolean {
    const selections = this.customisationSelections.get(customisationId) || [];
    return selections.includes(optionId);
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

  private calculateTotalPrice(): void {
    // Start with base product price
    this.totalPrice = this.product.price || 0;

    // Add customisation price adjustments
    this.customisationSelections.forEach((optionIds, customisationId) => {
      const customisation = this.productCustomisations.find(
        (c) => c.id === customisationId
      );
      if (customisation && customisation.options) {
        optionIds.forEach((optionId) => {
          const option = customisation.options?.find((o) => o.id === optionId);
          if (option && option.price_adjustment) {
            this.totalPrice += option.price_adjustment;
          }
        });
      }
    });
  }

  onAddToCart(): void {
    this.addToCart.emit({
      product: this.product,
      comment: this.comment().trim() || undefined,
      customisationSelections: this.customisationSelections,
    });
  }

  onImageClicked(event: { imageUrl: string; imageName: string }): void {
    import('../../add-product-multi-step/image-zoom-dialog/image-zoom-dialog.component').then(
      ({ ImageZoomDialogComponent }) => {
        this.dialog.open(ImageZoomDialogComponent, {
          data: {
            imageUrl: event.imageUrl,
            imageName: event.imageName,
          },
          maxWidth: '95vw',
          maxHeight: '95vh',
          panelClass: 'image-zoom-dialog',
        });
      }
    );
  }
}
