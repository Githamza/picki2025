import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import {
  DragDropModule,
  CdkDragDrop,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import {
  Subject,
  takeUntil,
  map,
  startWith,
  combineLatest,
  Observable,
} from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { ImageUploadComponent } from '../../../shared/components';
import { ProductAdminService } from '../../../services/product-admin.service';
import { VendorService } from '../../../services/vendor.service';
import {
  MenuAdmin,
  Category,
  ProductAdmin,
  MenuStep,
  MenuStepOption,
} from '../../../models/product-admin.interface';
import {
  BulkProductSelectorDialogComponent,
  BulkSelectorDialogData,
  BulkSelectorResult,
} from '../bulk-product-selector-dialog/bulk-product-selector-dialog.component';

@Component({
  selector: 'app-menu-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatSlideToggleModule,
    MatChipsModule,
    MatListModule,
    MatDividerModule,
    MatExpansionModule,
    DragDropModule,
    ImageUploadComponent,
  ],
  template: `
    <div class="menu-edit-container">
      <!-- Header -->
      <div class="header">
        <div class="header-content">
          <button mat-icon-button (click)="goBack()" class="back-button">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <div class="title-section">
            <h1>{{ isEditMode ? 'Modifier le menu' : 'Créer un menu' }}</h1>
            <p class="subtitle">{{ menu?.name || 'Nouveau menu' }}</p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-button (click)="goBack()">
            <mat-icon>close</mat-icon>
            Annuler
          </button>
          <button
            mat-raised-button
            color="primary"
            (click)="saveMenu()"
            [disabled]="menuForm.invalid || saving"
          >
            <mat-icon>{{ saving ? 'hourglass_empty' : 'save' }}</mat-icon>
            {{ isEditMode ? 'Mettre à jour' : 'Créer le menu' }}
          </button>
        </div>
      </div>

      <div class="content">
        <!-- Menu Basic Information -->
        <mat-card class="info-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>info</mat-icon>
              Informations générales
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <form [formGroup]="menuForm" class="menu-form">
              <div class="form-row">
                <mat-form-field appearance="fill" class="flex-1">
                  <mat-label>Nom du menu</mat-label>
                  <input
                    matInput
                    formControlName="name"
                    placeholder="Ex: Menu Déjeuner"
                  />
                  @if (menuForm.get('name')?.hasError('required')) {
                  <mat-error>Le nom est requis</mat-error>
                  }
                </mat-form-field>

                <mat-form-field appearance="fill" class="price-field">
                  <mat-label>Prix</mat-label>
                  <input
                    matInput
                    type="number"
                    formControlName="price"
                    step="0.01"
                    min="0"
                  />
                  <span matTextPrefix>€&nbsp;</span>
                  @if (menuForm.get('price')?.hasError('required')) {
                  <mat-error>Le prix est requis</mat-error>
                  }
                </mat-form-field>
              </div>

              <div class="form-row">
                <mat-form-field appearance="fill" class="flex-1">
                  <mat-label>Catégorie</mat-label>
                  <mat-select formControlName="category_id">
                    @for (category of categories; track category.id) {
                    <mat-option [value]="category.id">{{
                      category.name
                    }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <div class="toggle-wrapper">
                  <mat-slide-toggle formControlName="is_available">
                    Menu disponible
                  </mat-slide-toggle>
                </div>

                <div class="toggle-wrapper">
                  <mat-slide-toggle formControlName="no_catalogable">
                    Exclure du catalogue
                  </mat-slide-toggle>
                </div>
              </div>

              @if (menuForm.get('no_catalogable')?.value) {
              <div class="catalog-notice">
                <mat-icon>info</mat-icon>
                <span
                  >Ce menu sera masqué du catalogue public mais restera
                  accessible pour les commandes directes.</span
                >
              </div>
              }

              <app-image-upload
                formControlName="image_url"
                label="URL de l'image"
                placeholder="https://..."
              ></app-image-upload>

              <mat-form-field appearance="fill">
                <mat-label>Description courte</mat-label>
                <input matInput formControlName="short_description" />
              </mat-form-field>

              <mat-form-field appearance="fill">
                <mat-label>Description détaillée</mat-label>
                <textarea
                  matInput
                  formControlName="long_description"
                  rows="3"
                ></textarea>
              </mat-form-field>
            </form>
          </mat-card-content>
        </mat-card>

        <!-- Menu Steps Management -->
        <mat-card class="steps-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>list</mat-icon>
              Étapes du menu ({{ stepsFormArray.length }})
            </mat-card-title>
            <div class="header-actions">
              <button mat-raised-button color="accent" (click)="addStep()">
                <mat-icon>add</mat-icon>
                Ajouter une étape
              </button>
            </div>
          </mat-card-header>
          <mat-card-content>
            @if (stepsFormArray.length === 0) {
            <div class="empty-steps">
              <mat-icon>restaurant_menu</mat-icon>
              <h3>Aucune étape définie</h3>
              <p>Ajoutez des étapes pour structurer votre menu</p>
              <button mat-raised-button color="primary" (click)="addStep()">
                <mat-icon>add</mat-icon>
                Créer la première étape
              </button>
            </div>
            } @else {
            <div
              cdkDropList
              class="steps-list"
              (cdkDropListDropped)="onStepDrop($event)"
            >
              <mat-expansion-panel
                *ngFor="
                  let stepControl of stepsFormArray.controls;
                  let i = index;
                  trackBy: trackByStepIndex
                "
                cdkDrag
                class="step-panel"
                [expanded]="expandedStepIndex === i"
              >
                <mat-expansion-panel-header>
                  <mat-panel-title>
                    <div class="step-title">
                      <mat-icon cdkDragHandle class="drag-handle"
                        >drag_indicator</mat-icon
                      >
                      <span class="step-number">{{ i + 1 }}</span>
                      <span class="step-name">{{
                        stepControl.get('name')?.value || 'Nouvelle étape'
                      }}</span>
                      <span class="step-meta">
                        {{
                          stepControl.get('is_required')?.value
                            ? 'Obligatoire'
                            : 'Optionnelle'
                        }}
                        •
                        {{
                          stepControl.get('step_type')?.value ===
                          'single-select'
                            ? 'Sélection unique'
                            : 'Sélection multiple'
                        }}
                      </span>
                    </div>
                  </mat-panel-title>
                  <mat-panel-description>
                    {{ getStepProductCount(i) }} produit(s) assigné(s)
                  </mat-panel-description>
                </mat-expansion-panel-header>

                <div class="step-content" [formGroup]="$any(stepControl)">
                  <!-- Step Configuration -->
                  <div class="step-config">
                    <h4>Configuration de l'étape</h4>

                    <div class="form-row">
                      <mat-form-field appearance="fill" class="flex-1">
                        <mat-label>Nom de l'étape</mat-label>
                        <input
                          matInput
                          formControlName="name"
                          placeholder="Ex: Choisissez votre entrée"
                        />
                      </mat-form-field>

                      <mat-form-field appearance="fill" class="step-type-field">
                        <mat-label>Type de sélection</mat-label>
                        <mat-select formControlName="step_type">
                          <mat-option value="single-select"
                            >Sélection unique</mat-option
                          >
                          <mat-option value="multi-select"
                            >Sélection multiple</mat-option
                          >
                        </mat-select>
                      </mat-form-field>
                    </div>

                    <mat-form-field appearance="fill">
                      <mat-label>Description</mat-label>
                      <input
                        matInput
                        formControlName="description"
                        placeholder="Description de l'étape (optionnel)"
                      />
                    </mat-form-field>

                    <div class="form-row">
                      <div class="toggle-wrapper">
                        <mat-slide-toggle formControlName="is_required">
                          Étape obligatoire
                        </mat-slide-toggle>
                      </div>

                      @if (stepControl.get('step_type')?.value ===
                      'multi-select') {
                      <mat-form-field appearance="fill" class="number-field">
                        <mat-label>Min. sélections</mat-label>
                        <input
                          matInput
                          type="number"
                          formControlName="min_selections"
                          min="0"
                        />
                      </mat-form-field>

                      <mat-form-field appearance="fill" class="number-field">
                        <mat-label>Max. sélections</mat-label>
                        <input
                          matInput
                          type="number"
                          formControlName="max_selections"
                          min="1"
                        />
                      </mat-form-field>
                      }
                    </div>
                  </div>

                  <mat-divider></mat-divider>

                  <!-- Product Assignment -->
                  <div class="product-assignment">
                    <div class="assignment-header">
                      <h4>Produits assignés</h4>
                      <div class="assignment-actions">
                        <button
                          mat-button
                          color="primary"
                          (click)="openProductSelector(i)"
                        >
                          <mat-icon>add</mat-icon>
                          Ajouter un produit
                        </button>
                        <button
                          mat-raised-button
                          color="accent"
                          (click)="openBulkProductSelector(i)"
                        >
                          <mat-icon>playlist_add</mat-icon>
                          Ajouter plusieurs
                        </button>
                      </div>
                    </div>

                    <!-- Product Search & Add -->
                    <div class="product-search" *ngIf="showProductSelector[i]">
                      <mat-form-field appearance="fill" class="flex-1">
                        <mat-label>Rechercher un produit</mat-label>
                        <input
                          matInput
                          [matAutocomplete]="auto"
                          [formControl]="productSearchControls[i]"
                          placeholder="Tapez le nom du produit..."
                        />
                        <mat-autocomplete
                          #auto="matAutocomplete"
                          [displayWith]="displayProduct"
                          (optionSelected)="
                            addProductToStep(i, $event.option.value)
                          "
                        >
                          @for (product of (filteredProducts[i] | async); track
                          product.id) {
                          <mat-option [value]="product">
                            <div class="product-option">
                              <span class="product-name">{{
                                product.name
                              }}</span>
                              <span class="product-price">{{
                                product.price
                                  | currency : 'EUR' : 'symbol' : '1.2-2' : 'fr'
                              }}</span>
                            </div>
                          </mat-option>
                          }
                        </mat-autocomplete>
                      </mat-form-field>
                      <button mat-icon-button (click)="closeProductSelector(i)">
                        <mat-icon>close</mat-icon>
                      </button>
                    </div>

                    <!-- Assigned Products List -->
                    <div class="assigned-products">
                      @if (getStepProducts(i).length === 0) {
                      <div class="no-products">
                        <mat-icon>inventory_2</mat-icon>
                        <p>Aucun produit assigné à cette étape</p>
                      </div>
                      } @else {
                      <mat-list class="products-list">
                        @for (product of getStepProducts(i); track product.id;
                        let productIndex = $index) {
                        <mat-list-item class="product-item">
                          <div class="product-info">
                            <div class="product-main">
                              <span class="product-name">{{
                                product.name
                              }}</span>
                              <span class="product-base-price">{{
                                product.price
                                  | currency : 'EUR' : 'symbol' : '1.2-2' : 'fr'
                              }}</span>
                            </div>
                            <div class="product-controls">
                              <mat-form-field
                                appearance="fill"
                                class="adjustment-field"
                              >
                                <mat-label>Ajustement prix</mat-label>
                                <input
                                  matInput
                                  type="number"
                                  step="0.01"
                                  [value]="
                                    getProductPriceAdjustmentByIndex(
                                      i,
                                      productIndex
                                    )
                                  "
                                  (input)="
                                    updateProductPriceAdjustmentByIndex(
                                      i,
                                      productIndex,
                                      $event
                                    )
                                  "
                                  placeholder="0.00"
                                />
                                <span matTextPrefix>€&nbsp;</span>
                              </mat-form-field>
                              <button
                                mat-icon-button
                                color="warn"
                                (click)="
                                  removeProductFromStepByIndex(i, productIndex)
                                "
                              >
                                <mat-icon>delete</mat-icon>
                              </button>
                            </div>
                          </div>
                        </mat-list-item>
                        <mat-divider></mat-divider>
                        }
                      </mat-list>
                      }
                    </div>
                  </div>

                  <!-- Step Actions -->
                  <div class="step-actions">
                    <button mat-button color="warn" (click)="removeStep(i)">
                      <mat-icon>delete</mat-icon>
                      Supprimer l'étape
                    </button>
                  </div>
                </div>
              </mat-expansion-panel>
            </div>
            }
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [
    `
      .menu-edit-container {
        min-height: 100vh;
        background: var(--mat-sys-surface-dim);
      }

      .header {
        background: var(--mat-sys-surface);
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        padding: 16px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: sticky;
        top: 0;
        z-index: 100;
      }

      .header-content {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .back-button {
        background: var(--mat-sys-surface-variant);
      }

      .title-section h1 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 500;
      }

      .title-section .subtitle {
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.875rem;
      }

      .header-actions {
        display: flex;
        gap: 12px;
        align-items: center;
      }

      .content {
        padding: 24px;
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .info-card,
      .steps-card {
        border-radius: 12px;
      }

      .info-card mat-card-title,
      .steps-card mat-card-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .steps-card mat-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
      }

      .menu-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .form-row {
        display: flex;
        gap: 16px;
        align-items: center;
      }

      .flex-1 {
        flex: 1;
      }

      .price-field {
        min-width: 120px;
      }

      .step-type-field {
        min-width: 160px;
      }

      .number-field {
        min-width: 100px;
      }

      .adjustment-field {
        min-width: 120px;
      }

      .toggle-wrapper {
        display: flex;
        align-items: center;
        padding: 8px 0;
      }

      .empty-steps {
        text-align: center;
        padding: 48px 24px;
        color: var(--mat-sys-on-surface-variant);
      }

      .empty-steps mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: var(--mat-sys-outline);
        margin-bottom: 16px;
      }

      .step-panel {
        margin-bottom: 16px;
        border-radius: 8px;
      }

      .step-title {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .step-number {
        background: var(--mat-sys-primary);
        color: var(--mat-sys-on-primary);
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        font-weight: 500;
      }

      .step-name {
        font-weight: 500;
      }

      .step-meta {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.75rem;
      }

      .step-content {
        padding: 24px 0;
      }

      .step-config h4 {
        margin: 0 0 16px 0;
        color: var(--mat-sys-on-surface);
      }

      .product-assignment {
        margin-top: 24px;
      }

      .assignment-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }

      .assignment-header h4 {
        margin: 0;
      }

      .assignment-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .product-search {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
        align-items: flex-start;
      }

      .product-option {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
      }

      .product-name {
        font-weight: 500;
      }

      .product-price {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.875rem;
      }

      .assigned-products {
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: 8px;
        min-height: 100px;
      }

      .no-products {
        text-align: center;
        padding: 32px;
        color: var(--mat-sys-on-surface-variant);
      }

      .no-products mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        margin-bottom: 8px;
      }

      .products-list {
        padding: 0;
      }

      .product-item {
        padding: 12px 16px;
      }

      .product-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
      }

      .product-main {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .product-base-price {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.875rem;
      }

      .product-controls {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .step-actions {
        display: flex;
        gap: 8px;
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid var(--mat-sys-outline-variant);
      }

      .catalog-notice {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 16px;
        padding: 12px 16px;
        background-color: var(--mat-sys-surface-variant);
        border-radius: 8px;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.875rem;
      }

      .catalog-notice mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: var(--mat-sys-on-surface-variant);
      }

      /* Drag and Drop Styles */
      .steps-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .drag-handle {
        color: var(--mat-sys-outline);
        cursor: grab;
        margin-right: 8px;
        transition: color 0.2s ease;
      }

      .drag-handle:hover {
        color: var(--mat-sys-on-surface);
      }

      .drag-handle:active {
        cursor: grabbing;
      }

      .step-panel.cdk-drag-preview {
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        background: var(--mat-sys-surface);
        transform: rotate(2deg);
      }

      .step-panel.cdk-drag-placeholder {
        opacity: 0.4;
        border: 2px dashed var(--mat-sys-outline-variant);
        background: transparent;
      }

      .steps-list.cdk-drop-list-dragging
        .step-panel:not(.cdk-drag-placeholder) {
        transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
      }

      .step-title {
        align-items: center;
      }

      @media (max-width: 768px) {
        .header {
          flex-direction: column;
          gap: 16px;
          align-items: stretch;
        }

        .header-content {
          align-self: flex-start;
        }

        .header-actions {
          align-self: flex-end;
        }

        .content {
          padding: 16px;
        }

        .form-row {
          flex-direction: column;
          align-items: stretch;
        }

        .product-info {
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
        }

        .product-controls {
          align-self: flex-end;
        }

        .drag-handle {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }
    `,
  ],
})
export class MenuEditComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private productAdminService = inject(ProductAdminService);
  private vendorService = inject(VendorService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private destroy$ = new Subject<void>();

  menuForm: FormGroup;
  menu: MenuAdmin | null = null;
  categories: Category[] = [];
  products: ProductAdmin[] = [];
  isEditMode = false;
  saving = false;
  currentVendorId: string = '';
  expandedStepIndex = 0;

  // Step management
  showProductSelector: boolean[] = [];
  productSearchControls: any[] = [];
  filteredProducts: Observable<ProductAdmin[]>[] = [];
  stepProducts: {
    [stepIndex: number]: {
      productId: number;
      priceAdjustment: number;
      product: ProductAdmin;
    }[];
  } = {};

  constructor() {
    this.menuForm = this.createForm();
  }

  ngOnInit() {
    this.loadVendor();
    this.loadCategories();
    this.loadProducts();
    this.checkEditMode();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required]],
      price: [0, [Validators.required, Validators.min(0)]],
      category_id: [null],
      image_url: [''],
      short_description: [''],
      long_description: [''],
      is_available: [true],
      no_catalogable: [false],
      steps: this.fb.array([]),
    });
  }

  get stepsFormArray(): FormArray {
    return this.menuForm.get('steps') as FormArray;
  }

  private loadVendor() {
    this.vendorService.currentVendor$
      .pipe(takeUntil(this.destroy$))
      .subscribe((vendor) => {
        if (vendor?.id) {
          this.currentVendorId = vendor.id;
        }
      });
  }

  private loadCategories() {
    this.productAdminService
      .getCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => {
          this.categories = categories;
        },
        error: (error) => {
          console.error('Error loading categories:', error);
        },
      });
  }

  private loadProducts() {
    if (!this.currentVendorId) return;

    this.productAdminService
      .getProductsForSteps(this.currentVendorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products) => {
          this.products = products;
        },
        error: (error) => {
          console.error('Error loading products:', error);
        },
      });
  }

  private checkEditMode() {
    const menuId = this.route.snapshot.paramMap.get('id');
    if (menuId && menuId !== 'new') {
      this.isEditMode = true;
      this.loadMenu(parseInt(menuId));
    }
  }

  private loadMenu(id: number) {
    this.productAdminService
      .getMenuById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (menu) => {
          this.menu = menu;
          this.populateForm(menu);
        },
        error: (error) => {
          console.error('Error loading menu:', error);
          this.snackBar.open('Erreur lors du chargement du menu', 'Fermer', {
            duration: 5000,
          });
        },
      });
  }

  private populateForm(menu: MenuAdmin) {
    this.menuForm.patchValue({
      name: menu.name,
      price: menu.price,
      category_id: menu.category_id,
      image_url: menu.image_url,
      short_description: menu.short_description,
      long_description: menu.long_description,
      is_available: menu.is_available ?? true,
      no_catalogable: menu.no_catalogable ?? false,
    });

    // Load steps if available
    if (menu.steps) {
      menu.steps.forEach((step, index) => {
        this.addStep(step);
      });
    }
  }

  addStep(stepData?: MenuStep) {
    const stepForm = this.fb.group({
      name: [stepData?.name || '', [Validators.required]],
      step_type: [
        stepData?.step_type || 'single-select',
        [Validators.required],
      ],
      description: [stepData?.description || ''],
      is_required: [stepData?.is_required ?? true],
      min_selections: [stepData?.min_selections || 0],
      max_selections: [stepData?.max_selections || 1],
      display_order: [
        stepData?.display_order || this.stepsFormArray.length + 1,
      ],
    });

    this.stepsFormArray.push(stepForm);
    const stepIndex = this.stepsFormArray.length - 1;

    // Initialize product selector for this step
    this.showProductSelector[stepIndex] = false;
    this.productSearchControls[stepIndex] = this.fb.control('');

    // Load existing step options if available
    if (stepData?.options && stepData.options.length > 0) {
      this.stepProducts[stepIndex] = stepData.options
        .filter((option) => {
          // Only include options that reference actual standalone products
          if (option.product_id === null) return false;

          // Check if the referenced product is a multi-step product (corrupted data!)
          const referencedProduct = this.products.find(
            (p) => p.id === option.product_id
          );
          if (referencedProduct?.is_multi_step) {
            console.warn(
              `Step option "${option.name}" incorrectly references multi-step product. Skipping.`
            );
            return false;
          }

          return true;
        })
        .map((option) => {
          // Find the actual product to get correct data
          const actualProduct = this.products.find(
            (p) => p.id === option.product_id
          );
          if (!actualProduct) {
            console.warn(`Product with ID ${option.product_id} not found`);
            return null;
          }

          return {
            productId: actualProduct.id, // ✅ Use actual product ID
            priceAdjustment: parseFloat(
              option.price_adjustment?.toString() || '0'
            ),
            product: actualProduct, // ✅ Use actual product with correct image
          };
        })
        .filter((item) => item !== null)
        .sort((a, b) => a.product.name.localeCompare(b.product.name)) as any[]; // ✅ Sort alphabetically
    } else {
      this.stepProducts[stepIndex] = [];
    }

    // Setup autocomplete
    this.filteredProducts[stepIndex] = this.productSearchControls[
      stepIndex
    ].valueChanges.pipe(
      startWith(''),
      map((value) => this._filterProducts(value))
    );

    this.expandedStepIndex = stepIndex;
  }

  removeStep(index: number) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette étape ?')) {
      this.stepsFormArray.removeAt(index);
      delete this.stepProducts[index];
      delete this.showProductSelector[index];
      delete this.productSearchControls[index];
      delete this.filteredProducts[index];

      // Reindex remaining items
      this.reindexSteps(index);
    }
  }

  private reindexSteps(removedIndex: number) {
    const newStepProducts: typeof this.stepProducts = {};
    const newShowProductSelector: boolean[] = [];
    const newProductSearchControls: any[] = [];
    const newFilteredProducts: any[] = [];

    Object.keys(this.stepProducts).forEach((key) => {
      const index = parseInt(key);
      if (index < removedIndex) {
        newStepProducts[index] = this.stepProducts[index];
        newShowProductSelector[index] = this.showProductSelector[index];
        newProductSearchControls[index] = this.productSearchControls[index];
        newFilteredProducts[index] = this.filteredProducts[index];
      } else if (index > removedIndex) {
        newStepProducts[index - 1] = this.stepProducts[index];
        newShowProductSelector[index - 1] = this.showProductSelector[index];
        newProductSearchControls[index - 1] = this.productSearchControls[index];
        newFilteredProducts[index - 1] = this.filteredProducts[index];
      }
    });

    this.stepProducts = newStepProducts;
    this.showProductSelector = newShowProductSelector;
    this.productSearchControls = newProductSearchControls;
    this.filteredProducts = newFilteredProducts;
  }

  openProductSelector(stepIndex: number) {
    this.showProductSelector[stepIndex] = true;
  }

  closeProductSelector(stepIndex: number) {
    this.showProductSelector[stepIndex] = false;
    this.productSearchControls[stepIndex].setValue('');
  }

  openBulkProductSelector(stepIndex: number) {
    const stepControl = this.stepsFormArray.at(stepIndex);
    if (!stepControl) return;

    const stepName = stepControl.get('name')?.value || `Étape ${stepIndex + 1}`;
    const alreadySelectedProductIds =
      this.stepProducts[stepIndex]?.map((p) => p.productId) || [];

    const dialogData: BulkSelectorDialogData = {
      products: this.products,
      alreadySelectedProductIds,
      stepName,
    };

    const dialogRef = this.dialog.open(BulkProductSelectorDialogComponent, {
      width: '800px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      data: dialogData,
    });

    dialogRef
      .afterClosed()
      .subscribe((result: BulkSelectorResult | undefined) => {
        if (result?.selectedProducts?.length) {
          this.addMultipleProductsToStep(stepIndex, result.selectedProducts);
        }
      });
  }

  addProductToStep(stepIndex: number, product: ProductAdmin) {
    if (!this.stepProducts[stepIndex]) {
      this.stepProducts[stepIndex] = [];
    }

    // Check if product is already added
    const exists = this.stepProducts[stepIndex].find(
      (p) => p.productId === product.id
    );
    if (exists) {
      this.snackBar.open(
        'Ce produit est déjà assigné à cette étape',
        'Fermer',
        {
          duration: 3000,
        }
      );
      return;
    }

    // Use sorted insertion instead of push to maintain alphabetical order
    this.insertProductSorted(stepIndex, {
      productId: product.id,
      priceAdjustment: 0,
      product: product,
    });

    this.closeProductSelector(stepIndex);
    this.snackBar.open("Produit ajouté à l'étape", 'Fermer', {
      duration: 2000,
    });
  }

  addMultipleProductsToStep(stepIndex: number, products: ProductAdmin[]) {
    if (!this.stepProducts[stepIndex]) {
      this.stepProducts[stepIndex] = [];
    }

    let addedCount = 0;
    const skippedProducts: string[] = [];

    products.forEach((product) => {
      // Check if product is already added
      const exists = this.stepProducts[stepIndex].find(
        (p) => p.productId === product.id
      );

      if (exists) {
        skippedProducts.push(product.name);
        return;
      }

      // Add product using sorted insertion
      this.insertProductSorted(stepIndex, {
        productId: product.id,
        priceAdjustment: 0,
        product: product,
      });
      addedCount++;
    });

    // Show feedback message
    if (addedCount > 0) {
      this.snackBar.open(
        `${addedCount} produit(s) ajouté(s) à l'étape`,
        'Fermer',
        { duration: 3000 }
      );
    }

    if (skippedProducts.length > 0) {
      this.snackBar.open(
        `${skippedProducts.length} produit(s) déjà présent(s) dans l'étape`,
        'Fermer',
        { duration: 3000 }
      );
    }
  }

  removeProductFromStep(stepIndex: number, productId: number) {
    if (this.stepProducts[stepIndex]) {
      this.stepProducts[stepIndex] = this.stepProducts[stepIndex].filter(
        (p) => p.product.id !== productId // ✅ Compare against product.id instead of p.productId
      );
    }
  }

  // New method using array index instead of product ID
  removeProductFromStepByIndex(stepIndex: number, productIndex: number) {
    if (
      this.stepProducts[stepIndex] &&
      this.stepProducts[stepIndex][productIndex]
    ) {
      this.stepProducts[stepIndex].splice(productIndex, 1);
    }
  }

  updateProductPriceAdjustment(
    stepIndex: number,
    productId: number,
    event: any
  ) {
    const value = parseFloat(event.target.value) || 0;
    if (this.stepProducts[stepIndex]) {
      const product = this.stepProducts[stepIndex].find(
        (p) => p.productId === productId
      );
      if (product) {
        product.priceAdjustment = value;
      }
    }
  }

  // New method using array index instead of product ID
  updateProductPriceAdjustmentByIndex(
    stepIndex: number,
    productIndex: number,
    event: any
  ) {
    const value = parseFloat(event.target.value) || 0;
    if (
      this.stepProducts[stepIndex] &&
      this.stepProducts[stepIndex][productIndex]
    ) {
      this.stepProducts[stepIndex][productIndex].priceAdjustment = value;
    }
  }

  getProductPriceAdjustment(stepIndex: number, productId: number): number {
    if (this.stepProducts[stepIndex]) {
      const product = this.stepProducts[stepIndex].find(
        (p) => p.productId === productId
      );
      return product?.priceAdjustment || 0;
    }
    return 0;
  }

  // New method using array index instead of product ID
  getProductPriceAdjustmentByIndex(
    stepIndex: number,
    productIndex: number
  ): number {
    if (
      this.stepProducts[stepIndex] &&
      this.stepProducts[stepIndex][productIndex]
    ) {
      return this.stepProducts[stepIndex][productIndex].priceAdjustment || 0;
    }
    return 0;
  }

  getStepProducts(stepIndex: number): ProductAdmin[] {
    // Remove sorting here since we'll keep the underlying array sorted
    return this.stepProducts[stepIndex]?.map((p) => p.product) || [];
  }

  getStepProductCount(stepIndex: number): number {
    return this.stepProducts[stepIndex]?.length || 0;
  }

  // Helper method to maintain sorted order in stepProducts
  private insertProductSorted(
    stepIndex: number,
    productData: {
      productId: number;
      priceAdjustment: number;
      product: ProductAdmin;
    }
  ) {
    if (!this.stepProducts[stepIndex]) {
      this.stepProducts[stepIndex] = [];
    }

    // Find the correct insertion point to maintain sorted order
    let insertIndex = 0;
    const productName = productData.product.name.toLowerCase();

    while (
      insertIndex < this.stepProducts[stepIndex].length &&
      this.stepProducts[stepIndex][insertIndex].product.name.toLowerCase() <
        productName
    ) {
      insertIndex++;
    }

    // Insert at the correct position
    this.stepProducts[stepIndex].splice(insertIndex, 0, productData);
  }

  private _filterProducts(
    value: string | ProductAdmin | null | unknown
  ): ProductAdmin[] {
    if (!value) return this.products;

    const filterValue =
      typeof value === 'string'
        ? value.toLowerCase()
        : typeof value === 'object' && value && 'name' in value
        ? (value as ProductAdmin).name.toLowerCase()
        : '';
    return this.products.filter((product) =>
      product.name.toLowerCase().includes(filterValue)
    );
  }

  displayProduct(product: ProductAdmin): string {
    return product ? product.name : '';
  }

  trackByStepIndex(index: number): number {
    return index;
  }

  onStepDrop(event: CdkDragDrop<any>) {
    if (event.previousIndex !== event.currentIndex) {
      // Move the form control in the FormArray
      const formArray = this.stepsFormArray;
      const movedControl = formArray.at(event.previousIndex);
      formArray.removeAt(event.previousIndex);
      formArray.insert(event.currentIndex, movedControl);

      // Reorder stepProducts
      const tempStepProducts = { ...this.stepProducts };
      this.stepProducts = {};

      // Create new mapping for stepProducts
      Object.keys(tempStepProducts).forEach((key) => {
        const oldIndex = parseInt(key);
        let newIndex = oldIndex;

        if (oldIndex === event.previousIndex) {
          newIndex = event.currentIndex;
        } else if (
          oldIndex < event.previousIndex &&
          oldIndex >= event.currentIndex
        ) {
          newIndex = oldIndex + 1;
        } else if (
          oldIndex > event.previousIndex &&
          oldIndex <= event.currentIndex
        ) {
          newIndex = oldIndex - 1;
        }

        this.stepProducts[newIndex] = tempStepProducts[oldIndex];
      });

      // Reorder other step-related arrays
      moveItemInArray(
        this.showProductSelector,
        event.previousIndex,
        event.currentIndex
      );
      moveItemInArray(
        this.productSearchControls,
        event.previousIndex,
        event.currentIndex
      );
      moveItemInArray(
        this.filteredProducts,
        event.previousIndex,
        event.currentIndex
      );

      // Update display_order for all steps
      this.updateStepDisplayOrder();

      // Update expanded index if needed
      if (this.expandedStepIndex === event.previousIndex) {
        this.expandedStepIndex = event.currentIndex;
      } else if (
        this.expandedStepIndex >=
          Math.min(event.previousIndex, event.currentIndex) &&
        this.expandedStepIndex <=
          Math.max(event.previousIndex, event.currentIndex)
      ) {
        if (event.previousIndex < event.currentIndex) {
          this.expandedStepIndex--;
        } else {
          this.expandedStepIndex++;
        }
      }
    }
  }

  private updateStepDisplayOrder() {
    this.stepsFormArray.controls.forEach((control, index) => {
      control.get('display_order')?.setValue(index + 1);
    });
  }

  saveMenu() {
    if (this.menuForm.invalid) {
      this.menuForm.markAllAsTouched();
      this.snackBar.open(
        'Veuillez corriger les erreurs dans le formulaire',
        'Fermer',
        {
          duration: 5000,
        }
      );
      return;
    }

    this.saving = true;

    // Extract only basic menu data (exclude steps FormArray)
    const basicMenuData = {
      name: this.menuForm.get('name')?.value,
      price: this.menuForm.get('price')?.value,
      category_id: this.menuForm.get('category_id')?.value,
      image_url: this.menuForm.get('image_url')?.value,
      short_description: this.menuForm.get('short_description')?.value,
      long_description: this.menuForm.get('long_description')?.value,
      is_available: this.menuForm.get('is_available')?.value,
      no_catalogable: this.menuForm.get('no_catalogable')?.value,
      stock_quantity: null,
    };

    const operation =
      this.isEditMode && this.menu
        ? this.productAdminService.updateMenu(this.menu.id, basicMenuData)
        : this.productAdminService.createMenu(
            this.currentVendorId!,
            basicMenuData
          );

    operation.subscribe({
      next: async (menu) => {
        try {
          // Now save the steps and their options
          await this.saveMenuSteps(menu.id);

          this.snackBar.open(
            this.isEditMode
              ? 'Menu et étapes modifiés avec succès'
              : 'Menu et étapes créés avec succès',
            'Fermer',
            { duration: 3000 }
          );
          this.goBack();
        } catch (stepError) {
          console.error('Error saving steps:', stepError);
          this.snackBar.open(
            'Menu sauvegardé mais erreur lors de la sauvegarde des étapes',
            'Fermer',
            { duration: 5000 }
          );
          this.saving = false;
        }
      },
      error: (error) => {
        console.error('Error saving menu:', error);
        this.snackBar.open('Erreur lors de la sauvegarde', 'Fermer', {
          duration: 5000,
        });
        this.saving = false;
      },
    });
  }

  private async saveMenuSteps(menuId: number): Promise<void> {
    const stepsData = this.stepsFormArray.value.map(
      (step: any, index: number) => {
        const stepProducts = this.stepProducts[index] || [];
        return {
          name: step.name,
          step_type: step.step_type,
          description: step.description,
          is_required: step.is_required,
          min_selections: step.min_selections,
          max_selections: step.max_selections,
          products: stepProducts.map((item) => ({
            id: item.productId,
            name: item.product.name,
            price_adjustment: item.priceAdjustment || 0,
            description:
              item.product.short_description || item.product.long_description,
            image_url: item.product.image_url,
          })),
        };
      }
    );

    console.log('Saving steps data:', stepsData);

    if (this.currentVendorId) {
      await this.productAdminService.saveMenuSteps(
        menuId,
        stepsData,
        this.currentVendorId
      );
    } else {
      throw new Error('Vendor ID is required to save menu steps');
    }
  }

  goBack() {
    this.router.navigate(['../../'], { relativeTo: this.route });
  }
}
