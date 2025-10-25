import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormControl,
} from '@angular/forms';
import { Subject, takeUntil, Observable, startWith, map } from 'rxjs';

// Angular Material Components
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import {
  MatDialogModule,
  MatDialog,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
  DragDropModule,
  CdkDragDrop,
  moveItemInArray,
} from '@angular/cdk/drag-drop';

// Services
import { ProductAdminService } from '../../../services/product-admin.service';
import { VendorService } from '../../../services/vendor.service';

// Models
import {
  ProductAdmin,
  Category,
} from '../../../models/product-admin.interface';

// Shared Components
import { ImageUploadComponent } from '../../../shared/components';

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatExpansionModule,
    MatCardModule,
    MatChipsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    DragDropModule,
  ],
  template: `
    <div class="category-manager">
      <!-- Header -->
      <div class="manager-header">
        <div class="header-content">
          <h2>
            <mat-icon>category</mat-icon>
            Gestion des Catégories
          </h2>
          <p class="subtitle">Organisez vos produits par catégories</p>
        </div>
        <button
          mat-raised-button
          color="primary"
          (click)="openCategoryDialog()"
          [disabled]="loading"
        >
          <mat-icon>add</mat-icon>
          Nouvelle catégorie
        </button>
      </div>

      <!-- Loading State -->
      <div class="loading-container" *ngIf="loading">
        <mat-progress-spinner></mat-progress-spinner>
        <p>Chargement des catégories...</p>
      </div>

      <!-- Categories List -->
      <div class="categories-container" *ngIf="!loading">
        <mat-accordion
          class="categories-accordion"
          *ngIf="categories.length > 0"
          cdkDropList
          (cdkDropListDropped)="onCategoryDrop($event)"
        >
          <mat-expansion-panel
            *ngFor="let category of categories; trackBy: trackByCategoryId"
            class="category-panel"
            cdkDrag
            [expanded]="expandedCategoryId === category.id"
            (opened)="expandedCategoryId = category.id"
            (closed)="expandedCategoryId = null"
          >
            <mat-expansion-panel-header>
              <mat-panel-title>
                <div class="category-title">
                  <div class="category-title-row">
                    <mat-icon cdkDragHandle class="drag-handle"
                      >drag_indicator</mat-icon
                    >
                    <span class="category-name">{{ category.name }}</span>
                  </div>
                  <div class="category-meta">
                    <div class="status-indicator">
                      <div
                        class="status-dot"
                        [class]="
                          category.is_active
                            ? 'status-active'
                            : 'status-inactive'
                        "
                      ></div>
                    </div>
                    <mat-chip class="chip-count">
                      {{ category.product_count }}
                    </mat-chip>
                  </div>
                </div>
              </mat-panel-title>
              <mat-panel-description>
                {{ category.description || 'Aucune description' }}
              </mat-panel-description>
            </mat-expansion-panel-header>

            <!-- Category Content -->
            <div class="category-content">
              <!-- Category Actions -->
              <div class="category-actions">
                <button
                  mat-button
                  color="primary"
                  (click)="openCategoryDialog(category)"
                >
                  <mat-icon>edit</mat-icon>
                  Modifier la catégorie
                </button>
                <button
                  mat-button
                  color="warn"
                  (click)="deleteCategory(category)"
                  [disabled]="category.product_count > 0"
                  [matTooltip]="
                    category.product_count > 0
                      ? 'Supprimez tous les produits avant de supprimer la catégorie'
                      : 'Supprimer la catégorie'
                  "
                >
                  <mat-icon>delete</mat-icon>
                  Supprimer
                </button>
              </div>

              <!-- Products in Category -->
              <div class="products-section">
                <div class="products-header">
                  <h4>
                    <mat-icon>inventory_2</mat-icon>
                    Produits dans cette catégorie
                  </h4>

                  <!-- Add Product Autocomplete -->
                  <div class="add-product-form">
                    <mat-form-field
                      appearance="fill"
                      class="product-autocomplete"
                    >
                      <mat-label>Ajouter un produit</mat-label>
                      <input
                        matInput
                        [formControl]="getProductSearchControl(category.id)"
                        [matAutocomplete]="auto"
                        placeholder="Rechercher un produit à ajouter..."
                      />
                      <mat-autocomplete
                        #auto="matAutocomplete"
                        [displayWith]="displayProduct"
                        (optionSelected)="
                          addProductToCategory(category.id, $event.option.value)
                        "
                      >
                        <mat-option
                          *ngFor="
                            let product of getFilteredProducts(category.id)
                              | async
                          "
                          [value]="product"
                        >
                          <div class="product-option">
                            <span class="product-name">{{ product.name }}</span>
                            <span class="product-price">{{
                              product.price
                                | currency : 'EUR' : 'symbol' : '1.2-2' : 'fr'
                            }}</span>
                          </div>
                        </mat-option>
                      </mat-autocomplete>
                    </mat-form-field>
                  </div>
                </div>

                <!-- Products List -->
                <div class="products-list" *ngIf="category.products.length > 0">
                  <mat-card
                    class="product-card"
                    *ngFor="
                      let product of category.products;
                      trackBy: trackByProductId
                    "
                  >
                    <div class="product-header">
                      <div class="product-info">
                        <h5>{{ product.name }}</h5>
                        <p class="product-description">
                          {{
                            product.short_description || 'Aucune description'
                          }}
                        </p>
                      </div>
                      <div class="product-image" *ngIf="product.image_url">
                        <img [src]="product.image_url" [alt]="product.name" />
                      </div>
                    </div>

                    <div class="product-meta">
                      <div class="product-chips">
                        <mat-chip class="chip-price">
                          {{
                            product.price
                              | currency : 'EUR' : 'symbol' : '1.2-2' : 'fr'
                          }}
                        </mat-chip>
                        <mat-chip
                          [class]="
                            product.is_available
                              ? 'chip-available'
                              : 'chip-unavailable'
                          "
                        >
                          {{
                            product.is_available ? 'Disponible' : 'Indisponible'
                          }}
                        </mat-chip>
                        <mat-chip
                          [class]="
                            product.is_multi_step ? 'chip-menu' : 'chip-product'
                          "
                        >
                          {{ product.is_multi_step ? 'Menu' : 'Produit' }}
                        </mat-chip>
                        <mat-chip
                          class="chip-stock"
                          *ngIf="product.stock_quantity !== null"
                        >
                          Stock: {{ product.stock_quantity }}
                        </mat-chip>
                      </div>
                    </div>

                    <div class="product-actions">
                      <button
                        mat-button
                        color="warn"
                        (click)="
                          removeProductFromCategory(category.id, product)
                        "
                        matTooltip="Retirer de cette catégorie"
                      >
                        <mat-icon>remove</mat-icon>
                        Retirer
                      </button>
                    </div>
                  </mat-card>
                </div>

                <div class="no-products" *ngIf="category.products.length === 0">
                  <mat-icon>inventory_2</mat-icon>
                  <h5>Aucun produit dans cette catégorie</h5>
                  <p>
                    Utilisez l'autocomplétion ci-dessus pour ajouter des
                    produits
                  </p>
                </div>
              </div>
            </div>
          </mat-expansion-panel>
        </mat-accordion>

        <!-- Empty State -->
        <div class="empty-state" *ngIf="categories.length === 0">
          <mat-icon>category</mat-icon>
          <h3>Aucune catégorie trouvée</h3>
          <p>Créez votre première catégorie pour organiser vos produits</p>
          <button
            mat-raised-button
            color="primary"
            (click)="openCategoryDialog()"
          >
            <mat-icon>add</mat-icon>
            Créer ma première catégorie
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .category-manager {
        padding: 24px;
        background: var(--mat-sys-surface-dim);
        min-height: 100vh;
      }

      .manager-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 32px;
        background: var(--mat-sys-surface);
        padding: 24px;
        border-radius: 12px;
        box-shadow: var(--mat-sys-elevation-level1);
      }

      .header-content h2 {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--mat-sys-on-surface);
      }

      .subtitle {
        margin: 8px 0 0 0;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.875rem;
      }

      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 64px;
        color: var(--mat-sys-on-surface-variant);
      }

      .categories-container {
        max-width: 1200px;
        margin: 0 auto;
      }

      .categories-accordion {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .category-panel {
        border-radius: 12px;
        box-shadow: var(--mat-sys-elevation-level1);
      }

      .category-title {
        display: flex;
        gap: 8px;
        flex: 1;
        justify-content: space-between;
      }

      .category-title-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .category-name {
        font-weight: 500;
        font-size: 1.1rem;
      }

      .category-meta {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        min-width: 60px;
        align-items: center;
      }

      .status-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .status-active {
        background-color: #4caf50; /* Green for active */
      }

      .status-inactive {
        background-color: #f44336; /* Red for inactive */
      }

      .chip-count {
        background: var(--mat-sys-secondary-container);
        color: var(--mat-sys-on-secondary-container);
        font-size: 0.75rem;
        min-height: 24px;
      }

      .category-content {
        padding: 24px 0;
      }

      .category-actions {
        display: flex;
        gap: 12px;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }

      .products-section {
        margin-top: 16px;
      }

      .products-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 16px;
        gap: 16px;
      }

      .products-header h4 {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--mat-sys-on-surface);
      }

      .add-product-form {
        min-width: 300px;
      }

      .product-autocomplete {
        width: 100%;
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

      .products-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 16px;
      }

      .product-card {
        border-radius: 8px;
      }

      .product-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;
      }

      .product-info {
        flex: 1;
      }

      .product-info h5 {
        margin: 0 0 4px 0;
        font-weight: 500;
      }

      .product-description {
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.875rem;
        line-height: 1.4;
      }

      .product-image {
        width: 60px;
        height: 60px;
        border-radius: 8px;
        overflow: hidden;
        margin-left: 12px;
      }

      .product-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .product-meta {
        margin-bottom: 16px;
      }

      .product-chips {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .chip-price {
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
        font-weight: 500;
      }

      .chip-available {
        background: var(--mat-sys-tertiary-container);
        color: var(--mat-sys-on-tertiary-container);
      }

      .chip-unavailable {
        background: var(--mat-sys-error-container);
        color: var(--mat-sys-on-error-container);
      }

      .chip-menu {
        background: var(--mat-sys-secondary-container);
        color: var(--mat-sys-on-secondary-container);
      }

      .chip-product {
        background: var(--mat-sys-surface-variant);
        color: var(--mat-sys-on-surface-variant);
      }

      .chip-stock {
        background: var(--mat-sys-outline-variant);
        color: var(--mat-sys-on-surface);
      }

      .product-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      .no-products {
        text-align: center;
        padding: 48px 24px;
        color: var(--mat-sys-on-surface-variant);
        background: var(--mat-sys-surface-variant);
        border-radius: 8px;
      }

      .no-products mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        color: var(--mat-sys-outline);
      }

      .no-products h5 {
        margin: 0 0 8px 0;
      }

      .no-products p {
        margin: 0;
        font-size: 0.875rem;
      }

      .empty-state {
        text-align: center;
        padding: 64px 24px;
        color: var(--mat-sys-on-surface-variant);
      }

      .empty-state mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: var(--mat-sys-outline);
        margin-bottom: 24px;
      }

      .empty-state h3 {
        margin: 0 0 12px 0;
      }

      .empty-state p {
        margin: 0 0 24px 0;
        font-size: 0.875rem;
      }

      .drag-handle {
        cursor: grab;
        color: var(--mat-sys-on-surface-variant);
        margin-right: 8px;
        font-size: 18px;
      }

      .drag-handle:active {
        cursor: grabbing;
      }

      .cdk-drag-preview {
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
        border-radius: 12px;
      }

      .cdk-drag-placeholder {
        opacity: 0.4;
      }

      @media (max-width: 768px) {
        .category-manager {
          padding: 16px;
        }

        .manager-header {
          flex-direction: column;
          gap: 16px;
          align-items: stretch;
        }

        .products-header {
          flex-direction: column;
          align-items: stretch;
        }

        .add-product-form {
          min-width: auto;
        }

        .products-list {
          grid-template-columns: 1fr;
        }

        .product-header {
          flex-direction: column;
          gap: 12px;
        }

        .product-image {
          align-self: center;
          margin-left: 0;
        }

        .category-actions {
          flex-direction: column;
        }

        .product-actions {
          justify-content: stretch;
        }

        .product-actions button {
          flex: 1;
        }
      }
    `,
  ],
})
export class CategoryListComponent implements OnInit, OnDestroy {
  private productAdminService = inject(ProductAdminService);
  private vendorService = inject(VendorService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  categories: any[] = [];
  allProducts: ProductAdmin[] = [];
  loading = false;
  expandedCategoryId: number | null = null;
  currentVendorId: string | null = null;

  // Product search controls for each category
  productSearchControls: { [categoryId: number]: FormControl } = {};
  filteredProducts: { [categoryId: number]: Observable<ProductAdmin[]> } = {};

  ngOnInit() {
    this.loadCurrentVendor();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCurrentVendor() {
    console.log('CategoryListComponent: Loading current vendor...');
    this.vendorService.currentVendor$
      .pipe(takeUntil(this.destroy$))
      .subscribe((vendor) => {
        console.log('CategoryListComponent: Vendor received:', vendor);
        if (vendor) {
          this.currentVendorId = vendor.id;
          console.log(
            'CategoryListComponent: Setting vendor ID:',
            this.currentVendorId
          );
          this.loadData();
        } else {
          console.log('CategoryListComponent: No vendor available');
        }
      });
  }

  loadData() {
    if (!this.currentVendorId) return;

    this.loading = true;

    // Load both categories and all products
    Promise.all([this.loadCategories(), this.loadAllProducts()])
      .then(() => {
        this.loading = false;
        this.setupProductSearchControls();
      })
      .catch((error) => {
        console.error('Error loading data:', error);
        this.loading = false;
      });
  }

  loadCategories(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.productAdminService
        .getCategoriesWithProducts(this.currentVendorId!)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (categories) => {
            console.log(
              'CategoryListComponent: Categories loaded successfully:',
              categories
            );
            this.categories = categories;
            resolve();
          },
          error: (error: any) => {
            console.error(
              'CategoryListComponent: Error loading categories:',
              error
            );
            this.snackBar.open(
              'Erreur lors du chargement des catégories',
              'Fermer',
              {
                duration: 5000,
              }
            );
            reject(error);
          },
        });
    });
  }

  loadAllProducts(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.productAdminService
        .getProducts(this.currentVendorId!)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (products) => {
            this.allProducts = products;
            resolve();
          },
          error: (error: any) => {
            console.error('Error loading all products:', error);
            reject(error);
          },
        });
    });
  }

  setupProductSearchControls() {
    this.categories.forEach((category) => {
      if (!this.productSearchControls[category.id]) {
        this.productSearchControls[category.id] = new FormControl('');
        this.filteredProducts[category.id] = this.productSearchControls[
          category.id
        ].valueChanges.pipe(
          startWith(''),
          map((value) => this._filterProducts(value, category.id))
        );
      }
    });
  }

  getProductSearchControl(categoryId: number): FormControl {
    if (!this.productSearchControls[categoryId]) {
      this.productSearchControls[categoryId] = new FormControl('');
      this.filteredProducts[categoryId] = this.productSearchControls[
        categoryId
      ].valueChanges.pipe(
        startWith(''),
        map((value) => this._filterProducts(value, categoryId))
      );
    }
    return this.productSearchControls[categoryId];
  }

  getFilteredProducts(categoryId: number): Observable<ProductAdmin[]> {
    return this.filteredProducts[categoryId] || new Observable();
  }

  private _filterProducts(
    value: string | ProductAdmin | null | unknown,
    categoryId: number
  ): ProductAdmin[] {
    const filterValue =
      typeof value === 'string'
        ? value.toLowerCase()
        : typeof value === 'object' && value && 'name' in value
        ? (value as ProductAdmin).name.toLowerCase()
        : '';

    // Get products not already in this category
    const category = this.categories.find((c) => c.id === categoryId);
    const categoryProductIds = category?.products?.map((p: any) => p.id) || [];

    return this.allProducts.filter(
      (product) =>
        !categoryProductIds.includes(product.id) &&
        product.name.toLowerCase().includes(filterValue)
    );
  }

  displayProduct(product: ProductAdmin): string {
    return product ? product.name : '';
  }

  addProductToCategory(categoryId: number, product: ProductAdmin) {
    this.productAdminService
      .updateProductCategory(product.id, categoryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open('Produit ajouté à la catégorie', 'Fermer', {
            duration: 3000,
          });
          this.productSearchControls[categoryId].setValue('');
          this.loadCategories(); // Refresh categories
        },
        error: (error: any) => {
          console.error('Error adding product to category:', error);
          this.snackBar.open("Erreur lors de l'ajout", 'Fermer', {
            duration: 5000,
          });
        },
      });
  }

  removeProductFromCategory(categoryId: number, product: ProductAdmin) {
    this.productAdminService
      .updateProductCategory(product.id, null)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open('Produit retiré de la catégorie', 'Fermer', {
            duration: 3000,
          });
          this.loadCategories(); // Refresh categories
        },
        error: (error: any) => {
          console.error('Error removing product from category:', error);
          this.snackBar.open('Erreur lors du retrait', 'Fermer', {
            duration: 5000,
          });
        },
      });
  }

  openCategoryDialog(category?: any) {
    const dialogRef = this.dialog.open(CategoryEditDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      data: { category },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadCategories(); // Refresh categories
      }
    });
  }

  deleteCategory(category: any) {
    if (category.product_count > 0) {
      this.snackBar.open(
        'Impossible de supprimer une catégorie contenant des produits',
        'Fermer',
        {
          duration: 5000,
        }
      );
      return;
    }

    if (
      confirm(
        `Êtes-vous sûr de vouloir supprimer la catégorie "${category.name}" ?`
      )
    ) {
      this.productAdminService
        .deleteCategory(category.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.snackBar.open('Catégorie supprimée avec succès', 'Fermer', {
              duration: 3000,
            });
            this.loadCategories(); // Refresh categories
          },
          error: (error: any) => {
            console.error('Error deleting category:', error);
            this.snackBar.open('Erreur lors de la suppression', 'Fermer', {
              duration: 5000,
            });
          },
        });
    }
  }

  onCategoryDrop(event: CdkDragDrop<any[]>) {
    if (event.previousIndex === event.currentIndex) {
      return; // No change in position
    }

    // Store the original order in case we need to revert
    const originalCategories = [...this.categories];

    // Update the UI immediately
    moveItemInArray(this.categories, event.previousIndex, event.currentIndex);

    // Update expanded category index if needed
    if (this.expandedCategoryId) {
      const movedCategory = originalCategories[event.previousIndex];
      if (movedCategory.id === this.expandedCategoryId) {
        // The expanded category was moved, keep it expanded
        this.expandedCategoryId = movedCategory.id;
      }
    }

    // Save the new order to the backend
    this.productAdminService
      .reorderCategories(
        this.currentVendorId!,
        this.categories.map((c) => c.id)
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open('Ordre des catégories mis à jour', 'Fermer', {
            duration: 3000,
            panelClass: ['success-snackbar'],
          });
        },
        error: (error: any) => {
          console.error('Error reordering categories:', error);
          this.snackBar.open('Erreur lors de la réorganisation', 'Fermer', {
            duration: 5000,
            panelClass: ['error-snackbar'],
          });
          // Revert to the original order
          this.categories = originalCategories;
        },
      });
  }

  trackByCategoryId(index: number, category: any): number {
    return category.id;
  }

  trackByProductId(index: number, product: ProductAdmin): number {
    return product.id;
  }
}

