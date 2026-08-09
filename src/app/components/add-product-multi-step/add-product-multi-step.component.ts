import {
  Component,
  OnInit,
  OnDestroy,
  computed,
  inject,
  signal,
  Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, Subject, combineLatest } from 'rxjs';
import {
  takeUntil,
  take,
  map,
  filter,
  distinctUntilChanged,
  startWith,
  skip,
} from 'rxjs/operators';
import { LayoutModule } from '@angular/cdk/layout';

// Material imports
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { MatListModule } from '@angular/material/list';
import { MatRippleModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog } from '@angular/material/dialog';

// Store imports
import * as MultiStepProductActions from '../../store/actions/multi-step-product.actions';
import * as MultiStepProductSelectors from '../../store/selectors/multi-step-product.selectors';
import { selectCartQuantityByProductId, selectCartQuantityMap } from '../../store/selectors/cart.selectors';
import { AppState } from '../../store/models/app.state';

// Models
import {
  ProductStep,
  ProductStepOption,
} from '../../models/multi-step-product.model';
import { VendorNavigationService } from '../../services/vendor-navigation.service';
import { ProductOptionCardComponent } from './product-option-card/product-option-card.component';
import { StepSectionComponent } from './step-section/step-section.component';
import { ImageZoomDialogComponent, ImageZoomDialogData } from './image-zoom-dialog/image-zoom-dialog.component';
import { CustomisationSelectionDialogComponent, CustomisationSelectionDialogData, CustomisationSelectionResult } from './customisation-selection-dialog/customisation-selection-dialog.component';
import { ProductService, Product } from '../../services/product.service';
import {
  UpsellService,
  findUnambiguousPreselection,
} from '../../services/upsell.service';
import { Customisation } from '../../models/customisation.interface';
import { VendorCurrencyPipe } from '../../shared/pipes/vendor-currency.pipe';
import { AddToCartBarComponent } from '../../shared/components/add-to-cart-bar/add-to-cart-bar.component';
import { ActivatedRoute } from '@angular/router';
import { LayoutService } from '../../services/layout.service';

// Interface to track customization selections per option
interface OptionCustomisationSelection {
  optionId: number;
  customisationSelections: Map<number, number[]>;
}

@Component({
  selector: 'app-add-product-multi-step',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatRadioModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatDividerModule,
    MatBadgeModule,
    MatListModule,
    MatRippleModule,
    MatInputModule,
    MatFormFieldModule,
    LayoutModule,
    StepSectionComponent,
    AddToCartBarComponent,
  ],
  templateUrl: './add-product-multi-step.component.html',
  styleUrls: ['./add-product-multi-step.component.scss'],
})
export class AddProductMultiStepComponent implements OnInit, OnDestroy {
  // Add input property to receive product ID from parent
  @Input() productId!: number;

  private destroy$ = new Subject<void>();
  private fb = inject(FormBuilder);
  private store = inject(Store<AppState>);
  private vendorNavigation = inject(VendorNavigationService);
  private dialog = inject(MatDialog);
  private productService = inject(ProductService);
  private upsellService = inject(UpsellService);
  private router = inject(ActivatedRoute);
  private layout = inject(LayoutService);

  // Observables
  configuration$ = this.store.select(
    MultiStepProductSelectors.selectMultiStepConfiguration
  );
  loading$ = this.store.select(
    MultiStepProductSelectors.selectMultiStepLoading
  );
  error$ = this.store.select(MultiStepProductSelectors.selectMultiStepError);
  baseProduct$ = this.store.select(MultiStepProductSelectors.selectBaseProduct);
  steps$ = this.store.select(MultiStepProductSelectors.selectProductSteps);
  currentStepIndex$ = this.store.select(
    MultiStepProductSelectors.selectCurrentStepIndex
  );
  currentStep$ = this.store.select(MultiStepProductSelectors.selectCurrentStep);
  currentStepSelection$ = this.store.select(
    MultiStepProductSelectors.selectCurrentStepSelection
  );
  stepSelections$ = this.store.select(
    MultiStepProductSelectors.selectStepSelections
  );
  canGoNext$ = this.store.select(MultiStepProductSelectors.selectCanGoNext);
  canGoPrevious$ = this.store.select(
    MultiStepProductSelectors.selectCanGoPrevious
  );
  isLastStep$ = this.store.select(MultiStepProductSelectors.selectIsLastStep);
  isConfigurationComplete$ = this.store.select(
    MultiStepProductSelectors.selectIsConfigurationComplete
  );
  totalPrice$ = this.store.select(MultiStepProductSelectors.selectTotalPrice);
  // Scroll shell (FR4d): every store step renders as a section.
  visibleSteps$ = this.steps$;

