import {
  Component,
  OnInit,
  inject,
  ViewChild,
  OnDestroy,
  AfterViewInit,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SelectionModel } from '@angular/cdk/collections';
import { Subject, takeUntil } from 'rxjs';
import { ProductAdminService } from '../../../services/product-admin.service';
import { VendorService } from '../../../services/vendor.service';
import { SupabaseService } from '../../../services/supabase.service';
import { SupabaseAuthService } from '../../../services/supabase-auth.service';
import { ProductAdmin } from '../../../models/product-admin.interface';
import { ProductEditDialogComponent } from '../product-edit-dialog/product-edit-dialog.component';
import {
  ConfirmDeleteDialogComponent,
  ConfirmDeleteDialogData,
} from '../confirm-delete-dialog/confirm-delete-dialog.component';
import { PRODUCT_PLACEHOLDER_IMAGE } from '../../../shared/utils/image-placeholder';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSortModule,
    MatInputModule,
    MatFormFieldModule,
    MatChipsModule,
    MatCheckboxModule,
    MatBadgeModule,
    MatTooltipModule,
    MatTabsModule,
  ],
  template: `
    <div class="product-list" [class.has-selection]="hasSelection()">
      <!-- Header with search and add button -->
      <div class="list-header">
        @if (activeSubTab() === 0) {
          <mat-form-field appearance="fill" class="search-field">
            <mat-label>Rechercher un produit</mat-label>
            <input
              matInput
              #searchInput
              [value]="searchValue()"
              (input)="applyFilter($event)"
              placeholder="Nom, catégorie, statut... (produits réguliers uniquement)"
            />
            @if (searchValue()) {
              <button
                matSuffix
                mat-icon-button
                aria-label="Effacer la recherche"
                (click)="clearSearch(searchInput)"
              >
                <mat-icon>close</mat-icon>
              </button>
            } @else {
              <mat-icon matSuffix>search</mat-icon>
            }
          </mat-form-field>
        }

        <mat-checkbox
          [checked]="showUnavailable()"
          (change)="onToggleShowUnavailable($event.checked)"
          class="unavailable-checkbox"
        >
          {{ activeSubTab() === 0 ? 'Afficher les produits indisponibles' : 'Afficher les accessoires indisponibles' }}
        </mat-checkbox>

        <button mat-flat-button color="primary" (click)="openProductDialog()">
          <mat-icon>add</mat-icon>
          {{ activeSubTab() === 0 ? 'Ajouter un produit' : 'Ajouter un accessoire' }}
        </button>
      </div>

      <!-- Sub-tabs: Produits / Accessoires -->
      <mat-tab-group
        class="sub-tabs"
        [selectedIndex]="activeSubTab()"
        (selectedIndexChange)="onSubTabChange($event)"
      >
        <mat-tab label="Produits"></mat-tab>
        <mat-tab label="Accessoires"></mat-tab>
      </mat-tab-group>

      <!-- Product table -->
      <div class="table-container">
        <table
          mat-table
          [dataSource]="dataSource"
          matSort
          class="product-table"
        >
          <!-- Checkbox Column -->
          <ng-container matColumnDef="select">
            <th mat-header-cell *matHeaderCellDef>
              <mat-checkbox
                (change)="$event ? toggleAllRows() : null"
                [checked]="selection.hasValue() && isAllSelected()"
                [indeterminate]="selection.hasValue() && !isAllSelected()"
                color="primary"
              >
              </mat-checkbox>
            </th>
            <td mat-cell *matCellDef="let row">
              <mat-checkbox
                (click)="$event.stopPropagation()"
                (change)="$event ? selection.toggle(row) : null"
                [checked]="selection.isSelected(row)"
                color="primary"
              >
              </mat-checkbox>
            </td>
          </ng-container>

          <!-- Image Column -->
          <ng-container matColumnDef="image">
            <th mat-header-cell *matHeaderCellDef>{{ activeSubTab() === 1 ? 'Icône' : 'Image' }}</th>
            <td mat-cell *matCellDef="let product">
              @if (product.is_accessory && product.icon_emoji) {
                <div class="accessory-emoji">{{ product.icon_emoji }}</div>
              } @else {
                <div class="product-image">
                  <img
                    [src]="product.image_url || placeholderImage"
                    [alt]="product.name"
                    loading="lazy"
                  />
                </div>
              }
            </td>
          </ng-container>

          <!-- Name Column -->
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Nom</th>
            <td mat-cell *matCellDef="let product">
              <div class="product-name">
                <span class="name">{{ product.name }}</span>
              </div>
            </td>
          </ng-container>

          <!-- Category Column -->
          <ng-container matColumnDef="category">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Catégorie</th>
            <td mat-cell *matCellDef="let product">
              {{ product.category_name || 'Non définie' }}
            </td>
          </ng-container>

          <!-- Price Column -->
          <ng-container matColumnDef="price">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Prix</th>
            <td mat-cell *matCellDef="let product">
              <span class="price">{{
                product.price | currency : 'EUR' : 'symbol' : '1.2-2' : 'fr'
              }}</span>
            </td>
          </ng-container>

          <!-- Availability Column -->
          <ng-container matColumnDef="availability">
            <th mat-header-cell *matHeaderCellDef>Disponibilité</th>
            <td mat-cell *matCellDef="let product">
              <div class="status-chips">
                @if (product.is_available) {
                <mat-chip
                  class="status-chip available clickable"
                  (click)="toggleProductAvailability(product); $event.stopPropagation()"
                  [disabled]="isProductLoading(product.id)"
                  [matBadge]="product.stock_quantity"
                  [matBadgeHidden]="product.stock_quantity == null"
                  matBadgePosition="after"
                  [matBadgeColor]="product.stock_quantity === 0 ? 'warn' : 'primary'"
                >
                  Disponible
                  <mat-icon
                    *ngIf="isProductLoading(product.id)"
                    class="loading-icon"
                    >refresh</mat-icon
                  >
                </mat-chip>
                } @else {
                <mat-chip
                  class="status-chip unavailable clickable"
                  (click)="toggleProductAvailability(product); $event.stopPropagation()"
                  [disabled]="isProductLoading(product.id)"
                  [matBadge]="product.stock_quantity"
                  [matBadgeHidden]="product.stock_quantity == null"
                  matBadgePosition="after"
                  matBadgeColor="warn"
                >
                  Indisponible
                  <mat-icon
                    *ngIf="isProductLoading(product.id)"
                    class="loading-icon"
                    >refresh</mat-icon
                  >
                </mat-chip>
                } @if (product.no_catalogable) {
                <mat-chip
                  class="status-chip not-catalogable"
                  (click)="$event.stopPropagation()"
                  >Hors catalogue</mat-chip
                >
                }
              </div>
            </td>
          </ng-container>

          <!-- Actions Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Actions</th>
            <td mat-cell *matCellDef="let product">
              <div class="action-buttons">
                <button
                  mat-icon-button
                  (click)="editProduct(product); $event.stopPropagation()"
                  matTooltip="Modifier"
                >
                  <mat-icon>edit</mat-icon>
                </button>
                <button
                  mat-icon-button
                  color="warn"
                  (click)="deleteProduct(product); $event.stopPropagation()"
                  matTooltip="Supprimer"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns; sticky: true"></tr>
          <tr
            mat-row
            *matRowDef="let row; columns: displayedColumns"
            (click)="onRowClick(row)"
            [class.mobile-clickable]="isMobile()"
            [class.unavailable-row]="!row.is_available"
            [class.selected-row]="selection.isSelected(row)"
          ></tr>
        </table>

        @if (dataSource.data.length === 0) {
        <div class="empty-state">
          <mat-icon>{{ activeSubTab() === 0 ? 'restaurant_menu' : 'shopping_bag' }}</mat-icon>
          <h3>{{ activeSubTab() === 0 ? 'Aucun produit régulier trouvé' : 'Aucun accessoire trouvé' }}</h3>
          <p>{{ activeSubTab() === 0 ? 'Commencez par ajouter vos premiers produits (hors menus)' : 'Ajoutez des accessoires (couverts, sacs, serviettes...)' }}</p>
        </div>
        }
      </div>

      <!-- Selection Action Bar (bottom toolbar) -->
      @if (hasSelection()) {
        <div class="selection-bar">
          <div class="selection-info">
            <button mat-icon-button (click)="clearSelection()" class="close-btn">
              <mat-icon>close</mat-icon>
            </button>
            <span class="selection-count">{{ selection.selected.length }} sélectionné(s)</span>
          </div>

          <div class="selection-actions">
            <button
              mat-button
              (click)="bulkSetAvailability(true)"
              [disabled]="isBulkLoading()"
              class="action-btn available-btn"
            >
              <mat-icon>check_circle</mat-icon>
              <span class="btn-text">Disponible</span>
            </button>

            <button
              mat-button
              (click)="bulkSetAvailability(false)"
              [disabled]="isBulkLoading()"
              class="action-btn unavailable-btn"
            >
              <mat-icon>remove_circle</mat-icon>
              <span class="btn-text">Indisponible</span>
            </button>

            <button
              mat-button
              color="warn"
              (click)="bulkDelete()"
              [disabled]="isBulkLoading()"
              class="action-btn delete-btn"
            >
              <mat-icon>delete</mat-icon>
              <span class="btn-text">Supprimer</span>
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      /* ===== Layout ===== */
      :host {
        display: block;
        background: var(--mat-sys-surface);
        height: 100%;
      }

      .product-list {
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 24px;
        padding-bottom: 24px;
        transition: padding-bottom 0.3s ease;
      }

      .product-list.has-selection {
        padding-bottom: 88px;
      }

      /* ===== Sub-tabs ===== */
      .sub-tabs {
        margin-bottom: 16px;
        margin-top: 0;
      }

      /* ===== Accessory emoji ===== */
      .accessory-emoji {
        width: 56px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        background: var(--mat-sys-surface-container-highest);
        border-radius: var(--mat-sys-corner-medium);
      }

      /* ===== Header ===== */
      .list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
        padding: 20px 24px;
        gap: 16px;
        background: var(--mat-sys-surface-container-low);
        border-radius: var(--mat-sys-corner-large);
      }

      .search-field {
        flex: 1;
        max-width: 400px;
      }

      .unavailable-checkbox {
        margin-right: auto;
        font: var(--mat-sys-label-large);
      }

      /* ===== Table Container ===== */
      .table-container {
        flex: 1;
        overflow: auto;
        background: var(--mat-sys-surface-container);
        border-radius: var(--mat-sys-corner-large);
        box-shadow: var(--mat-sys-level1);
      }

      .product-table {
        width: 100%;
      }

      /* Table header styling */
      :host ::ng-deep .mat-mdc-header-row {
        background: var(--mat-sys-surface-container-high);
      }

      :host ::ng-deep .mat-mdc-header-cell {
        font: var(--mat-sys-label-large);
        color: var(--mat-sys-on-surface);
        border-bottom-color: var(--mat-sys-outline-variant);
      }

      /* Table row styling */
      :host ::ng-deep .mat-mdc-row {
        transition: background-color 0.15s ease;
      }

      :host ::ng-deep .mat-mdc-row:hover {
        background: var(--mat-sys-surface-container-high);
      }

      :host ::ng-deep .mat-mdc-cell {
        font: var(--mat-sys-body-medium);
        color: var(--mat-sys-on-surface);
        border-bottom-color: var(--mat-sys-outline-variant);
      }

      /* ===== Product Image ===== */
      .product-image {
        width: 56px;
        height: 56px;
        border-radius: var(--mat-sys-corner-medium);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--mat-sys-surface-container-highest);
      }

      .product-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .no-image {
        color: var(--mat-sys-on-surface-variant);
      }

      /* ===== Product Name ===== */
      .product-name {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .name {
        font: var(--mat-sys-body-large);
        font-weight: 500;
        color: var(--mat-sys-on-surface);
      }

      /* ===== Price ===== */
      .price {
        font: var(--mat-sys-label-large);
        font-weight: 600;
        color: var(--mat-sys-primary);
      }

      /* ===== Status Chips ===== */
      .status-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        overflow: visible;
      }

      .status-chip {
        font: var(--mat-sys-label-small);
        overflow: visible !important;
      }

      :host ::ng-deep .status-chip .mat-badge-content {
        z-index: 1;
      }

      .status-chip.available {
        background: var(--mat-sys-tertiary-container);
        color: var(--mat-sys-on-tertiary-container);
      }

      .status-chip.unavailable {
        background: var(--mat-sys-error-container);
        color: var(--mat-sys-on-error-container);
      }

      .status-chip.not-catalogable {
        background: var(--mat-sys-secondary-container);
        color: var(--mat-sys-on-secondary-container);
      }

      .clickable {
        cursor: pointer;
        transition: transform 0.15s ease, opacity 0.15s ease;
        position: relative;
        user-select: none;
      }

      .clickable:hover {
        transform: scale(1.02);
      }

      .clickable:active {
        transform: scale(0.98);
      }

      .clickable:disabled {
        cursor: not-allowed;
        opacity: 0.6;
        transform: none;
      }

      .loading-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        margin-left: 4px;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }

      /* ===== Action Buttons ===== */
      .action-buttons {
        display: flex;
        gap: 4px;
      }

      .action-buttons button {
        transition: background-color 0.15s ease;
      }

      /* ===== Empty State ===== */
      .empty-state {
        text-align: center;
        padding: 64px 24px;
        background: var(--mat-sys-surface-container-high);
        border-radius: var(--mat-sys-corner-large);
        margin: 24px;
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
        font: var(--mat-sys-headline-small);
        color: var(--mat-sys-on-surface);
      }

      .empty-state p {
        margin: 0;
        font: var(--mat-sys-body-medium);
        color: var(--mat-sys-on-surface-variant);
      }

      /* ===== Row States ===== */
      .mobile-clickable {
        cursor: pointer;
      }

      .mobile-clickable:active {
        background: var(--mat-sys-surface-container-highest) !important;
      }

      .unavailable-row {
        opacity: 0.6;
        background: var(--mat-sys-surface-container-high);
      }

      .unavailable-row:hover {
        background: var(--mat-sys-surface-container-highest);
      }

      .selected-row {
        background: color-mix(in srgb, var(--mat-sys-primary) 12%, transparent) !important;
      }

      .selected-row:hover {
        background: color-mix(in srgb, var(--mat-sys-primary) 18%, transparent) !important;
      }

      /* ===== Selection Bar ===== */
      .selection-bar {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: var(--mat-sys-surface-container-high);
        border-top: 1px solid var(--mat-sys-outline-variant);
        padding: 12px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        z-index: 100;
        box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
        animation: slideUp 0.2s ease-out;
      }

      @keyframes slideUp {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      .selection-info {
        display: flex;
        align-items: center;
        gap: 8px;

        .close-btn {
          color: var(--mat-sys-on-surface-variant);
        }

        .selection-count {
          font: var(--mat-sys-title-medium);
          color: var(--mat-sys-on-surface);
          white-space: nowrap;
        }
      }

      .selection-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .action-btn {
        display: flex;
        align-items: center;
        gap: 4px;
        border-radius: var(--mat-sys-corner-full);
        padding: 8px 16px;
        font: var(--mat-sys-label-large);
        transition: all 0.15s ease;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
      }

      .available-btn {
        background: var(--mat-sys-tertiary-container);
        color: var(--mat-sys-on-tertiary-container);

        &:hover:not(:disabled) {
          background: color-mix(in srgb, var(--mat-sys-tertiary-container) 85%, var(--mat-sys-on-tertiary-container));
        }
      }

      .unavailable-btn {
        background: var(--mat-sys-surface-container-highest);
        color: var(--mat-sys-on-surface);

        &:hover:not(:disabled) {
          background: var(--mat-sys-outline-variant);
        }
      }

      .delete-btn {
        background: var(--mat-sys-error-container);
        color: var(--mat-sys-on-error-container);

        &:hover:not(:disabled) {
          background: color-mix(in srgb, var(--mat-sys-error-container) 85%, var(--mat-sys-on-error-container));
        }
      }

      /* ===== Responsive ===== */
      @media (max-width: 600px) {
        .product-list {
          padding: 16px;
        }

        .product-list.has-selection {
          padding-bottom: 140px;
        }

        .list-header {
          flex-direction: column;
          align-items: stretch;
          padding: 16px;
          margin: -16px -16px 16px -16px;
          border-radius: 0;
        }

        .list-header button {
          width: 100%;
        }

        .search-field {
          max-width: none;
        }

        .unavailable-checkbox {
          margin-right: 0;
        }

        .table-container {
          margin: 0 -16px;
          border-radius: 0;
        }

        .product-image {
          width: 48px;
          height: 48px;
        }

        .empty-state {
          margin: 24px -16px;
          border-radius: 0;
          padding: 48px 16px;
        }

        /* Selection bar mobile */
        .selection-bar {
          flex-direction: column;
          align-items: stretch;
          padding: 12px 16px;
          gap: 12px;
        }

        .selection-info {
          justify-content: flex-start;
        }

        .selection-actions {
          justify-content: stretch;
          gap: 8px;
        }

        .action-btn {
          flex: 1;
          justify-content: center;
          padding: 12px 8px;
          min-width: 0;
        }

        .btn-text {
          font-size: 12px;
        }

        /* Hide some columns on mobile */
        :host ::ng-deep .mat-column-category,
        :host ::ng-deep .mat-column-price,
        :host ::ng-deep .mat-column-actions {
          display: none;
        }
      }

      @media (min-width: 601px) and (max-width: 900px) {
        :host ::ng-deep .mat-column-category {
          display: none;
        }
      }
    `,
  ],
})
export class ProductListComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(MatSort) sort!: MatSort;

  readonly placeholderImage = PRODUCT_PLACEHOLDER_IMAGE;

  private productAdminService = inject(ProductAdminService);
  private vendorService = inject(VendorService);
  private supabaseService = inject(SupabaseService);
  private supabaseAuthService = inject(SupabaseAuthService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private destroy$ = new Subject<void>();

  dataSource = new MatTableDataSource<ProductAdmin>([]);
  displayedColumns: string[] = [
    'select',
    'image',
    'name',
    'availability',
    'category',
    'price',
    'actions',
  ];
  currentVendorId: string | null = null;
  showUnavailable = signal(true);
  searchValue = signal('');
  activeSubTab = signal(0); // 0 = Produits, 1 = Accessoires
  private allProducts: ProductAdmin[] = [];

  // Selection
  selection = new SelectionModel<ProductAdmin>(true, []);
  private bulkLoading = signal(false);
  selectionCount = signal(0);

  // Track loading states for individual products
  private loadingProducts = new Set<number>();

  // Computed signals
  hasSelection = computed(() => this.selectionCount() > 0);

  ngOnInit() {
    this.loadCurrentVendor();
    // Track selection changes
    this.selection.changed.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.selectionCount.set(this.selection.selected.length);
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
  }

  private loadCurrentVendor() {
    this.vendorService.currentVendor$
      .pipe(takeUntil(this.destroy$))
      .subscribe((vendor) => {
        if (vendor?.id) {
          this.currentVendorId = vendor.id;
          this.loadProducts();
        }
      });
  }

  private loadProducts() {
    if (!this.currentVendorId) return;

    console.log('Loading products for vendor:', this.currentVendorId);

    this.productAdminService
      .getProducts(this.currentVendorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products) => {
          console.log('Products loaded successfully:', products.length);
          // Filter based on active sub-tab
          if (this.activeSubTab() === 1) {
            // Accessoires tab: show only accessories
            this.allProducts = products.filter(
              (product) => product.is_accessory === true
            );
          } else {
            // Produits tab: regular products (not multi-step, not accessories)
            this.allProducts = products.filter(
              (product) => !product.is_multi_step && !product.is_accessory
            );
          }
          this.updateVisibleProducts();
          // Clear selection after reload
          this.selection.clear();
        },
        error: (error) => {
          console.error('Error loading products:', error);

          // Check if it's a session-related error
          if (
            error.message?.includes('session') ||
            error.message?.includes('Authentication')
          ) {
            this.snackBar.open(
              'Session expirée. Veuillez vous reconnecter.',
              'Fermer',
              {
                duration: 5000,
                panelClass: ['error-snackbar'],
              }
            );
          } else {
            this.snackBar.open(
              'Erreur lors du chargement des produits',
              'Fermer',
              {
                duration: 5000,
                panelClass: ['error-snackbar'],
              }
            );
          }
        },
      });
  }

  isProductLoading(productId: number): boolean {
    return this.loadingProducts.has(productId);
  }

  isBulkLoading(): boolean {
    return this.bulkLoading();
  }

  onSubTabChange(index: number) {
    this.activeSubTab.set(index);
    this.selection.clear();
    this.dataSource.filter = '';
    this.loadProducts();
  }

  onToggleShowUnavailable(checked: boolean) {
    this.showUnavailable.set(checked);
    this.updateVisibleProducts();
    // Clear selection when toggling visibility
    this.selection.clear();
  }

  private updateVisibleProducts() {
    const visible = this.showUnavailable()
      ? this.allProducts
      : this.allProducts.filter((p) => p.is_available);

    this.dataSource.data = [...visible].sort((a, b) =>
      (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' })
    );
  }

  // Selection methods
  isAllSelected(): boolean {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.dataSource.data.forEach((row) => this.selection.select(row));
    }
  }

  clearSelection() {
    this.selection.clear();
  }

  // Bulk operations
  async bulkSetAvailability(isAvailable: boolean) {
    const selectedProducts = this.selection.selected;
    if (selectedProducts.length === 0) return;

    this.bulkLoading.set(true);
    const productIds = selectedProducts.map((p) => p.id);

    try {
      // Optimistic update
      this.allProducts = this.allProducts.map((p) =>
        productIds.includes(p.id) ? { ...p, is_available: isAvailable } : p
      );
      this.updateVisibleProducts();

      // Perform actual update
      await this.supabaseAuthService.bulkUpdateProductAvailability(
        productIds,
        isAvailable
      );

      const statusText = isAvailable ? 'disponibles' : 'indisponibles';
      const itemLabel = this.activeSubTab() === 1 ? 'accessoire(s)' : 'produit(s)';
      this.snackBar.open(
        `${selectedProducts.length} ${itemLabel} sont maintenant ${statusText}`,
        'OK',
        { duration: 3000, panelClass: ['success-snackbar'] }
      );

      this.selection.clear();
    } catch (error: any) {
      console.error('Error in bulk availability update:', error);
      // Revert optimistic update
      this.loadProducts();
      this.snackBar.open(
        'Erreur lors de la mise à jour des produits',
        'Fermer',
        { duration: 5000, panelClass: ['error-snackbar'] }
      );
    } finally {
      this.bulkLoading.set(false);
    }
  }

  bulkDelete() {
    const selectedProducts = this.selection.selected;
    if (selectedProducts.length === 0) return;

    const dialogData: ConfirmDeleteDialogData = {
      title: 'Supprimer les produits',
      message: `Êtes-vous sûr de vouloir supprimer ${selectedProducts.length} produit(s) ?`,
      itemCount: selectedProducts.length,
      itemNames: selectedProducts.map((p) => p.name),
    };

    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      maxWidth: '90vw',
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        await this.performBulkDelete(selectedProducts);
      }
    });
  }

  private async performBulkDelete(products: ProductAdmin[]) {
    this.bulkLoading.set(true);
    const productIds = products.map((p) => p.id);

    try {
      await this.supabaseAuthService.bulkDeleteProducts(productIds);

      // Remove from local list
      this.allProducts = this.allProducts.filter(
        (p) => !productIds.includes(p.id)
      );
      this.updateVisibleProducts();

      this.snackBar.open(
        `${products.length} produit(s) supprimé(s) avec succès`,
        'OK',
        { duration: 3000, panelClass: ['success-snackbar'] }
      );

      this.selection.clear();
    } catch (error: any) {
      console.error('Error in bulk delete:', error);
      this.snackBar.open('Erreur lors de la suppression des produits', 'Fermer', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    } finally {
      this.bulkLoading.set(false);
    }
  }

  async toggleProductAvailability(product: ProductAdmin) {
    // Prevent multiple simultaneous updates for the same product
    if (this.isProductLoading(product.id)) {
      return;
    }

    // Add product to loading set
    this.loadingProducts.add(product.id);

    try {
      const newAvailability = !product.is_available;

      // Optimistic update - temporarily update the product in the UI
      this.allProducts = this.allProducts.map((p) =>
        p.id === product.id ? { ...p, is_available: newAvailability } : p
      );
      this.updateVisibleProducts();

      // Perform the actual database update
      await this.supabaseAuthService.updateProductAvailability(
        product.id,
        newAvailability
      );

      // Show success message
      const statusText = newAvailability ? 'disponible' : 'indisponible';
      this.snackBar.open(`${product.name} est maintenant ${statusText}`, 'OK', {
        duration: 3000,
        panelClass: ['success-snackbar'],
      });
    } catch (error: any) {
      console.error('Error updating product availability:', error);

      // Revert optimistic update by reloading products
      this.loadProducts();

      // Show error message
      this.snackBar.open('Erreur lors de la mise à jour du produit', 'Fermer', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    } finally {
      // Always remove from loading set
      this.loadingProducts.delete(product.id);
    }
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.searchValue.set(filterValue);
    this.dataSource.filter = filterValue.trim().toLowerCase();
    // Clear selection when filtering
    this.selection.clear();
  }

  clearSearch(inputElement: HTMLInputElement) {
    this.searchValue.set('');
    this.dataSource.filter = '';
    inputElement.value = '';
    inputElement.focus();
    // Clear selection when clearing search
    this.selection.clear();
  }

  openProductDialog(product?: ProductAdmin) {
    if (!this.currentVendorId) {
      this.snackBar.open('Vendor ID non disponible', 'Fermer', {
        duration: 3000,
        panelClass: ['error-snackbar'],
      });
      return;
    }

    const isAccessory = this.activeSubTab() === 1;
    const dialogRef = this.dialog.open(ProductEditDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      data: { product, vendorId: this.currentVendorId, isAccessory },
    });

    const itemLabel = isAccessory ? 'Accessoire' : 'Produit';
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadProducts();
        this.snackBar.open(
          product ? `${itemLabel} modifié avec succès` : `${itemLabel} créé avec succès`,
          'Fermer',
          { duration: 3000, panelClass: ['success-snackbar'] }
        );
      }
    });
  }

  editProduct(product: ProductAdmin) {
    this.openProductDialog(product);
  }

  deleteProduct(product: ProductAdmin) {
    const dialogData: ConfirmDeleteDialogData = {
      title: 'Supprimer le produit',
      message: `Êtes-vous sûr de vouloir supprimer "${product.name}" ?`,
      itemCount: 1,
      itemNames: [product.name],
    };

    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      maxWidth: '90vw',
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.productAdminService
          .deleteProduct(product.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.loadProducts();
              this.snackBar.open('Produit supprimé avec succès', 'Fermer', {
                duration: 3000,
                panelClass: ['success-snackbar'],
              });
            },
            error: (error) => {
              console.error('Error deleting product:', error);
              this.snackBar.open('Erreur lors de la suppression', 'Fermer', {
                duration: 5000,
                panelClass: ['error-snackbar'],
              });
            },
          });
      }
    });
  }

  isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 768;
  }

  onRowClick(product: ProductAdmin): void {
    // Only open edit dialog on mobile
    if (this.isMobile()) {
      this.editProduct(product);
    }
  }
}
