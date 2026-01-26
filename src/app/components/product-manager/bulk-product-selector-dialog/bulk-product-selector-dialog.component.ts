import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, combineLatest, map, startWith } from 'rxjs';
import { ProductAdmin, Category } from '../../../models/product-admin.interface';

export interface BulkSelectorDialogData {
  products: ProductAdmin[];
  alreadySelectedProductIds: number[];
  stepName: string;
  categories: Category[];
}

export interface BulkSelectorResult {
  selectedProducts: ProductAdmin[];
}

@Component({
  selector: 'app-bulk-product-selector-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatSelectModule,
    MatTableModule,
    MatSortModule,
    MatBadgeModule,
    MatTooltipModule,
  ],
  template: `
    <!-- Header -->
    <div class="dialog-header">
      <h2 mat-dialog-title>
        <mat-icon>playlist_add</mat-icon>
        <span>Ajouter des produits à l'étape : {{ data.stepName }}</span>
      </h2>
      <button mat-icon-button mat-dialog-close>
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <div mat-dialog-content class="dialog-content">
      <!-- Filters -->
      <div class="filter-row">
        <mat-form-field appearance="outline" class="category-field">
          <mat-label>Catégorie</mat-label>
          <mat-select [formControl]="categoryControl">
            <mat-option [value]="null">Toutes les catégories</mat-option>
            <mat-option *ngFor="let cat of data.categories" [value]="cat.id">
              {{ cat.name }}
            </mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Rechercher des produits</mat-label>
          <input
            matInput
            [formControl]="searchControl"
            placeholder="Tapez le nom du produit..."
          />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
      </div>


      <!-- Products Table -->
      <div class="table-container" *ngIf="filteredProducts$ | async as filteredProducts">
        <table
          mat-table
          [dataSource]="sortedProducts(filteredProducts)"
          matSort
          (matSortChange)="onSortChange($event)"
          class="products-table"
          *ngIf="filteredProducts.length > 0"
        >
          <!-- Checkbox Column -->
          <ng-container matColumnDef="select">
            <th mat-header-cell *matHeaderCellDef class="col-select">
              <mat-checkbox
                [checked]="areAllFilteredSelected(filteredProducts)"
                [indeterminate]="selectedProducts.size > 0 && !areAllFilteredSelected(filteredProducts)"
                (change)="toggleSelectAll(filteredProducts)"
              ></mat-checkbox>
            </th>
            <td mat-cell *matCellDef="let product" class="col-select">
              <mat-checkbox
                [checked]="selectedProducts.has(product.id)"
                [disabled]="isProductAlreadyInStep(product.id)"
                (change)="toggleProduct(product)"
                (click)="onCheckboxClick($event)"
              ></mat-checkbox>
            </td>
          </ng-container>

          <!-- Product Column (image + name) -->
          <ng-container matColumnDef="product">
            <th mat-header-cell *matHeaderCellDef mat-sort-header="product"> Sélectionner tout ( {{ getSelectableFilteredProductsCount() }} produit )</th>
            <td mat-cell *matCellDef="let product" class="col-product">
              <div class="product-cell">
                <div class="product-thumb" *ngIf="product.image_url">
                  <img [src]="product.image_url" [alt]="product.name" loading="lazy" />
                </div>
                <div class="product-thumb fallback" *ngIf="!product.image_url">
                  <mat-icon>restaurant</mat-icon>
                </div>
                <div class="product-text">
                  <span class="product-name">{{ product.name }}</span>
                  <span class="product-category-inline">
                    {{ product.category_name || 'Sans catégorie' }}
                  </span>
                </div>
              </div>
            </td>
          </ng-container>

          <!-- Category Column (hidden on mobile) -->
          <ng-container matColumnDef="category">
            <th mat-header-cell *matHeaderCellDef mat-sort-header="category">Catégorie</th>
            <td mat-cell *matCellDef="let product" class="col-category">
              {{ product.category_name || 'Sans catégorie' }}
            </td>
          </ng-container>

          <!-- Price Column -->
          <ng-container matColumnDef="price">
            <th mat-header-cell *matHeaderCellDef mat-sort-header="price">Prix</th>
            <td mat-cell *matCellDef="let product" class="col-price">
              {{ product.price | currency : 'EUR' : 'symbol' : '1.2-2' : 'fr' }}
            </td>
          </ng-container>

          <!-- Status Column -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef class="col-status"></th>
            <td mat-cell *matCellDef="let product" class="col-status">
              <span
                class="status-badge already-in-step"
                *ngIf="isProductAlreadyInStep(product.id)"
                matTooltip="Ce produit est déjà dans cette étape"
              >
                <mat-icon>check_circle</mat-icon>
                <span class="status-text">Déjà ajouté</span>
              </span>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns; sticky: true"></tr>
          <tr
            mat-row
            *matRowDef="let product; columns: displayedColumns"
            class="product-row"
            [class.selected]="selectedProducts.has(product.id)"
            [class.disabled]="isProductAlreadyInStep(product.id)"
            (click)="!isProductAlreadyInStep(product.id) && toggleProduct(product)"
          ></tr>
        </table>

        <!-- Empty State -->
        <div class="empty-state" *ngIf="filteredProducts.length === 0">
          <mat-icon>search_off</mat-icon>
          <h3>Aucun produit trouvé</h3>
          <p>Aucun produit ne correspond à votre recherche</p>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div mat-dialog-actions class="dialog-actions">
      <button mat-button mat-dialog-close>Annuler</button>
      <button
        matButton="filled"
        color="primary"
        (click)="addSelectedProducts()"
        [disabled]="selectedProducts.size === 0"
      >
        <mat-icon>add</mat-icon>
        Ajouter {{ selectedProducts.size }} produit(s)
      </button>
    </div>
  `,
  styles: [
    `
      /* ── Header ── */
      .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 8px;
      }

      .dialog-header h2 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 1.2rem;
        font-weight: 600;
        flex-wrap: wrap;
        line-height: 1.3;
      }

      .dialog-header h2 span {
        word-wrap: break-word;
        overflow-wrap: break-word;
      }

      /* ── Content ── */
      .dialog-content {
        min-width: 640px;
        max-width: 860px;
        max-height: 70vh;
        overflow-y: auto;
        padding-bottom: 0;
      }

      /* ── Filters ── */
      .filter-row {
        display: flex;
        gap: 12px;
        margin-bottom: 12px;
      }

      .category-field {
        min-width: 200px;
      }

      .search-field {
        flex: 1;
      }

      /* ── Selection Summary ── */
      .selection-summary {
        background: var(--mat-sys-primary-container, #e8def8);
        border-radius: 12px;
        padding: 14px 16px;
        margin-bottom: 12px;
      }

      .summary-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }

      .summary-stats {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .stat-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        background: var(--mat-sys-primary, #6750a4);
        color: var(--mat-sys-on-primary, #fff);
        border-radius: 20px;
        padding: 4px 14px;
        font-size: 0.85rem;
        font-weight: 500;
      }

      .stat-badge.available {
        background: var(--mat-sys-on-primary-container, #1d1b20);
        color: var(--mat-sys-primary-container, #e8def8);
      }

      .stat-number {
        font-weight: 700;
        font-size: 1rem;
      }

      .action-buttons {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .action-btn {
        font-size: 0.8rem;
        line-height: 1;
      }

      .deselect-btn {
        border-color: var(--mat-sys-error, #b3261e);
        color: var(--mat-sys-error, #b3261e);
      }


      /* ── Table ── */
      .table-container {
        border: 1px solid var(--mat-sys-outline-variant, #cac4d0);
        border-radius: 12px;
        overflow: auto;
        min-height: 200px;
        -webkit-overflow-scrolling: touch;
      }

      .products-table {
        width: 100%;
      }

      /* column widths */
      .col-select {
        width: 48px;
        padding-left: 8px !important;
        padding-right: 4px !important;
      }

      .col-product {
        min-width: 180px;
      }

      .col-category {
        width: 160px;
      }

      .col-price {
        width: 90px;
        text-align: right !important;
        padding-right: 16px !important;
        font-weight: 600;
        color: var(--mat-sys-primary, #6750a4);
      }

      .col-status {
        width: 120px;
        text-align: center !important;
      }

      /* Product cell with thumbnail */
      .product-cell {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 6px 0;
      }

      .product-thumb {
        width: 40px;
        height: 40px;
        min-width: 40px;
        border-radius: 8px;
        overflow: hidden;
        background: var(--mat-sys-surface-variant, #e7e0ec);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .product-thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .product-thumb.fallback mat-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
        color: var(--mat-sys-on-surface-variant, #49454f);
        opacity: 0.5;
      }

      .product-text {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
      }

      .product-name {
        font-weight: 600;
        font-size: 0.9rem;
        color: var(--mat-sys-on-surface, #1d1b20);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Inline category shown under product name — hidden by default, visible on small screens if needed */
      .product-category-inline {
        display: none;
      }

      /* Row states */
      .product-row {
        cursor: pointer;
        transition: background 0.15s ease;
      }

      .product-row:hover:not(.disabled) {
        background: var(--mat-sys-surface-container, #f3edf7) !important;
      }

      .product-row.selected {
        background: color-mix(in srgb, var(--mat-sys-primary-container, #e8def8) 50%, transparent) !important;
      }

      .product-row.selected:hover {
        background: color-mix(in srgb, var(--mat-sys-primary-container, #e8def8) 70%, transparent) !important;
      }

      .product-row.disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      /* Status badge */
      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 10px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 500;
        white-space: nowrap;
      }

      .status-badge.already-in-step {
        background: var(--mat-sys-tertiary-container, #ffd8e4);
        color: var(--mat-sys-on-tertiary-container, #31111d);
      }

      .status-badge mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }

      /* ── Empty State ── */
      .empty-state {
        text-align: center;
        padding: 48px 24px;
        color: var(--mat-sys-on-surface-variant, #49454f);
      }

      .empty-state mat-icon {
        font-size: 56px;
        width: 56px;
        height: 56px;
        margin-bottom: 12px;
        color: var(--mat-sys-outline, #79747e);
      }

      .empty-state h3 {
        margin: 0 0 6px 0;
        font-weight: 500;
      }

      .empty-state p {
        margin: 0;
        font-size: 0.9rem;
      }

      /* ── Actions ── */
      .dialog-actions {
        padding-top: 12px;
        gap: 8px;
      }

      /* ── Mobile ── */
      @media (max-width: 768px) {
        .dialog-content {
          min-width: unset;
          max-width: unset;
          width: 100%;
        }

        .filter-row {
          flex-direction: column;
          gap: 0;
        }

        .category-field {
          min-width: unset;
          width: 100%;
        }

        .dialog-header {
          flex-wrap: wrap;
        }

        .dialog-header h2 {
          flex: 1;
          min-width: 0;
          font-size: 1rem;
        }

        .dialog-header h2 span {
          flex: 1;
          min-width: 0;
        }

        /* Horizontal scroll for the table */
        .table-container {
          overflow-x: auto;
          overflow-y: hidden;
          border-radius: 12px;
        }

        .products-table {
          min-width: 600px;
        }

        /* Smaller thumbnails */
        .product-thumb {
          width: 36px;
          height: 36px;
          min-width: 36px;
          border-radius: 6px;
        }

        .product-name {
          font-size: 0.85rem;
        }

        /* Adjust price column */
        .col-price {
          width: 70px;
          font-size: 0.85rem;
        }

        /* Selection summary */
        .selection-summary {
          padding: 10px 12px;
        }

        .summary-top {
          flex-direction: column;
          align-items: stretch;
          gap: 8px;
        }

        .summary-stats {
          justify-content: flex-start;
        }

        .action-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: stretch;
        }

        .action-btn {
          flex: 1;
          min-width: 0;
          font-size: 0.78rem;
          white-space: nowrap;
        }
      }

      /* ── Small mobile (< 400px) ── */
      @media (max-width: 400px) {
        .product-thumb {
          display: none;
        }
      }
    `,
  ],
})
export class BulkProductSelectorDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<BulkProductSelectorDialogComponent>);

  searchControl = new FormControl('');
  categoryControl = new FormControl<number | null>(null);
  selectedProducts = new Set<number>();
  filteredProducts$!: Observable<ProductAdmin[]>;

  displayedColumns = ['select', 'product', 'category', 'price', 'status'];
  currentSort: Sort = { active: '', direction: '' };

  constructor(@Inject(MAT_DIALOG_DATA) public data: BulkSelectorDialogData) {}

  ngOnInit() {
    this.filteredProducts$ = combineLatest([
      this.searchControl.valueChanges.pipe(startWith('')),
      this.categoryControl.valueChanges.pipe(startWith(null as number | null)),
    ]).pipe(
      map(([searchTerm, categoryId]) =>
        this.filterProducts(searchTerm || '', categoryId)
      )
    );
  }

  private filterProducts(searchTerm: string, categoryId?: number | null): ProductAdmin[] {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return this.data.products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(lowerSearchTerm) ||
        product.category_name?.toLowerCase().includes(lowerSearchTerm) ||
        false;
      const matchesCategory = categoryId == null || product.category_id === categoryId;
      return matchesSearch && matchesCategory;
    });
  }

  sortedProducts(products: ProductAdmin[]): ProductAdmin[] {
    if (!this.currentSort.active || this.currentSort.direction === '') {
      return products;
    }

    return [...products].sort((a, b) => {
      const isAsc = this.currentSort.direction === 'asc';
      switch (this.currentSort.active) {
        case 'product':
          return compare(a.name.toLowerCase(), b.name.toLowerCase(), isAsc);
        case 'category':
          return compare(
            (a.category_name || '').toLowerCase(),
            (b.category_name || '').toLowerCase(),
            isAsc
          );
        case 'price':
          return compare(a.price, b.price, isAsc);
        default:
          return 0;
      }
    });
  }

  onSortChange(sort: Sort): void {
    this.currentSort = sort;
  }

  getSelectedCategoryName(): string | null {
    const categoryId = this.categoryControl.value;
    if (categoryId == null) return null;
    const category = this.data.categories.find((c) => c.id === categoryId);
    return category?.name || null;
  }

  toggleProduct(product: ProductAdmin): void {
    if (this.isProductAlreadyInStep(product.id)) {
      return;
    }

    if (this.selectedProducts.has(product.id)) {
      this.selectedProducts.delete(product.id);
    } else {
      this.selectedProducts.add(product.id);
    }
  }

  areAllFilteredSelected(filteredProducts: ProductAdmin[]): boolean {
    const selectable = filteredProducts.filter(
      (p) => !this.isProductAlreadyInStep(p.id)
    );
    if (selectable.length === 0) return false;
    return selectable.every((p) => this.selectedProducts.has(p.id));
  }

  toggleSelectAll(filteredProducts: ProductAdmin[]): void {
    if (this.areAllFilteredSelected(filteredProducts)) {
      // Deselect all filtered
      filteredProducts.forEach((p) => {
        if (!this.isProductAlreadyInStep(p.id)) {
          this.selectedProducts.delete(p.id);
        }
      });
    } else {
      // Select all filtered
      filteredProducts.forEach((p) => {
        if (!this.isProductAlreadyInStep(p.id)) {
          this.selectedProducts.add(p.id);
        }
      });
    }
  }

  isProductAlreadyInStep(productId: number): boolean {
    return this.data.alreadySelectedProductIds.includes(productId);
  }

  clearSelection(): void {
    this.selectedProducts.clear();
  }

  getSelectedProductsList(): ProductAdmin[] {
    return this.data.products.filter((product) =>
      this.selectedProducts.has(product.id)
    );
  }

  getSelectableFilteredProductsCount(): number {
    const searchTerm = this.searchControl.value || '';
    const categoryId = this.categoryControl.value;
    const filteredProducts = this.filterProducts(searchTerm, categoryId);
    return filteredProducts.filter(
      (product) => !this.isProductAlreadyInStep(product.id)
    ).length;
  }

  hasSelectableFilteredProducts(): boolean {
    return this.getSelectableFilteredProductsCount() > 0;
  }

  addSelectedProducts(): void {
    const selectedProducts = this.getSelectedProductsList();
    this.dialogRef.close({ selectedProducts });
  }

  onCheckboxClick(event: Event): void {
    event.stopPropagation();
  }

  trackByProductId(index: number, product: ProductAdmin): number {
    return product.id;
  }

  selectAllFilteredProducts(): void {
    const searchTerm = this.searchControl.value || '';
    const categoryId = this.categoryControl.value;
    const filteredProducts = this.filterProducts(searchTerm, categoryId);

    filteredProducts.forEach((product) => {
      if (!this.isProductAlreadyInStep(product.id)) {
        this.selectedProducts.add(product.id);
      }
    });
  }
}

function compare(a: string | number, b: string | number, isAsc: boolean): number {
  return (a < b ? -1 : a > b ? 1 : 0) * (isAsc ? 1 : -1);
}