// Category Edit Dialog Component
@Component({
  selector: 'app-category-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatIconModule,
    ImageUploadComponent,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ isEditMode ? 'edit' : 'add' }}</mat-icon>
      {{ isEditMode ? 'Modifier la catégorie' : 'Nouvelle catégorie' }}
    </h2>

    <mat-dialog-content>
      <form [formGroup]="categoryForm" class="category-form">
        <mat-form-field appearance="fill">
          <mat-label>Nom de la catégorie</mat-label>
          <input matInput formControlName="name" placeholder="Ex: Boissons" />
          <mat-error *ngIf="categoryForm.get('name')?.hasError('required')">
            Le nom est requis
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="fill">
          <mat-label>Description</mat-label>
          <textarea
            matInput
            formControlName="description"
            rows="3"
            placeholder="Description de la catégorie (optionnel)"
          ></textarea>
        </mat-form-field>

        <app-image-upload
          formControlName="image_url"
          label="Image de la catégorie"
          placeholder="https://..."
        ></app-image-upload>

        <mat-form-field appearance="fill">
          <mat-label>Ordre d'affichage</mat-label>
          <input
            matInput
            type="number"
            formControlName="display_order"
            placeholder="0"
          />
        </mat-form-field>

        <div class="form-toggle">
          <mat-slide-toggle formControlName="is_active">
            Catégorie active
          </mat-slide-toggle>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions>
      <button mat-button mat-dialog-close>Annuler</button>
      <button
        mat-raised-button
        color="primary"
        (click)="saveCategory()"
        [disabled]="categoryForm.invalid || saving"
      >
        <mat-icon>{{ saving ? 'hourglass_empty' : 'save' }}</mat-icon>
        {{ isEditMode ? 'Mettre à jour' : 'Créer' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .category-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 400px;
      }

      .form-toggle {
        padding: 8px 0;
      }

      mat-dialog-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
    `,
  ],
})
export class CategoryEditDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private productAdminService = inject(ProductAdminService);
  private snackBar = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<CategoryEditDialogComponent>);

  data = inject(MAT_DIALOG_DATA);

  categoryForm: FormGroup;
  isEditMode = false;
  saving = false;

  constructor() {
    this.categoryForm = this.createForm();
  }

  ngOnInit() {
    this.isEditMode = !!this.data.category;
    if (this.isEditMode) {
      this.categoryForm.patchValue(this.data.category);
    }
  }

  createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required]],
      description: [''],
      image_url: [''],
      display_order: [0],
      is_active: [true],
    });
  }

  saveCategory() {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    const formData = this.categoryForm.value;

    const operation = this.isEditMode
      ? this.productAdminService.updateCategory(this.data.category.id, formData)
      : this.productAdminService.createCategory(formData);

    operation.subscribe({
      next: () => {
        this.snackBar.open(
          this.isEditMode
            ? 'Catégorie modifiée avec succès'
            : 'Catégorie créée avec succès',
          'Fermer',
          { duration: 3000 }
        );
        this.dialogRef.close(true);
      },
      error: (error: any) => {
        console.error('Error saving category:', error);
        this.snackBar.open('Erreur lors de la sauvegarde', 'Fermer', {
          duration: 5000,
        });
        this.saving = false;
      },
    });
  }
}