  activeStepId$ = combineLatest([this.steps$, this.currentStepIndex$]).pipe(
    map(([steps, index]) => (index !== null ? steps[index]?.id ?? null : null)),
    distinctUntilChanged()
  );

  // ------------------------------------------------------------------
  // Focus shell (user decision 2026-08-09): ONE step per page on every
  // form factor — centered title, no other steps visible. After the last
  // step, a review page lists the collapsed choices for editing.
  // ------------------------------------------------------------------
  private readonly stepsSig = toSignal(this.steps$, {
    initialValue: [] as ProductStep[],
  });
  private readonly stepIndexSig = toSignal(this.currentStepIndex$);
  private readonly selectionsSig = toSignal(this.stepSelections$);

  readonly focusStep = computed(() => {
    const steps = this.stepsSig();
    const index = this.stepIndexSig();
    return index != null ? (steps[index] ?? null) : null;
  });

  readonly focusStepNumber = computed(() => (this.stepIndexSig() ?? 0) + 1);
  readonly focusStepCount = computed(() => this.stepsSig().length);

  private readonly focusSelection = computed(() => {
    const step = this.focusStep();
    if (!step) return { count: 0, isValid: false };
    const selection = (this.selectionsSig() ?? {})[step.id];
    return {
      count: selection?.selectedOptionIds?.length ?? 0,
      isValid: selection?.isValid ?? false,
    };
  });

  /** "Continuer" for a satisfied multi-select below its max (single-select
   *  and maxed multi-select auto-advance; empty optional gets "Passer"). */
  readonly showContinue = computed(() => {
    const step = this.focusStep();
    const { count, isValid } = this.focusSelection();
    return (
      !!step &&
      step.stepType === 'multi-select' &&
      isValid &&
      count > 0 &&
      count < step.maxSelections
    );
  });

  readonly showSkip = computed(() => {
    const step = this.focusStep();
    const { count } = this.focusSelection();
    return !!step && !step.isRequired && count === 0;
  });

  continueToNext(): void {
    const step = this.focusStep();
    if (step) {
      this.advanceAfterSelection(step);
    }
  }


  // Local state
  stepForms: { [stepId: number]: FormGroup } = {};
  quantity: number = 1;
  comment = signal(''); // Comment for the menu
  /** Steps the customer has already seen active (edit-aware advance). */
  private offeredStepIds = new Set<number>();

  // Track customisation selections for each step option
  optionCustomisationSelections = new Map<string, Map<number, number[]>>(); // Key: `${stepId}-${optionId}`

  // Stock management
  baseProductStockQuantity: number | null = null;
  cartQuantityForBaseProduct: number = 0;
  private cartQuantityMap = new Map<number, number>();

