import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
} from '@angular/forms';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CustomisationService } from '../../../services/customisation.service';
import { ProductService, Product } from '../../../services/product.service';
import {
  Customisation,
  CustomisationFormData,
  CustomisationOptionFormData,
} from '../../../models/customisation.interface';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { VendorCurrencyPipe } from '../../../shared/pipes/vendor-currency.pipe';
import { VendorCurrencySymbolPipe } from '../../../shared/pipes/vendor-currency-symbol.pipe';

export interface DialogData {
  customisation?: Customisation;
  vendorId: string;
}

@Component({
  selector: 'app-customisation-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatCardModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    VendorCurrencyPipe,
    VendorCurrencySymbolPipe,
  ],
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>
        <mat-icon>{{ data.customisation ? 'edit' : 'add' }}</mat-icon>
        {{ data.customisation ? 'Modifier la customisation' : 'Créer une customisation' }}
      </h2>
      <button mat-icon-button mat-dialog-close>
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <div mat-dialog-content class="dialog-content">
      <form [formGroup]="customisationForm" class="customisation-form">
        <!-- Name -->
        <mat-form-field appearance="fill">
          <mat-label>Nom de la customisation</mat-label>
          <input
            matInput
            formControlName="name"
            placeholder="Ex: Choix de cordiander"
          />
          @if (customisationForm.get('name')?.hasError('required')) {
          <mat-error>Le nom est requis</mat-error>
          }
        </mat-form-field>

        <!-- Description -->
        <mat-form-field appearance="fill">
          <mat-label>Description</mat-label>
          <textarea
            matInput
            formControlName="description"
            rows="2"
            placeholder="Description de la customisation"
          ></textarea>
        </mat-form-field>

        <!-- Selection Type -->
        <mat-form-field appearance="fill">
          <mat-label>Type de sélection</mat-label>
          <mat-select formControlName="selection_type">
            <mat-option value="single-select">Choix unique</mat-option>
            <mat-option value="multi-select">Choix multiple</mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Min/Max Selections (shown for multi-select) -->
        @if (customisationForm.get('selection_type')?.value === 'multi-select') {
        <div class="selection-range">
          <mat-form-field appearance="fill">
            <mat-label>Sélections minimales</mat-label>
            <input
              matInput
              type="number"
              formControlName="min_selections"
              placeholder="0"
              min="0"
            />
          </mat-form-field>

          <mat-form-field appearance="fill">
            <mat-label>Sélections maximales</mat-label>
            <input
              matInput
              type="number"
              formControlName="max_selections"
              placeholder="1"
              min="1"
            />
          </mat-form-field>
        </div>
        }

        <!-- Display Order -->
        <mat-form-field appearance="fill">
          <mat-label>Ordre d'affichage</mat-label>
          <input
            matInput
            type="number"
            formControlName="display_order"
            placeholder="0"
            min="0"
            step="10"
          />
          <mat-hint>Ordre d'affichage (0 = premier)</mat-hint>
        </mat-form-field>

        <!-- Toggles -->
        <div class="toggle-section">
          <mat-slide-toggle formControlName="is_required">
            Customisation requise
          </mat-slide-toggle>

          <mat-slide-toggle formControlName="is_available">
            Customisation disponible
          </mat-slide-toggle>
        </div>

        <!-- Options Section -->
        <div class="options-section">
          <div class="options-header">
            <h3>Options ({{ options.length }}/{{ customisationForm.get('max_selections')?.value || 0 }})</h3>
            <button 
              mat-icon-button 
              type="button"
              (click)="addOption()"
              [disabled]="options.length >= (customisationForm.get('max_selections')?.value || 1)"
            >
              <mat-icon>add_circle</mat-icon>
            </button>
          </div>

          <div class="options-list" formArrayName="options">
            @for (option of options.controls; track $index) {
            <mat-card class="option-card" [formGroupName]="$index">
              <mat-card-content>
                <div class="option-header">
                  <h4>Option {{ $index + 1 }}</h4>
                  <button 
                    mat-icon-button 
                    type="button"
                    color="warn"
                    (click)="removeOption($index)"
                  >
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>

                <div class="option-fields">
                  <!-- Option Name -->
                  <mat-form-field appearance="fill" class="full-width">
                    <mat-label>Nom de l'option</mat-label>
                    <input
                      matInput
                      formControlName="name"
                      placeholder="Ex: Coriandre"
                    />
                    @if (option.get('name')?.hasError('required')) {
                    <mat-error>Le nom est requis</mat-error>
                    }
                  </mat-form-field>

                  <!-- Price Adjustment -->
                  <mat-form-field appearance="fill">
                    <mat-label>Prix supplémentaire</mat-label>
                    <input
                      matInput
                      type="number"
                      formControlName="price_adjustment"
                      placeholder="0.00"
                      step="0.01"
                    />
                    <span matTextPrefix>{{ null | vendorCurrencySymbol }}&nbsp;</span>
                    <mat-hint>0 si gratuit</mat-hint>
                  </mat-form-field>

                  <!-- Availability -->
                  <mat-slide-toggle formControlName="is_available">
                    Disponible
                  </mat-slide-toggle>
                </div>
              </mat-card-content>
            </mat-card>
            }

            @if (options.length === 0) {
            <div class="empty-options">
              <mat-icon>tune</mat-icon>
              <p>Aucune option définie</p>
              <p class="hint">Ajustez le nombre maximum de sélections pour ajouter des options</p>
            </div>
            }
          </div>
        </div>

        <!-- Product Assignment Section -->
        @if (data.customisation) {
        <div class="products-section">
          <div class="products-header">
            <h3>Produits assignés ({{ selectedProductIds.size }})</h3>
          </div>

          <!-- Search Box -->
          <mat-form-field appearance="fill" class="full-width">
            <mat-label>Rechercher un produit</mat-label>
            <input
              matInput
              [formControl]="searchControl"
              placeholder="Nom du produit..."
            />
            <mat-icon matPrefix>search</mat-icon>
          </mat-form-field>

          <!-- Products List -->
          @if (loadingProducts) {
          <div class="loading-container">
            <mat-spinner diameter="40"></mat-spinner>
            <p>Chargement des produits...</p>
          </div>
          } @else {
          <div class="products-list">
            @for (product of filteredProducts; track product.id) {
            <mat-card class="product-item">
              <mat-checkbox
                [checked]="selectedProductIds.has(product.id)"
                (change)="toggleProductSelection(product.id)"
              >
                <div class="product-info">
                  @if (product.imageUrl) {
                  <img [src]="product.imageUrl" [alt]="product.name" class="product-image" />
                  } @else {
                  <div class="product-image-placeholder">
                    <mat-icon>image</mat-icon>
                  </div>
                  }
                  <div class="product-details">
                    <span class="product-name">{{ product.name }}</span>
                    <span class="product-price">{{ product.price | vendorCurrency }}</span>
                  </div>
                </div>
              </mat-checkbox>
            </mat-card>
            }

            @if (filteredProducts.length === 0) {
            <div class="empty-products">
              <mat-icon>inventory_2</mat-icon>
              <p>Aucun produit trouvé</p>
            </div>
            }
          </div>
          }
        </div>
        }
      </form>
    </div>

    <div mat-dialog-actions class="dialog-actions">
      <button mat-button mat-dialog-close>Annuler</button>
      <button
        matButton="filled"
        color="primary"
        (click)="saveCustomisation()"
        [disabled]="customisationForm.invalid || saving"
      >
        @if (saving) {
        <mat-icon>hourglass_empty</mat-icon>
        } @else {
        <mat-icon>{{ data.customisation ? 'save' : 'add' }}</mat-icon>
        }
        {{ data.customisation ? 'Modifier' : 'Créer' }}
      </button>
    </div>
  `,
  styles: [
    `
      .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }

      .dialog-header h2 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 1.25rem;
        font-weight: 500;
      }

      .dialog-content {
        min-width: 500px;
        overflow-y: auto;
      }

      .customisation-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .selection-range {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      .toggle-section {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        background: var(--mat-sys-surface-variant);
        border-radius: 8px;
      }

      .options-section {
        margin-top: 8px;
      }

      .options-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }

      .options-header h3 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 500;
        color: var(--mat-sys-on-surface);
      }

      .options-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-height: 400px;
        overflow-y: auto;
      }

      .option-card {
        border-left: 3px solid var(--mat-sys-primary);
      }

      .option-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .option-header h4 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 500;
        color: var(--mat-sys-on-surface-variant);
      }

      .option-fields {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .full-width {
        width: 100%;
      }

      .empty-options {
        text-align: center;
        padding: 48px 24px;
        color: var(--mat-sys-on-surface-variant);
      }

      .empty-options mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--mat-sys-outline);
        margin-bottom: 16px;
      }

      .empty-options p {
        margin: 8px 0;
      }

      .empty-options .hint {
        font-size: 0.875rem;
        color: var(--mat-sys-outline);
      }

      .dialog-actions {
        margin-top: 24px;
        gap: 8px;
      }

      .products-section {
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid var(--mat-sys-outline-variant);
      }

      .products-header {
        margin-bottom: 16px;
      }

      .products-header h3 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 500;
        color: var(--mat-sys-on-surface);
      }

      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        color: var(--mat-sys-on-surface-variant);
      }

      .loading-container p {
        margin-top: 16px;
      }

      .products-list {
        max-height: 400px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .product-item {
        padding: 12px;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .product-item:hover {
        background-color: var(--mat-sys-surface-variant);
      }

      .product-info {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
      }

      .product-image,
      .product-image-placeholder {
        width: 48px;
        height: 48px;
        border-radius: 4px;
        object-fit: cover;
        flex-shrink: 0;
      }

      .product-image-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--mat-sys-surface-variant);
        color: var(--mat-sys-on-surface-variant);
      }

      .product-details {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
      }

      .product-name {
        font-weight: 500;
        color: var(--mat-sys-on-surface);
      }

      .product-price {
        font-size: 0.875rem;
        color: var(--mat-sys-on-surface-variant);
      }

      .empty-products {
        text-align: center;
        padding: 48px 24px;
        color: var(--mat-sys-on-surface-variant);
      }

      .empty-products mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--mat-sys-outline);
        margin-bottom: 16px;
      }

      .empty-products p {
        margin: 8px 0;
      }

      @media (max-width: 600px) {
        .dialog-content {
          min-width: unset;
          width: 100%;
        }

        .selection-range {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class CustomisationEditDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private customisationService = inject(CustomisationService);
  private productService = inject(ProductService);
  private snackBar = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<CustomisationEditDialogComponent>);

  customisationForm: FormGroup;
  saving = false;

  // Product assignment
  allProducts: Product[] = [];
  filteredProducts: Product[] = [];
  selectedProductIds = new Set<number>();
  loadingProducts = false;
  searchControl = this.fb.control('');

  constructor(@Inject(MAT_DIALOG_DATA) public data: DialogData) {
    this.customisationForm = this.createForm();
    this.setupMaxSelectionsListener();
    this.setupSearchListener();
  }

  ngOnInit() {
    if (this.data.customisation) {
      this.populateForm(this.data.customisation);
      this.loadProducts();
    }
  }

  get options(): FormArray {
    return this.customisationForm.get('options') as FormArray;
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required]],
      description: [''],
      selection_type: ['single-select', [Validators.required]],
      is_required: [false],
      min_selections: [0, [Validators.min(0)]],
      max_selections: [1, [Validators.min(1)]],
      display_order: [0, [Validators.min(0)]],
      is_available: [true],
      options: this.fb.array([]),
    });
  }

  private createOptionGroup(option?: any): FormGroup {
    return this.fb.group({
      name: [option?.name || '', [Validators.required]],
      price_adjustment: [option?.price_adjustment || 0],
      is_available: [option?.is_available ?? true],
      display_order: [option?.display_order || 0],
      option_type: ['component'],
      product_id: [null],
      description: [option?.description || null],
      image_url: [option?.image_url || null],
    });
  }

  private setupMaxSelectionsListener(): void {
    this.customisationForm.get('max_selections')?.valueChanges.subscribe((maxValue) => {
      const currentOptionsCount = this.options.length;
      const targetCount = maxValue || 1;

      if (targetCount > currentOptionsCount) {
        // Add options
        const toAdd = targetCount - currentOptionsCount;
        for (let i = 0; i < toAdd; i++) {
          this.options.push(this.createOptionGroup());
        }
      } else if (targetCount < currentOptionsCount) {
        // Remove options from the end
        const toRemove = currentOptionsCount - targetCount;
        for (let i = 0; i < toRemove; i++) {
          this.options.removeAt(this.options.length - 1);
        }
      }
    });
  }

  private setupSearchListener(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((searchTerm) => {
        this.filterProducts(searchTerm || '');
      });
  }

  private loadProducts(): void {
    this.loadingProducts = true;
    this.productService.getAllProducts(this.data.vendorId).subscribe({
      next: (products) => {
        this.allProducts = products;
        this.filteredProducts = products;
        this.loadAssignedProducts();
      },
      error: (error) => {
        console.error('Error loading products:', error);
        this.snackBar.open('Erreur lors du chargement des produits', 'Fermer', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
        this.loadingProducts = false;
      },
    });
  }

  private loadAssignedProducts(): void {
    if (!this.data.customisation) {
      this.loadingProducts = false;
      return;
    }

    this.customisationService
      .getCustomisationProducts(this.data.customisation.id)
      .subscribe({
        next: (productIds) => {
          this.selectedProductIds = new Set(productIds);
          this.loadingProducts = false;
        },
        error: (error) => {
          console.error('Error loading assigned products:', error);
          this.loadingProducts = false;
        },
      });
  }

  private filterProducts(searchTerm: string): void {
    if (!searchTerm.trim()) {
      this.filteredProducts = this.allProducts;
      return;
    }

    const term = searchTerm.toLowerCase();
    this.filteredProducts = this.allProducts.filter((product) =>
      product.name.toLowerCase().includes(term)
    );
  }

  toggleProductSelection(productId: number): void {
    if (this.selectedProductIds.has(productId)) {
      this.selectedProductIds.delete(productId);
    } else {
      this.selectedProductIds.add(productId);
    }
  }

  addOption(): void {
    const maxSelections = this.customisationForm.get('max_selections')?.value || 1;
    if (this.options.length < maxSelections) {
      this.options.push(this.createOptionGroup());
    }
  }

  removeOption(index: number): void {
    this.options.removeAt(index);
  }

  private populateForm(customisation: Customisation) {
    // Temporarily disable the max_selections listener to avoid triggering during population
    const maxSelectionsControl = this.customisationForm.get('max_selections');
    const previousValue = maxSelectionsControl?.value;

    // Clear existing options first
    this.options.clear();

    // Patch form values (this will trigger the listener)
    this.customisationForm.patchValue({
      name: customisation.name,
      description: customisation.description,
      selection_type: customisation.selection_type,
      is_required: customisation.is_required,
      min_selections: customisation.min_selections,
      max_selections: customisation.max_selections,
      display_order: customisation.display_order,
      is_available: customisation.is_available,
    }, { emitEvent: false }); // Disable events to prevent listener from firing

    // Add existing options
    if (customisation.options && customisation.options.length > 0) {
      customisation.options.forEach((option) => {
        this.options.push(this.createOptionGroup(option));
      });
    }

    // Manually trigger the control to emit its value (now that options are populated)
    maxSelectionsControl?.updateValueAndValidity();
  }

  saveCustomisation() {
    if (this.customisationForm.invalid) {
      this.customisationForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    const formValue = this.customisationForm.value;
    const customisationData: CustomisationFormData = {
      name: formValue.name,
      description: formValue.description,
      selection_type: formValue.selection_type,
      is_required: formValue.is_required,
      min_selections: formValue.min_selections,
      max_selections: formValue.max_selections,
      display_order: formValue.display_order,
      is_available: formValue.is_available,
    };

    const operation = this.data.customisation
      ? this.customisationService.updateCustomisation(
          this.data.customisation.id,
          customisationData
        )
      : this.customisationService.createCustomisation(
          this.data.vendorId,
          customisationData
        );

    operation.subscribe({
      next: (customisation) => {
        // Now save options if any
        const optionsData = formValue.options as CustomisationOptionFormData[];
        if (optionsData && optionsData.length > 0) {
          this.saveOptions(customisation.id, optionsData);
        } else {
          // Save product assignments
          this.saveProductAssignments(customisation.id);
        }
      },
      error: (error) => {
        console.error('Error saving customisation:', error);
        this.snackBar.open('Erreur lors de la sauvegarde', 'Fermer', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
        this.saving = false;
      },
    });
  }

  private saveProductAssignments(customisationId: number): void {
    const productIds = Array.from(this.selectedProductIds);
    this.customisationService
      .assignProductsToCustomisation(customisationId, productIds)
      .subscribe({
        next: () => {
          this.snackBar.open('Customisation sauvegardée avec succès', 'Fermer', {
            duration: 3000,
          });
          this.customisationService.getCustomisation(customisationId).subscribe({
            next: (customisation) => {
              this.dialogRef.close(customisation);
            },
            error: () => {
              this.dialogRef.close({ id: customisationId });
            },
          });
        },
        error: (error) => {
          console.error('Error saving product assignments:', error);
          this.snackBar.open('Erreur lors de l\'assignation des produits', 'Fermer', {
            duration: 5000,
            panelClass: ['error-snackbar'],
          });
          this.saving = false;
        },
      });
  }

  private saveOptions(customisationId: number, optionsData: CustomisationOptionFormData[]): void {
    // If editing, first delete existing options then add new ones
    // For simplicity, we'll just add/update options
    const optionPromises = optionsData.map((optionData, index) => {
      const optionPayload = {
        ...optionData,
        display_order: index,
      };

      // Check if this is an existing option or a new one
      const existingOption = this.data.customisation?.options?.[index];
      if (existingOption) {
        return this.customisationService.updateOption(existingOption.id, optionPayload).toPromise();
      } else {
        return this.customisationService.addOption(customisationId, optionPayload).toPromise();
      }
    });

    Promise.all(optionPromises)
      .then(() => {
        // After saving options, save product assignments
        this.saveProductAssignments(customisationId);
      })
      .catch((error) => {
        console.error('Error saving options:', error);
        this.snackBar.open('Erreur lors de la sauvegarde des options', 'Fermer', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
        this.saving = false;
      });
  }
}

