import {
  Component,
  OnInit,
  inject,
  ViewChild,
  OnDestroy,
  AfterViewInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { ProductAdminService } from '../../../services/product-admin.service';
import { VendorService } from '../../../services/vendor.service';
import { SupabaseService } from '../../../services/supabase.service';
import { SupabaseAuthService } from '../../../services/supabase-auth.service';
import { ProductAdmin } from '../../../models/product-admin.interface';
import { ProductEditDialogComponent } from '../product-edit-dialog/product-edit-dialog.component';
import { PRODUCT_PLACEHOLDER_IMAGE } from '../../../shared/utils/image-placeholder';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatSortModule,
    MatInputModule,
    MatFormFieldModule,
    MatChipsModule,
    MatCheckboxModule,
    MatBadgeModule,
  ],
  template: `
    <div class="product-list">
      <!-- Header with search and add button -->
      <div class="list-header">
        <mat-form-field appearance="fill" class="search-field">
          <mat-label>Rechercher un produit</mat-label>
          <input
            matInput
            (keyup)="applyFilter($event)"
            placeholder="Nom, catégorie, statut... (produits réguliers uniquement)"
          />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>

        <mat-checkbox
          [checked]="showUnavailable()"
          (change)="onToggleShowUnavailable($event.checked)"
          class="unavailable-checkbox"
        >
          Afficher les produits indisponibles
        </mat-checkbox>

        <button matButton="filled" color="primary" (click)="openProductDialog()">
          <mat-icon>add</mat-icon>
          Ajouter un produit
        </button>
      </div>

      <!-- Product table -->
      <div class="table-container">
        <table
          mat-table
          [dataSource]="dataSource"
          matSort
          class="product-table"
        >

          <!-- Image Column -->
          <ng-container matColumnDef="image">
            <th mat-header-cell *matHeaderCellDef>Image</th>
            <td mat-cell *matCellDef="let product">
              <div class="product-image">
                <img
                  [src]="product.image_url || placeholderImage"
                  [alt]="product.name"
                  loading="lazy"
                />
              </div>
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

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr
            mat-row
            *matRowDef="let row; columns: displayedColumns"
            (click)="onRowClick(row)"
            [class.mobile-clickable]="isMobile()"
            [class.unavailable-row]="!row.is_available"
          ></tr>
        </table>

        @if (dataSource.data.length === 0) {
        <div class="empty-state">
          <mat-icon>restaurant_menu</mat-icon>
          <h3>Aucun produit régulier trouvé</h3>
          <p>Commencez par ajouter vos premiers produits (hors menus)</p>
        </div>
        }
      </div>

      <!-- Paginator -->
      <mat-paginator
        [pageSizeOptions]="[10, 25, 50]"
        [showFirstLastButtons]="true"
        aria-label="Sélectionner une page de produits"
      >
      </mat-paginator>
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

      /* ===== Paginator ===== */
      :host ::ng-deep .mat-mdc-paginator {
        background: var(--mat-sys-surface-container-low);
        border-radius: 0 0 var(--mat-sys-corner-large) var(--mat-sys-corner-large);
        margin-top: -1px;
      }

      /* ===== Responsive ===== */
      @media (max-width: 600px) {
        .product-list {
          padding: 16px;
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

        :host ::ng-deep .mat-mdc-paginator {
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
      }
    `,
  ],
})
export class ProductListComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
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
    'image',
    'name',
    'availability',
    'category',
    'price',
    'actions',
  ];
  currentVendorId: string | null = null;
  showUnavailable = signal(true);
  private allProducts: ProductAdmin[] = [];

  // Track loading states for individual products
  private loadingProducts = new Set<number>();

  ngOnInit() {
    this.loadCurrentVendor();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
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
          // Filter to show only regular products (not multi-step products/menus)
          this.allProducts = products.filter(
            (product) => !product.is_multi_step
          );
          this.updateVisibleProducts();
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

  onToggleShowUnavailable(checked: boolean) {
    this.showUnavailable.set(checked);
    this.updateVisibleProducts();
  }

  private updateVisibleProducts() {
    const visible = this.showUnavailable()
      ? this.allProducts
      : this.allProducts.filter((p) => p.is_available);

    this.dataSource.data = [...visible].sort((a, b) =>
      (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' })
    );

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
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
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  openProductDialog(product?: ProductAdmin) {
    if (!this.currentVendorId) {
      this.snackBar.open('Vendor ID non disponible', 'Fermer', {
        duration: 3000,
        panelClass: ['error-snackbar'],
      });
      return;
    }

    const dialogRef = this.dialog.open(ProductEditDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      data: { product, vendorId: this.currentVendorId },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadProducts();
        this.snackBar.open(
          product ? 'Produit modifié avec succès' : 'Produit créé avec succès',
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
    if (confirm(`Êtes-vous sûr de vouloir supprimer "${product.name}" ?`)) {
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