  ngOnInit(): void {
    this.store.dispatch(
      MultiStepProductActions.initializeMultiStepProduct({
        productId: this.productId,
      })
    );

    // Setup reactive form handling
    this.setupStepForms();

    // Subscribe to base product stock info and cart quantity
    this.baseProduct$
      .pipe(
        takeUntil(this.destroy$),
        filter((product) => !!product)
      )
      .subscribe((product) => {
        this.baseProductStockQuantity = product.stockQuantity ?? null;

        this.store
          .select(selectCartQuantityByProductId(product.id))
          .pipe(takeUntil(this.destroy$))
          .subscribe((qty) => {
            this.cartQuantityForBaseProduct = qty;
          });
      });

    // Subscribe to cart quantity map for option stock checks
    this.store
      .select(selectCartQuantityMap)
      .pipe(takeUntil(this.destroy$))
      .subscribe((map) => {
        this.cartQuantityMap = map;
      });

    // Track which steps have been offered to the customer (drives the
    // edit-aware advance: an optional step is visited once, never forced
    // open again).
    this.activeStepId$
      .pipe(takeUntil(this.destroy$))
      .subscribe((stepId) => {
        if (stepId !== null) {
          this.offeredStepIds.add(stepId);
        }
      });

    // Auto-scroll the newly active section into view (skip initial load)
    this.activeStepId$
      .pipe(takeUntil(this.destroy$), skip(1))
      .subscribe((stepId) => {
        if (stepId === null) return;
        setTimeout(() => {
          // Anchor the whole focus page (progress + centered title), not
          // the section — otherwise the header scrolls out of view.
          document
            .querySelector('.focus-shell')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.optionCustomisationSelections.clear(); // Clear customisation selections
    this.store.dispatch(MultiStepProductActions.resetConfiguration());
  }

  private setupStepForms(): void {
    this.steps$
      .pipe(
        takeUntil(this.destroy$),
        filter((steps) => steps.length > 0)
      )
      .subscribe((steps) => {
        steps.forEach((step) => {
          this.createStepForm(step);
        });
        this.applyUpsellPreselect(steps);
      });
  }

  /**
   * Convert-to-menu entry (SPEC-UPSELL.md): when the customer accepted the
   * upgrade, preselect the option matching the replaced product — but only
   * when unambiguous (one match, single-select step). Patching the form
   * flows through the normal valueChanges -> store path.
   */
  private upsellPreselectApplied = false;

  private applyUpsellPreselect(steps: ProductStep[]): void {
    if (this.upsellPreselectApplied) return;
    this.upsellPreselectApplied = true;
    const productId = this.upsellService.consumePreselect(this.productId);
    if (productId == null) return;
    const match = findUnambiguousPreselection(steps, productId);
    if (!match) return;
    this.stepForms[match.stepId]?.patchValue({
      selectedOption: match.optionId.toString(),
    });
  }

  private createStepForm(step: ProductStep): void {
    const validators = step.isRequired ? [Validators.required] : [];

    if (step.stepType === 'single-select') {
      this.stepForms[step.id] = this.fb.group({
        selectedOption: ['', validators],
      });
    } else {
      // multi-select
      const optionsGroup = this.fb.group({});
      step.options.forEach((option) => {
        optionsGroup.addControl(option.id.toString(), this.fb.control(false));
      });

      this.stepForms[step.id] = this.fb.group({
        options: optionsGroup,
      });
    }

    // Subscribe to form changes
    this.stepForms[step.id].valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateStepSelection(step);
      });
  }

  private updateStepSelection(step: ProductStep): void {
    console.log('updateStepSelection', step);
    const form = this.stepForms[step.id];
    if (!form) return;

    let selectedOptionIds: number[] = [];

    if (step.stepType === 'single-select') {
      const selectedOption = form.get('selectedOption')?.value;
      if (selectedOption) {
        selectedOptionIds = [parseInt(selectedOption)];
      }
    } else {
      // multi-select
      const optionsControl = form.get('options');
      if (optionsControl) {
        Object.keys(optionsControl.value).forEach((optionIdStr) => {
          if (optionsControl.value[optionIdStr]) {
            selectedOptionIds.push(parseInt(optionIdStr));
          }
        });
      }
    }

    this.store.dispatch(
      MultiStepProductActions.updateStepSelection({
        stepId: step.id,
        selectedOptionIds,
      })
    );
  }

  /**
   * Post-selection navigation (user decision 2026-08-08): go to the next
   * INCOMPLETE step — never re-open steps that are already chosen. When a
   * customer edits a completed step, everything stays collapsed ("all
   * done") instead of re-walking the flow. Falls back to any earlier
   * incomplete step, else one past the end (nothing active).
   */
  advanceAfterSelection(fromStep: ProductStep): void {
    combineLatest([this.steps$, this.stepSelections$])
      .pipe(take(1))
      .subscribe(([steps, selections]) => {
        const fromIndex = steps.findIndex((s) => s.id === fromStep.id);
        const isIncomplete = (s: ProductStep) =>
          !(selections[s.id]?.isValid ?? false);
        // A valid-but-empty optional step still deserves ONE visit; once
        // offered, it is never forced open again.
        const needsVisit = (s: ProductStep) =>
          isIncomplete(s) ||
          (!s.isRequired &&
            (selections[s.id]?.selectedOptionIds?.length ?? 0) === 0 &&
            !this.offeredStepIds.has(s.id));

        const after = steps.findIndex((s, i) => i > fromIndex && needsVisit(s));
        const anywhere = steps.findIndex(
          (s, i) => i !== fromIndex && isIncomplete(s)
        );
        const target =
          after !== -1 ? after : anywhere !== -1 ? anywhere : steps.length;

        this.store.dispatch(
          MultiStepProductActions.setCurrentStep({ stepIndex: target })
        );
      });
  }

  goNext(): void {
    console.log('goNext');
    this.store.dispatch(MultiStepProductActions.nextStep());
  }

  goPrevious(): void {
    console.log('goPrevious');
    this.store.dispatch(MultiStepProductActions.previousStep());
  }

  // Add to cart
  addToCart(): void {
    console.log('addToCart');
    combineLatest([this.configuration$, this.isConfigurationComplete$])
      .pipe(
        take(1),
        filter(([config, isComplete]) => !!config && isComplete)
      )
      .subscribe(([configuration]) => {
        if (configuration) {
          // One dispatch carrying the quantity. (Dispatching N times raced
          // the effect's async metadata build and only the last add
          // survived — the x2/x3 basket bug.)
          this.store.dispatch(
            MultiStepProductActions.addMultiStepProductToCart({
              configuration,
              quantity: this.quantity,
              comment: this.comment().trim() || undefined,
              optionCustomisationSelections: this.optionCustomisationSelections,
            })
          );
const category = this.router.snapshot.paramMap.get('category');
if (category) {
          // Navigate back to products or show success message
          this.vendorNavigation.navigateWithVendor(['promotional-banner', category, 'products']);
        } else {
          this.vendorNavigation.navigateWithVendor(['promotional-banner', 'products']);
        }
        }
      });
  }

  // Quantity control methods
  incrementQuantity(): void {
    const stock = this.baseProductStockQuantity;
    if (stock != null && (this.quantity + this.cartQuantityForBaseProduct) >= stock) {
      return;
    }
    this.quantity++;
  }

  decrementQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  isStockLimitReached(): boolean {
    const stock = this.baseProductStockQuantity;
    return stock != null && (this.quantity + this.cartQuantityForBaseProduct) >= stock;
  }

  isOptionEffectivelyOutOfStock(option: ProductStepOption): boolean {
    if (option.optionType !== 'product' || option.productId == null) {
      return false;
    }
    if (option.stockQuantity == null) {
      return false;
    }
    const cartQty = this.cartQuantityMap.get(option.productId) || 0;
    return (option.stockQuantity - cartQty) <= 0;
  }

  removeItem(): void {
    this.quantity = 0;
    // Navigate back to products page
    this.vendorNavigation.navigateWithVendor(['promotional-banner', 'products']);
  }

  // Helper methods for template
  getStepForm(stepId: number): FormGroup | null {
    return this.stepForms[stepId] || null;
  }

  selectedIdsFor(
    stepId: number,
    selections: { [stepId: number]: { selectedOptionIds: number[] } } | null
  ): number[] {
    return selections?.[stepId]?.selectedOptionIds ?? [];
  }

  outOfStockIdsFor(step: ProductStep): number[] {
    return step.options
      .filter((option) => this.isOptionEffectivelyOutOfStock(option))
      .map((option) => option.id);
  }

  activateStep(stepIndex: number): void {
    this.store.dispatch(MultiStepProductActions.setCurrentStep({ stepIndex }));
  }

  /** Disabled add-to-cart tap → jump to the first incomplete step (FR4d). */
  goToFirstIncompleteStep(): void {
    combineLatest([this.steps$, this.stepSelections$])
      .pipe(take(1))
      .subscribe(([steps, selections]) => {
        const index = steps.findIndex(
          (step) => !(selections[step.id]?.isValid ?? false)
        );
        if (index >= 0) {
          this.activateStep(index);
        }
      });
  }

  getAvailableOptions(step: ProductStep): ProductStepOption[] {
    return step.options.filter((option) => option.isAvailable);
  }

  // Card selection methods
  async onSingleSelectCard(step: ProductStep, optionId: number): Promise<void> {
    const option = step.options.find(opt => opt.id === optionId);
    if (!option) return;

    // Check if this is a product option that might have customisations
    if (option.optionType === 'product' && option.productId) {
      // Check if the option is already selected
      const form = this.stepForms[step.id];
      const currentlySelected = form?.get('selectedOption')?.value === optionId.toString();
      
      // Fetch product details to check for customisations
      const hasCustomisations = await this.checkAndHandleCustomisations(step, option, currentlySelected);
      
      // If customisation dialog was cancelled, don't select the option
      if (hasCustomisations === false) {
        return;
      }
    }

    const form = this.stepForms[step.id];
    if (form) {
      form.get('selectedOption')?.setValue(optionId.toString());
      
      // Advance after a brief delay for visual feedback (FR4d edit rule:
      // never re-open steps that are already chosen).
      setTimeout(() => {
        this.advanceAfterSelection(step);
      }, 300);
    }
  }

  async onMultiSelectCard(step: ProductStep, optionId: number): Promise<void> {
    const option = step.options.find(opt => opt.id === optionId);
    if (!option) return;

    const form = this.stepForms[step.id];
    if (!form) return;

    const optionsControl = form.get('options');
    if (!optionsControl) return;

    const currentValue = optionsControl.get(optionId.toString())?.value;

    // If selecting (not deselecting) and it's a product with customisations
    if (!currentValue && option.optionType === 'product' && option.productId) {
      const hasCustomisations = await this.checkAndHandleCustomisations(step, option, currentValue);
      
      // If customisation dialog was cancelled, don't select the option
      if (hasCustomisations === false) {
        return;
      }
    }

    // If deselecting, clear customisation selections
    if (currentValue) {
      const key = this.getCustomisationKey(step.id, optionId);
      this.optionCustomisationSelections.delete(key);
    }

    optionsControl.get(optionId.toString())?.setValue(!currentValue);
    
    // Count selected options after toggle
    const selectedCount = Object.keys(optionsControl.value).filter(
      (key) => optionsControl.value[key] === true
    ).length;
    
    // If max selections reached, auto-advance (same edit-aware rule)
    if (step.maxSelections && selectedCount === step.maxSelections) {
      setTimeout(() => {
        this.advanceAfterSelection(step);
      }, 300);
    }
  }

  // Handle option click from child component
  onOptionClicked(event: { step: ProductStep; optionId: number }): void {
    const { step, optionId } = event;
    if (step.stepType === 'single-select') {
      this.onSingleSelectCard(step, optionId);
    } else if (step.stepType === 'multi-select') {
      this.onMultiSelectCard(step, optionId);
    }
  }

  isOptionSelected(step: ProductStep, optionId: number): boolean {
    const form = this.stepForms[step.id];
    if (!form) return false;

    if (step.stepType === 'single-select') {
      return form.get('selectedOption')?.value === optionId.toString();
    } else {
      return form.get('options')?.get(optionId.toString())?.value || false;
    }
  }

  // Open image zoom dialog
  openImageZoom(imageUrl: string, imageName: string): void {
    this.dialog.open(ImageZoomDialogComponent, {
      data: { imageUrl, imageName } as ImageZoomDialogData,
      maxWidth: '90vw',
      maxHeight: '90vh',
      panelClass: 'image-zoom-dialog-panel',
    });
  }

  // Handle image click from child component
  onImageClicked(event: { imageUrl: string; imageName: string }): void {
    this.openImageZoom(event.imageUrl, event.imageName);
  }


  // Customisation handling methods
  private getCustomisationKey(stepId: number, optionId: number): string {
    return `${stepId}-${optionId}`;
  }

  private async checkAndHandleCustomisations(
    step: ProductStep,
    option: ProductStepOption,
    isCurrentlySelected: boolean
  ): Promise<boolean | null> {
    if (!option.productId) return null;

    try {
      // Fetch product details with customisations
      const product = await this.productService.getProductWithCustomisations(option.productId).toPromise();
      
      if (!product) return null;

      // Check if product has customisations
      if (product.hasCustomisations && product.customisations && product.customisations.length > 0) {
        // Get existing selections if option is already selected
        const key = this.getCustomisationKey(step.id, option.id);
        const existingSelections = this.optionCustomisationSelections.get(key);

        // Open customisation dialog
        const dialogRef = this.dialog.open(CustomisationSelectionDialogComponent, {
          data: {
            product: option,
            customisations: product.customisations,
            existingSelections: existingSelections,
          } as CustomisationSelectionDialogData,
          width: '600px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          disableClose: false,
        });

        const result = await dialogRef.afterClosed().toPromise();

        if (result) {
          // User validated - store the selections
          this.optionCustomisationSelections.set(key, result.selections);
          return true;
        } else {
          // User cancelled - unselect the option if it was newly selected
          if (!isCurrentlySelected) {
            // Unselect the option
            if (step.stepType === 'single-select') {
              const form = this.stepForms[step.id];
              form?.get('selectedOption')?.setValue('');
            } else if (step.stepType === 'multi-select') {
              const form = this.stepForms[step.id];
              const optionsControl = form?.get('options');
              optionsControl?.get(option.id.toString())?.setValue(false);
            }
          }
          return false;
        }
      }

      return null; // No customisations
    } catch (error) {
      console.error('Error fetching product details:', error);
      return null;
    }
  }
}
