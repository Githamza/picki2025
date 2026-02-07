import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  ReactiveFormsModule,
  FormsModule,
  FormBuilder,
  FormGroup,
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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ProductAdminService } from '../../../services/product-admin.service';
import { CustomisationService } from '../../../services/customisation.service';
import {
  ProductAdmin,
  Category,
  ProductFormData,
} from '../../../models/product-admin.interface';
import { Customisation } from '../../../models/customisation.interface';
import { ImageUploadComponent } from '../../../shared/components';
import { VendorCurrencySymbolPipe } from '../../../shared/pipes/vendor-currency-symbol.pipe';
import { VendorService } from '../../../services/vendor.service';

export interface DialogData {
  product?: ProductAdmin;
  vendorId: string;
  isAccessory?: boolean;
}

@Component({
  selector: 'app-product-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatCheckboxModule,
    ImageUploadComponent,
    VendorCurrencySymbolPipe,
  ],
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>
        <mat-icon>{{ data.product ? 'edit' : 'add' }}</mat-icon>
        {{ getDialogTitle() }}
      </h2>
      <button mat-icon-button mat-dialog-close>
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <div mat-dialog-content class="dialog-content">
      <form [formGroup]="productForm" class="product-form">
        <!-- 1. Product Name -->
        <mat-form-field appearance="fill">
          <mat-label>{{ getNameLabel() }}</mat-label>
          <input
            matInput
            formControlName="name"
            [placeholder]="getNamePlaceholder()"
          />
          @if (productForm.get('name')?.hasError('required')) {
          <mat-error>Le nom est requis</mat-error>
          }
        </mat-form-field>

        <!-- 2. Price -->
        <mat-form-field appearance="fill">
          <mat-label>Prix</mat-label>
          <input
            matInput
            type="number"
            formControlName="price"
            placeholder="0.00"
            step="0.50"
            min="0"
          />
          <span matTextPrefix>{{ null | vendorCurrencySymbol }}&nbsp;</span>
          @if (isAccessoryMode) {
            <mat-hint>0 pour un accessoire gratuit</mat-hint>
          }
          @if (productForm.get('price')?.hasError('required')) {
          <mat-error>Le prix est requis</mat-error>
          } @if (productForm.get('price')?.hasError('min')) {
          <mat-error>Le prix doit être positif</mat-error>
          }
        </mat-form-field>

        <!-- TVA Rate -->
        <mat-form-field appearance="fill">
          <mat-label>Taux de TVA</mat-label>
          <mat-select formControlName="tva_rate">
            <mat-option [value]="5.5">5,5% </mat-option>
            <mat-option [value]="10">10% </mat-option>
            <mat-option [value]="20">20%</mat-option>
          </mat-select>
        </mat-form-field>

        @if (isAccessoryMode) {
          <!-- Icon/Emoji for accessory -->
          <mat-form-field appearance="fill">
            <mat-label>Icône (emoji)</mat-label>
            <input
              matInput
              formControlName="icon_emoji"
              placeholder="🍴"
            />
            <mat-hint>Un emoji pour représenter l'accessoire</mat-hint>
          </mat-form-field>

          <!-- Applicable Order Types (only if vendor has 2+ types) -->
          @if (vendorOrderTypes.length > 1) {
            <mat-form-field appearance="fill">
              <mat-label>Types de commande applicables</mat-label>
              <mat-select formControlName="applicable_order_types" multiple>
                @for (type of vendorOrderTypes; track type) {
                  <mat-option [value]="type">{{ getOrderTypeLabel(type) }}</mat-option>
                }
              </mat-select>
              <mat-hint>Sélectionnez pour quels types de commande cet accessoire est proposé</mat-hint>
            </mat-form-field>
          }

          <!-- Stock Quantity -->
          <mat-form-field appearance="fill">
            <mat-label>Quantité en stock (optionnel)</mat-label>
            <input
              matInput
              type="number"
              formControlName="stock_quantity"
              placeholder="Illimité si vide"
              min="0"
            />
          </mat-form-field>

          <!-- Max Quantity Per Order -->
          <mat-form-field appearance="fill">
            <mat-label>Quantité max par commande (optionnel)</mat-label>
            <input
              matInput
              type="number"
              formControlName="max_quantity_per_order"
              placeholder="Illimité si vide"
              min="1"
            />
            <mat-hint>Limite le nombre de cet accessoire par commande</mat-hint>
          </mat-form-field>

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
            <mat-hint>Ordre d'affichage parmi les accessoires (0 = premier)</mat-hint>
          </mat-form-field>

          <!-- Availability toggle -->
          <div class="toggle-section">
            <mat-slide-toggle formControlName="is_available">
              Accessoire disponible
            </mat-slide-toggle>
          </div>
        } @else {
          <!-- Regular product fields -->

          <!-- 3. Category -->
          <mat-form-field appearance="fill">
            <mat-label>Catégorie</mat-label>
            <mat-select formControlName="category_id">
              @for (category of categories; track category.id) {
              <mat-option [value]="category.id">{{ category.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <!-- Stock Quantity -->
          <mat-form-field appearance="fill">
            <mat-label>Quantité en stock (optionnel)</mat-label>
            <input
              matInput
              type="number"
              formControlName="stock_quantity"
              placeholder="Illimité si vide"
              min="0"
            />
          </mat-form-field>

          <!-- 4. Image URL -->
          <app-image-upload
            formControlName="image_url"
            label="URL de l'image"
            placeholder="https://..."
          ></app-image-upload>

          <!-- 5. Short Description -->
          <mat-form-field appearance="fill">
            <mat-label>Description</mat-label>
            <input
              matInput
              formControlName="short_description"
              placeholder="Description courte"
            />
          </mat-form-field>

          <!-- More Options Toggle -->
          <button
            type="button"
            mat-button
            class="more-options-button"
            (click)="showMoreOptions = !showMoreOptions"
          >
            <mat-icon>{{ showMoreOptions ? 'expand_less' : 'expand_more' }}</mat-icon>
            Plus d'options (facultatif)
          </button>

          <!-- Optional Fields Section -->
          @if (showMoreOptions) {
          <div class="more-options-section">
            <!-- Long Description -->
            <mat-form-field appearance="fill">
              <mat-label>Description détaillée</mat-label>
              <textarea
                matInput
                formControlName="long_description"
                rows="3"
                placeholder="Description détaillée"
              ></textarea>
            </mat-form-field>

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
              <mat-hint>Ordre d'affichage dans la catégorie (0 = premier)</mat-hint>
            </mat-form-field>

            <!-- Customisations -->
            <mat-form-field appearance="fill">
              <mat-label>Customisations</mat-label>
              <mat-select formControlName="customisations" multiple (selectionChange)="onCustomisationSelectionChange($event)">
                @for (customisation of availableCustomisations; track customisation.id) {
                  <mat-option [value]="customisation.id">
                    {{ customisation.name }}
                    <span class="option-hint"> ({{ customisation.options?.length || 0 }} options)</span>
                  </mat-option>
                }
                <mat-option [value]="'CREATE_NEW'" class="create-new-option">
                  <mat-icon>add</mat-icon>
                  Créer une nouvelle customisation
                </mat-option>
              </mat-select>
              <mat-hint>Sélectionnez les customisations à attacher à ce produit</mat-hint>
            </mat-form-field>

            <!-- Toggles -->
            <div class="toggle-section">
              <mat-slide-toggle formControlName="is_available">
                Produit disponible
              </mat-slide-toggle>

              <mat-slide-toggle formControlName="no_catalogable">
                Exclure du catalogue
              </mat-slide-toggle>

              <mat-slide-toggle formControlName="is_multi_step">
                Formules
              </mat-slide-toggle>
            </div>

            @if (productForm.get('no_catalogable')?.value) {
            <div class="catalog-notice">
              <mat-icon>info</mat-icon>
              <span
                >Ce produit sera masqué du catalogue public mais restera accessible
                pour les commandes directes.</span
              >
            </div>
            } @if (productForm.get('is_multi_step')?.value) {
            <div class="multi-step-notice">
              <mat-icon>info</mat-icon>
              <span
                >Vous pourrez configurer les étapes du menu après la création du
                produit.</span
              >
            </div>
            }

            @if (showAutoAssociateCheckbox) {
            <div class="auto-associate-notice">
              <mat-checkbox
                [(ngModel)]="autoAssociateToFormules"
                [ngModelOptions]="{standalone: true}"
              >
                Associer automatiquement aux formules
              </mat-checkbox>
              <div class="auto-associate-hint">
                <mat-icon>info</mat-icon>
                <span>Ce produit sera ajouté aux formules contenant des produits de la même catégorie.</span>
              </div>
            </div>
            }
          </div>
          }
        }
      </form>
    </div>

    <div mat-dialog-actions class="dialog-actions">
      <button mat-button mat-dialog-close>Annuler</button>
      <button
        mat-flat-button
        color="primary"
        (click)="saveProduct()"
        [disabled]="productForm.invalid || saving"
      >
        @if (saving) {
        <mat-icon>hourglass_empty</mat-icon>
        } @else {
        <mat-icon>{{ data.product ? 'save' : 'add' }}</mat-icon>
        }
        {{ data.product ? 'Modifier' : 'Créer' }}
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

      .product-form {
        display: flex;
        flex-direction: column;
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

      .catalog-notice {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background: var(--mat-sys-secondary-container);
        color: var(--mat-sys-on-secondary-container);
        border-radius: 8px;
        font-size: 0.875rem;
      }

      .multi-step-notice {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
        border-radius: 8px;
        font-size: 0.875rem;
      }

      .option-hint {
        font-size: 0.75rem;
        color: var(--mat-sys-on-surface-variant);
        margin-left: 4px;
      }

      .create-new-option {
        border-top: 1px solid var(--mat-sys-outline-variant);
        background: var(--mat-sys-surface-variant);
      }

      .create-new-option mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-right: 8px;
      }

      .auto-associate-notice {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        background: var(--mat-sys-tertiary-container);
        color: var(--mat-sys-on-tertiary-container);
        border-radius: 8px;
      }

      .auto-associate-hint {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.8rem;
        opacity: 0.85;
      }

      .auto-associate-hint mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      .dialog-actions {
        margin-top: 24px;
        gap: 8px;
      }

      .more-options-button {
        align-self: flex-start;
        color: var(--mat-sys-primary);
        padding-left: 0;
      }

      .more-options-button mat-icon {
        margin-right: 4px;
      }

      .more-options-section {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-top: 8px;
        border-top: 1px solid var(--mat-sys-outline-variant);
        animation: fadeIn 0.2s ease-out;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (max-width: 600px) {
        .dialog-content {
          min-width: unset;
          width: 100%;
        }
      }
    `,
  ],
})
export class ProductEditDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private productAdminService = inject(ProductAdminService);
  private customisationService = inject(CustomisationService);
  private vendorService = inject(VendorService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<ProductEditDialogComponent>);

  productForm: FormGroup;
  categories: Category[] = [];
  availableCustomisations: Customisation[] = [];
  saving = false;
  autoAssociateToFormules = true;
  showMoreOptions = false;

  isAccessoryMode = false;
  vendorOrderTypes: string[] = [];

  get isCreateMode(): boolean {
    return !this.data.product;
  }

  get showAutoAssociateCheckbox(): boolean {
    return this.isCreateMode
      && !!this.productForm?.get('category_id')?.value
      && !this.productForm?.get('is_multi_step')?.value;
  }

  getDialogTitle(): string {
    if (this.isAccessoryMode) {
      return this.data.product ? "Modifier l'accessoire" : 'Ajouter un accessoire';
    }
    return this.data.product ? 'Modifier le produit' : 'Ajouter un produit';
  }

  getNameLabel(): string {
    return this.isAccessoryMode ? "Nom de l'accessoire" : 'Nom du produit';
  }

  getNamePlaceholder(): string {
    return this.isAccessoryMode ? 'Ex: Couverts, Sac en papier' : 'Ex: Pizza Margherita';
  }

  getOrderTypeLabel(type: string): string {
    switch (type) {
      case 'eat-in': return 'Sur place';
      case 'take-away': return 'À emporter';
      case 'delivery': return 'Livraison';
      default: return type;
    }
  }

  constructor(@Inject(MAT_DIALOG_DATA) public data: DialogData) {
    this.isAccessoryMode = !!data.isAccessory || !!data.product?.is_accessory;
    // Get vendor's enabled order types
    const currentVendor = this.vendorService.getCurrentVendor();
    this.vendorOrderTypes = currentVendor?.enabled_order_types?.length
      ? currentVendor.enabled_order_types
      : ['eat-in', 'take-away', 'delivery'];
    this.productForm = this.createForm();
  }

  ngOnInit() {
    this.loadCategories();
    this.loadCustomisations();
    if (this.data.product) {
      this.populateForm(this.data.product);
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required]],
      price: [0, [Validators.required, Validators.min(0)]],
      tva_rate: [10, [Validators.required]],
      category_id: [null],
      display_order: [0, [Validators.min(0)]],
      image_url: [''],
      short_description: [''],
      long_description: [''],
      customisations: [[]],
      stock_quantity: [null],
      is_available: [true],
      is_multi_step: [false],
      no_catalogable: [false],
      icon_emoji: [''],
      applicable_order_types: [this.vendorOrderTypes],
      max_quantity_per_order: [null],
      is_accessory: [false],
    });
  }

  private loadCategories() {
    if (!this.data.vendorId) return;

    this.productAdminService.getCategories(this.data.vendorId).subscribe({
      next: (categories) => {
        this.categories = categories;
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        this.snackBar.open(
          'Erreur lors du chargement des catégories',
          'Fermer',
          {
            duration: 3000,
          }
        );
      },
    });
  }

  private loadCustomisations() {
    if (!this.data.vendorId) return;

    this.customisationService.getCustomisations(this.data.vendorId).subscribe({
      next: (customisations) => {
        this.availableCustomisations = customisations;
      },
      error: (error) => {
        console.error('Error loading customisations:', error);
        this.snackBar.open(
          'Erreur lors du chargement des customisations',
          'Fermer',
          {
            duration: 3000,
          }
        );
      },
    });
  }

  onCustomisationSelectionChange(event: any) {
    const selectedValues = event.value;

    // Check if 'CREATE_NEW' was selected
    if (selectedValues.includes('CREATE_NEW')) {
      // Remove 'CREATE_NEW' from the form value
      const filteredValues = selectedValues.filter((v: any) => v !== 'CREATE_NEW');
      this.productForm.patchValue({ customisations: filteredValues });

      // Close this dialog and navigate to customisations tab
      this.dialogRef.close(null);
      this.router.navigate(['admin', 'product-manager'], {
        queryParams: { tab: 'customisations' },
      });
      this.snackBar.open(
        'Créez votre customisation, puis revenez éditer ce produit',
        'OK',
        {
          duration: 5000,
        }
      );
    }
  }

  private populateForm(product: ProductAdmin) {
    const customisationIds = product.customisations?.map((c) => c.id) || [];

    this.productForm.patchValue({
      name: product.name,
      price: product.price,
      tva_rate: product.tva_rate ?? 10,
      category_id: product.category_id,
      display_order: product.display_order ?? 0,
      image_url: product.image_url,
      short_description: product.short_description,
      long_description: product.long_description,
      customisations: customisationIds,
      stock_quantity: product.stock_quantity,
      is_available: product.is_available ?? true,
      is_multi_step: product.is_multi_step ?? false,
      no_catalogable: product.no_catalogable ?? false,
      icon_emoji: product.icon_emoji || '',
      applicable_order_types: product.applicable_order_types?.length
        ? product.applicable_order_types
        : this.vendorOrderTypes,
      max_quantity_per_order: product.max_quantity_per_order ?? null,
      is_accessory: product.is_accessory ?? false,
    });

    // Auto-expand more options if any optional field has a value
    if (
      product.long_description ||
      product.display_order ||
      customisationIds.length > 0 ||
      product.is_available === false ||
      product.no_catalogable ||
      product.is_multi_step
    ) {
      this.showMoreOptions = true;
    }
  }

  saveProduct() {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    const formData: ProductFormData = {
      name: this.productForm.value.name,
      price: this.productForm.value.price,
      tva_rate: this.productForm.value.tva_rate,
      image_url: this.productForm.value.image_url,
      short_description: this.productForm.value.short_description,
      long_description: this.productForm.value.long_description,
      category_id: this.productForm.value.category_id,
      is_available: this.productForm.value.is_available,
      stock_quantity: this.productForm.value.stock_quantity,
      is_multi_step: this.productForm.value.is_multi_step,
      no_catalogable: this.productForm.value.no_catalogable,
      display_order: this.productForm.value.display_order,
      icon_emoji: this.productForm.value.icon_emoji || null,
      applicable_order_types: this.productForm.value.applicable_order_types,
      max_quantity_per_order: this.productForm.value.max_quantity_per_order || null,
      is_accessory: this.productForm.value.is_accessory,
    };

    // In accessory mode, force certain fields
    if (this.isAccessoryMode) {
      formData.is_accessory = true;
      formData.no_catalogable = true;
      formData.category_id = null;
      formData.is_multi_step = false;
      // If vendor has only 1 order type, auto-set it
      if (this.vendorOrderTypes.length === 1) {
        formData.applicable_order_types = [...this.vendorOrderTypes];
      }
    }

    const customisationIds: number[] = this.isAccessoryMode
      ? []
      : (this.productForm.value.customisations || []);

    const operation = this.data.product
      ? this.productAdminService.updateProduct(this.data.product.id, formData)
      : this.productAdminService.createProduct(this.data.vendorId, formData);

    operation.subscribe({
      next: (product) => {
        // Skip customisation attachment and auto-associate for accessories
        if (this.isAccessoryMode) {
          this.dialogRef.close(product);
          return;
        }

        const afterSave = () => {
          if (this.isCreateMode && this.autoAssociateToFormules && formData.category_id) {
            this.productAdminService
              .autoAssociateProductToMenuSteps(product, this.data.vendorId)
              .subscribe({
                next: (result) => {
                  if (result.associatedStepCount > 0) {
                    this.snackBar.open(
                      `Produit ajouté à ${result.associatedStepCount} étape(s) de formule`,
                      'OK',
                      { duration: 4000 }
                    );
                  }
                  this.dialogRef.close(product);
                },
                error: (error) => {
                  console.error('Error auto-associating to menus:', error);
                  this.snackBar.open(
                    'Produit créé mais erreur lors de l\'association aux formules',
                    'Fermer',
                    { duration: 5000 }
                  );
                  this.dialogRef.close(product);
                },
              });
          } else {
            this.dialogRef.close(product);
          }
        };

        // Attach customisations if any selected
        if (customisationIds.length > 0 || this.data.product?.has_customisations) {
          this.customisationService
            .attachToProduct(product.id, customisationIds)
            .subscribe({
              next: () => {
                afterSave();
              },
              error: (error) => {
                console.error('Error attaching customisations:', error);
                this.snackBar.open(
                  'Produit sauvegardé mais erreur lors de l\'attachement des customisations',
                  'Fermer',
                  {
                    duration: 5000,
                    panelClass: ['error-snackbar'],
                  }
                );
                afterSave();
              },
            });
        } else {
          afterSave();
        }
      },
      error: (error) => {
        console.error('Error saving product:', error);
        this.snackBar.open('Erreur lors de la sauvegarde', 'Fermer', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
        this.saving = false;
      },
    });
  }
}
