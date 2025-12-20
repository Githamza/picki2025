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
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { Observable, map, startWith } from 'rxjs';
import { ProductAdmin } from '../../../models/product-admin.interface';

export interface BulkSelectorDialogData {
  products: ProductAdmin[];
  alreadySelectedProductIds: number[];
  stepName: string;
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
    MatListModule,
    MatCardModule,
    MatChipsModule,
  ],
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>
        <mat-icon>playlist_add</mat-icon>
       <span> Ajouter des produits à l'étape : {{ data.stepName }} </span>
      </h2>
      <button mat-icon-button mat-dialog-close>
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <div mat-dialog-content class="dialog-content">
      <!-- Search Filter -->
      <mat-form-field appearance="fill" class="search-field">
        <mat-label>Rechercher des produits</mat-label>
        <input
          matInput
          [formControl]="searchControl"
          placeholder="Tapez le nom du produit..."
        />
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>

      <!-- Selection Summary -->
      <div class="selection-summary" *ngIf="hasSelectableFilteredProducts()">
        <div class="summary-header">
          <span class="count" *ngIf="selectedProducts.size > 0"
            >{{ selectedProducts.size }} produit(s) sélectionné(s)</span
          >
          <span class="count" *ngIf="selectedProducts.size === 0"
            >{{ getSelectableFilteredProductsCount() }} produit(s) disponible(s)</span
          >
          <div class="action-buttons">
            <button 
              mat-button 
              color="warn" 
              (click)="clearSelection()"
              *ngIf="selectedProducts.size > 0"
            >
              <mat-icon>clear_all</mat-icon>
              Tout désélectionner
            </button>
            <button mat-button color="primary" (click)="selectAllFilteredProducts()">
              <mat-icon>select_all</mat-icon>
              Tout sélectionner
            </button>
          </div>
        </div>
        <div class="selected-chips" *ngIf="selectedProducts.size > 0">
          <mat-chip
            *ngFor="let product of getSelectedProductsList()"
            (removed)="toggleProduct(product)"
            removable
          >
            {{ product.name }}
            <mat-icon matChipRemove>cancel</mat-icon>
          </mat-chip>
        </div>
      </div>

      <!-- Products List -->
      <div class="products-container">
        <div
          class="products-grid"
          *ngIf="filteredProducts$ | async as filteredProducts"
        >
          <mat-card
            *ngFor="let product of filteredProducts; trackBy: trackByProductId"
            class="product-card"
            [class.selected]="selectedProducts.has(product.id)"
            [class.disabled]="isProductAlreadyInStep(product.id)"
            (click)="
              !isProductAlreadyInStep(product.id) && toggleProduct(product)
            "
          >
            <div class="product-checkbox">
              <mat-checkbox
                [checked]="selectedProducts.has(product.id)"
                [disabled]="isProductAlreadyInStep(product.id)"
                (change)="toggleProduct(product)"
                (click)="onCheckboxClick($event)"
              ></mat-checkbox>
            </div>

            <div class="product-image" *ngIf="product.image_url">
              <img
                [src]="product.image_url"
                [alt]="product.name"
                loading="lazy"
              />
            </div>
            <div class="product-image fallback" *ngIf="!product.image_url">
              <mat-icon>restaurant</mat-icon>
            </div>

            <div class="product-info">
              <div class="product-name">{{ product.name }}</div>
              <div class="product-category">
                {{ product.category_name || 'Sans catégorie' }}
              </div>
              <div class="product-price">
                {{
                  product.price | currency : 'EUR' : 'symbol' : '1.2-2' : 'fr'
                }}
              </div>
            </div>

            <div
              class="already-selected-indicator"
              *ngIf="isProductAlreadyInStep(product.id)"
            >
              <mat-icon>check_circle</mat-icon>
              <span>Déjà ajouté</span>
            </div>
          </mat-card>
        </div>

        <div class="empty-state" *ngIf="!(filteredProducts$ | async)?.length">
          <mat-icon>search_off</mat-icon>
          <h3>Aucun produit trouvé</h3>
          <p>Aucun produit ne correspond à votre recherche</p>
        </div>
      </div>
    </div>

    <div mat-dialog-actions class="dialog-actions">
      <button mat-button mat-dialog-close>Annuler</button>
      <button
        mat-raised-button
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
        flex-wrap: wrap;
      }

      .dialog-header h2 span {
        word-wrap: break-word;
        overflow-wrap: break-word;
      }

      .dialog-content {
        min-width: 600px;
        max-width: 800px;
        max-height: 70vh;
        overflow-y: auto;
      }

      .search-field {
        width: 100%;
        margin-bottom: 16px;
      }

      .selection-summary {
        background: var(--mat-sys-primary-container);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
      }

      .summary-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .action-buttons {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .count {
        font-weight: 500;
        color: var(--mat-sys-on-primary-container);
      }

      .selected-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .products-container {
        min-height: 300px;
      }

      .products-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
      }

      .product-card {
        cursor: pointer;
        transition: all 0.2s ease;
        border: 2px solid transparent;
        position: relative;
        overflow: visible;
      }

      .product-card:hover:not(.disabled) {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      .product-card.selected {
        border-color: var(--mat-sys-primary);
        background: var(--mat-sys-primary-container);
      }

      .product-card.disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .product-checkbox {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 2;
        background: var(--mat-sys-surface);
        border-radius: 50%;
        padding: 4px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .product-image {
        width: 100%;
        height: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--mat-sys-surface-variant);
        overflow: hidden;
      }

      .product-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .product-image.fallback {
        background: var(--mat-sys-surface-container);
      }

      .product-image.fallback mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--mat-sys-on-surface-variant);
        opacity: 0.6;
      }

      .product-info {
        padding: 16px;
      }

      .product-name {
        font-weight: 600;
        font-size: 1rem;
        margin-bottom: 4px;
        color: var(--mat-sys-on-surface);
      }

      .product-category {
        font-size: 0.875rem;
        color: var(--mat-sys-on-surface-variant);
        margin-bottom: 8px;
      }

      .product-price {
        font-weight: 500;
        font-size: 1rem;
        color: var(--mat-sys-primary);
      }

      .already-selected-indicator {
        position: absolute;
        top: 8px;
        left: 8px;
        background: var(--mat-sys-tertiary-container);
        color: var(--mat-sys-on-tertiary-container);
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 0.75rem;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .already-selected-indicator mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      .empty-state {
        text-align: center;
        padding: 48px 24px;
        color: var(--mat-sys-on-surface-variant);
      }

      .empty-state mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        margin-bottom: 16px;
        color: var(--mat-sys-outline);
      }

      .empty-state h3 {
        margin: 0 0 8px 0;
        font-weight: 500;
      }

      .empty-state p {
        margin: 0;
      }

      .dialog-actions {
        margin-top: 24px;
        gap: 8px;
      }

      @media (max-width: 768px) {
        .dialog-content {
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

        .products-grid {
          grid-template-columns: 1fr;
        }

        .selection-summary {
          padding: 12px;
        }

        .summary-header {
          flex-direction: column;
          align-items: stretch;
          gap: 8px;
        }
      }
    `,
  ],
})
export class BulkProductSelectorDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<BulkProductSelectorDialogComponent>);

  searchControl = new FormControl('');
  selectedProducts = new Set<number>();
  filteredProducts$!: Observable<ProductAdmin[]>;

  constructor(@Inject(MAT_DIALOG_DATA) public data: BulkSelectorDialogData) {}

  ngOnInit() {
    // Setup filtered products observable
    this.filteredProducts$ = this.searchControl.valueChanges.pipe(
      startWith(''),
      map((searchTerm) => this.filterProducts(searchTerm || ''))
    );
  }

  private filterProducts(searchTerm: string): ProductAdmin[] {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return this.data.products.filter(
      (product) =>
        product.name.toLowerCase().includes(lowerSearchTerm) ||
        product.category_name?.toLowerCase().includes(lowerSearchTerm) ||
        false
    );
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
    const filteredProducts = this.filterProducts(searchTerm);
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
    // Get the current search term and filter products synchronously
    // This ensures we select exactly what's currently displayed
    const searchTerm = this.searchControl.value || '';
    const filteredProducts = this.filterProducts(searchTerm);
    
    filteredProducts.forEach((product) => {
      // Only select products that are not already in the step
      if (!this.isProductAlreadyInStep(product.id)) {
        this.selectedProducts.add(product.id);
      }
    });
  }
}
