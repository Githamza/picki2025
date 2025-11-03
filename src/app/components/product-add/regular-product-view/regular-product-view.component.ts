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
import { FormsModule } from '@angular/forms';
import { ProductOptionCardComponent } from '../../add-product-multi-step/product-option-card/product-option-card.component';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { Observable, Subject, combineLatest } from 'rxjs';
import {
  takeUntil,
  filter,
  shareReplay,
  distinctUntilChanged,
} from 'rxjs/operators';
import { Product } from '../../../services/product.service';
import * as MultiStepProductActions from '../../../store/actions/multi-step-product.actions';
import * as MultiStepProductSelectors from '../../../store/selectors/multi-step-product.selectors';
import { AppState } from '../../../store/models/app.state';
import {
  ProductStep,
  ProductStepOption,
} from '../../../models/multi-step-product.model';
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
    FormsModule,
    ProductOptionCardComponent,
  ],
  templateUrl: './regular-product-view.component.html',
  styleUrl: './regular-product-view.component.scss',
})
export class RegularProductViewComponent
  implements OnInit, OnDestroy, OnChanges
{
  @Input() product!: Product;
  @Input() quantity: number = 1;
  @Input() isSingleStepProduct: boolean = false;

  @Output() quantityIncrement = new EventEmitter<void>();
  @Output() quantityDecrement = new EventEmitter<void>();
  @Output() removeItem = new EventEmitter<void>();
  @Output() addToCart = new EventEmitter<{
    product: Product;
    comment?: string;
  }>();

  private store = inject(Store<AppState>);
  private dialog = inject(MatDialog);
  private destroy$ = new Subject<void>();
  private isInitialized = false;

  comment = signal('');
  selectedOptionIds: number[] = [];
  currentStep: ProductStep | null = null;
  stepOptions: ProductStepOption[] = [];
  totalPrice = 0;
  readonly placeholderImage = PRODUCT_PLACEHOLDER_IMAGE;

  // Observables for single-step products
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
    // If isSingleStepProduct input changes, reinitialize if needed
    if (
      changes['isSingleStepProduct'] &&
      this.isSingleStepProduct &&
      this.product?.isMultiStep &&
      !this.isInitialized
    ) {
      this.initializeMultiStepObservables();
    }
  }

  ngOnInit(): void {
    if (
      this.isSingleStepProduct &&
      this.product.isMultiStep &&
      !this.isInitialized
    ) {
      this.initializeMultiStepObservables();
    }
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

  onAddToCart(): void {
    this.addToCart.emit({
      product: this.product,
      comment: this.comment().trim() || undefined,
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
