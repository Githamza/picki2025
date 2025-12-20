import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterOutlet } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { ProductListComponent } from './product-list/product-list.component';
import { CategoryListComponent } from './category-list/category-list.component';
import { ProductAdminService } from '../../services/product-admin.service';
import { VendorService } from '../../services/vendor.service';
import { SupabaseService } from '../../services/supabase.service';
import { SupabaseAuthService } from '../../services/supabase-auth.service';
import { CustomisationService } from '../../services/customisation.service';
import {
  MenuAdmin,
  Category,
  MenuFormData,
} from '../../models/product-admin.interface';
import { Customisation } from '../../models/customisation.interface';

@Component({
  selector: 'app-product-manager',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    ProductListComponent,
    CategoryListComponent,
  ],
  template: `
    <div class="product-manager">
      <div class="header">
        <h1>Gestion des Produits</h1>
        <p class="subtitle">Gérez vos produits et vos menus</p>
      </div>

      <mat-tab-group class="product-tabs" animationDuration="300ms">
        <mat-tab label="Mes produits">
          <div class="tab-content">
            <app-product-list></app-product-list>
          </div>
        </mat-tab>

        <mat-tab label="Formules">
          <div class="tab-content">
            <!-- Menu Header -->
            <div class="menu-header">
              <h2>Déclarez vos formules</h2>
              <button mat-raised-button color="primary" (click)="createMenu()">
                <mat-icon>add</mat-icon>
                Créer un menu
              </button>
            </div>

            <!-- Menu Cards Grid -->
            <div class="menu-grid" *ngIf="menus.length > 0">
              <mat-card
                class="menu-card"
                *ngFor="let menu of menus; trackBy: trackByMenuId"
              >
                <mat-card-header>
                  <div mat-card-avatar class="menu-avatar">
                    <mat-icon>restaurant_menu</mat-icon>
                  </div>
                  <mat-card-title>{{ menu.name }}</mat-card-title>
                  <mat-card-subtitle>{{
                    menu.category_name || 'Sans catégorie'
                  }}</mat-card-subtitle>
                </mat-card-header>

                <div class="menu-image-container" *ngIf="menu.image_url">
                  <img
                    [src]="menu.image_url"
                    [alt]="menu.name"
                    loading="lazy"
                    class="menu-image"
                  />
                </div>

                <mat-card-content>
                  <p class="menu-description">
                    {{ menu.short_description || 'Aucune description' }}
                  </p>

                  <div class="menu-meta">
                    <div class="menu-chips">
                      <mat-chip>{{
                        menu.price
                          | currency : 'EUR' : 'symbol' : '1.2-2' : 'fr'
                      }}</mat-chip>
                      <mat-chip
                        [class]="
                          menu.is_available
                            ? 'chip-available clickable'
                            : 'chip-unavailable clickable'
                        "
                        (click)="toggleMenuAvailability(menu)"
                        [disabled]="isMenuLoading(menu.id)"
                      >
                        {{ menu.is_available ? 'Disponible' : 'Indisponible' }}
                        <mat-icon
                          *ngIf="isMenuLoading(menu.id)"
                          class="loading-icon"
                          >refresh</mat-icon
                        >
                      </mat-chip>
                      <mat-chip class="chip-steps"
                        >{{ menu.step_count || 0 }} étapes</mat-chip
                      >
                      <mat-chip
                        class="chip-options"
                        *ngIf="getTotalOptionsCount(menu) > 0"
                        >{{ getTotalOptionsCount(menu) }} options</mat-chip
                      >
                    </div>
                  </div>
                </mat-card-content>

                <mat-card-actions class="menu-actions">
                  <button
                    mat-button
                    (click)="editMenu(menu)"
                    class="action-button"
                  >
                    <mat-icon>edit</mat-icon>
                    Configurer
                  </button>
                  <button
                    mat-button
                    (click)="duplicateMenu(menu)"
                    class="action-button"
                  >
                    <mat-icon>content_copy</mat-icon>
                    Dupliquer
                  </button>
                  <button
                    mat-button
                    color="warn"
                    (click)="deleteMenu(menu)"
                    class="action-button"
                  >
                    <mat-icon>delete</mat-icon>
                    Supprimer
                  </button>
                </mat-card-actions>
              </mat-card>
            </div>

            <!-- Empty State -->
            <div class="empty-state" *ngIf="menus.length === 0">
              <mat-icon>restaurant_menu</mat-icon>
              <h3>Aucun menu multi-étapes trouvé</h3>
              <p>Créez votre premier menu avec plusieurs étapes</p>
              <button mat-raised-button color="primary" (click)="createMenu()">
                <mat-icon>add</mat-icon>
                Créer mon premier menu
              </button>
            </div>
          </div>
        </mat-tab>

        <mat-tab label="Customisations">
          <div class="tab-content">
            <!-- Customisation Header -->
            <div class="menu-header">
              <h2>Customisations</h2>
              <button mat-raised-button color="accent" (click)="createCustomisation()">
                <mat-icon>add</mat-icon>
                Créer une customisation
              </button>
            </div>

            <!-- Customisation Cards Grid -->
            <div class="menu-grid" *ngIf="customisations.length > 0">
              <mat-card
                class="menu-card customisation-card"
                *ngFor="let customisation of customisations; trackBy: trackByCustomisationId"
              >
                <mat-card-header>
                  <div mat-card-avatar class="menu-avatar customisation">
                    <mat-icon>tune</mat-icon>
                  </div>
                  <mat-card-title>{{ customisation.name }}</mat-card-title>
                  <mat-card-subtitle>{{
                    customisation.description || 'Sans description'
                  }}</mat-card-subtitle>
                </mat-card-header>

                <mat-card-content>
                  <div class="menu-meta">
                    <div class="menu-chips">
                      <mat-chip
                        [class]="
                          customisation.is_available
                            ? 'chip-available clickable'
                            : 'chip-unavailable clickable'
                        "
                        (click)="toggleCustomisationAvailability(customisation)"
                        [disabled]="isCustomisationLoading(customisation.id)"
                      >
                        {{ customisation.is_available ? 'Disponible' : 'Indisponible' }}
                        <mat-icon
                          *ngIf="isCustomisationLoading(customisation.id)"
                          class="loading-icon"
                          >refresh</mat-icon
                        >
                      </mat-chip>
                      <mat-chip class="chip-type">
                        {{ customisation.selection_type === 'single-select' ? 'Choix unique' : 'Choix multiple' }}
                      </mat-chip>
                      <mat-chip
                        class="chip-options"
                        *ngIf="getCustomisationOptionsCount(customisation) > 0"
                        >{{ getCustomisationOptionsCount(customisation) }} options</mat-chip
                      >
                      <mat-chip
                        class="chip-products"
                        *ngIf="getCustomisationProductCount(customisation.id) > 0"
                        >{{ getCustomisationProductCount(customisation.id) }} produits</mat-chip
                      >
                      <mat-chip *ngIf="customisation.is_required" class="chip-required">
                        Requis
                      </mat-chip>
                    </div>
                  </div>
                </mat-card-content>

                <mat-card-actions class="menu-actions">
                  <button
                    mat-button
                    (click)="editCustomisation(customisation)"
                    class="action-button"
                  >
                    <mat-icon>edit</mat-icon>
                    Configurer
                  </button>
                  <button
                    mat-button
                    (click)="duplicateCustomisation(customisation)"
                    class="action-button"
                  >
                    <mat-icon>content_copy</mat-icon>
                    Dupliquer
                  </button>
                  <button
                    mat-button
                    color="warn"
                    (click)="deleteCustomisation(customisation)"
                    class="action-button"
                  >
                    <mat-icon>delete</mat-icon>
                    Supprimer
                  </button>
                </mat-card-actions>
              </mat-card>
            </div>

            <!-- Customisations Empty State -->
            <div class="empty-state" *ngIf="customisations.length === 0">
              <mat-icon>tune</mat-icon>
              <h3>Aucune customisation trouvée</h3>
              <p>
                Les customisations permettent aux clients de personnaliser leurs produits
              </p>
              <button mat-raised-button color="accent" (click)="createCustomisation()">
                <mat-icon>add</mat-icon>
                Créer ma première customisation
              </button>
            </div>
          </div>
        </mat-tab>

        <mat-tab label="Catégories">
          <div class="tab-content">
            <app-category-list></app-category-list>
          </div>
        </mat-tab>
      </mat-tab-group>

      <!-- Router outlet for child components like MenuEditComponent -->
      <router-outlet></router-outlet>
    </div>
  `,
  styles: [
    `
      .product-manager {
        max-width: 1200px;
        margin: 0 auto;
      }

      .header {
        @media (max-width: 768px) {
          text-align: center;
        }
      }

      h1 {
        margin: 0 0 8px 0;
        font-size: 2rem;
        font-weight: 500;
        color: var(--mat-sys-on-surface);
      }

      .subtitle {
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
        font-size: 1rem;
      }

      .product-tabs {
        background: var(--mat-sys-surface);
        border-radius: 12px;
        box-shadow: var(--mat-sys-elevation-level1);
      }

      .tab-content {
        padding: 24px;
        min-height: 400px;
      }

      .menu-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
      }

      .menu-header h2 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 500;
      }

      .menu-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
      }

      .menu-card {
        border-radius: 8px;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        height: fit-content;
      }

      .menu-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--mat-sys-elevation-level2);
      }

      .menu-avatar {
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .menu-avatar.single-step {
        background: var(--mat-sys-tertiary-container);
        color: var(--mat-sys-on-tertiary-container);
      }

      .single-step-menu {
        border-left: 4px solid var(--mat-sys-tertiary);
      }

      .customisation-card {
        border-left: 4px solid var(--mat-sys-secondary);
      }

      .menu-avatar.customisation {
        background: var(--mat-sys-secondary-container);
        color: var(--mat-sys-on-secondary-container);
      }

      .chip-type {
        background: var(--mat-sys-secondary-container);
        color: var(--mat-sys-on-secondary-container);
      }

      .chip-required {
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
      }

      .menu-image-container {
        height: 120px;
        overflow: hidden;
        border-radius: 8px 8px 0 0;
        background: var(--mat-sys-surface-variant);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .menu-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
      }

      .menu-description {
        color: var(--mat-sys-on-surface-variant);
        margin-bottom: 12px;
        min-height: 36px;
        font-size: 0.875rem;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .menu-meta {
        margin: 12px 0;
      }

      .menu-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .menu-chips mat-chip {
        font-size: 0.75rem;
        height: 24px;
        min-height: 24px;
      }

      .chip-available {
        background: var(--mat-sys-tertiary-container);
        color: var(--mat-sys-on-tertiary-container);
      }

      .chip-unavailable {
        background: var(--mat-sys-error-container);
        color: var(--mat-sys-on-error-container);
      }

      .chip-steps {
        background: var(--mat-sys-secondary-container);
        color: var(--mat-sys-on-secondary-container);
      }

      .chip-single-step {
        background: var(--mat-sys-tertiary-container);
        color: var(--mat-sys-on-tertiary-container);
      }

      .chip-options {
        background: var(--mat-sys-tertiary-container);
        color: var(--mat-sys-on-tertiary-container);
      }

      .chip-products {
        background: var(--mat-sys-secondary-container);
        color: var(--mat-sys-on-secondary-container);
      }

      .clickable {
        cursor: pointer;
        transition: opacity 0.2s ease;
        position: relative;
        user-select: none;
      }

      .clickable:hover {
        opacity: 0.8;
      }

      .clickable:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }

      .menu-actions {
        padding: 8px 8px 8px 8px;
        display: flex;
        gap: 1px;
        justify-content: space-between;
      }

      .action-button {
        font-size: 0.75rem;
        min-width: auto;
        padding: 4px 8px;
      }

      .action-button mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        margin-right: 4px;
      }

      .loading-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
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

      .empty-state {
        text-align: center;
        padding: 64px 24px;
        color: var(--mat-sys-on-surface-variant);
      }

      .empty-state mat-icon {
        font-size: 80px;
        width: 80px;
        height: 80px;
        margin-bottom: 24px;
        color: var(--mat-sys-outline);
      }

      .empty-state h3 {
        margin: 0 0 8px 0;
        font-weight: 500;
      }

      .empty-state p {
        margin: 0 0 24px 0;
      }

      @media (max-width: 768px) {


        h1 {
          font-size: 1.5rem;
        }

        .tab-content {
          padding: 16px;
        }

        .menu-header {
          flex-direction: column;
          align-items: stretch;
          gap: 16px;
        }

        .menu-grid {
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .menu-image-container {
          height: 100px;
        }

        .menu-actions {
          gap: 8px;
        }

        .action-button {
          width: 100%;
          justify-content: flex-start;
        }
      }
    `,
  ],
})
export class ProductManagerComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private productAdminService = inject(ProductAdminService);
  private vendorService = inject(VendorService);
  private supabaseService = inject(SupabaseService);
  private supabaseAuthService = inject(SupabaseAuthService);
  private customisationService = inject(CustomisationService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private destroy$ = new Subject<void>();

  menus: MenuAdmin[] = [];
  singleStepMenus: MenuAdmin[] = [];
  customisations: Customisation[] = [];
  categories: Category[] = [];
  currentVendorId: string | null = null;

  // Track loading states for individual menus and customisations
  private loadingMenus = new Set<number>();
  private loadingCustomisations = new Set<number>();
  
  // Track product counts for customisations
  customisationProductCounts = new Map<number, number>();

  ngOnInit() {
    this.loadCurrentVendor();
    this.loadCategories();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCurrentVendor() {
    this.vendorService.currentVendor$
      .pipe(takeUntil(this.destroy$))
      .subscribe((vendor) => {
        if (vendor?.id) {
          this.currentVendorId = vendor.id;
          this.loadMenus();
          this.loadCustomisations();
        }
      });
  }

  private loadCategories() {
    if (!this.currentVendorId) return;

    this.productAdminService
      .getCategories(this.currentVendorId)
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

  private loadMenus() {
    if (!this.currentVendorId) return;

    console.log('Loading menus for vendor:', this.currentVendorId);

    this.productAdminService
      .getMenus(this.currentVendorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (menus) => {
          console.log('Menus loaded successfully:', menus.length);
          // Separate menus by step count
          this.singleStepMenus = menus.filter((menu) => {
            // Check if menu has exactly 1 step
            const stepCount = menu.step_count || menu.steps?.length || 0;
            return stepCount === 1;
          });

          this.menus = menus.filter((menu) => {
            // Check if menu has more than 1 step
            const stepCount = menu.step_count || menu.steps?.length || 0;
            return stepCount !== 1; // Show menus with 0 steps or 2+ steps
          });
        },
        error: (error) => {
          console.error('Error loading menus:', error);

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
            // Optionally trigger logout or redirect to login
            // this.authService.logout();
          } else {
            this.snackBar.open(
              'Erreur lors du chargement des menus',
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

  isMenuLoading(menuId: number): boolean {
    return this.loadingMenus.has(menuId);
  }

  async toggleMenuAvailability(menu: MenuAdmin) {
    // Prevent multiple simultaneous updates for the same menu
    if (this.isMenuLoading(menu.id)) {
      return;
    }

    // Add menu to loading set
    this.loadingMenus.add(menu.id);

    try {
      const newAvailability = !menu.is_available;

      // Optimistic update - temporarily update the menu in the UI
      const updateMenuInArrays = (menuToUpdate: MenuAdmin) => {
        menuToUpdate.is_available = newAvailability;
      };

      // Update in both arrays
      this.menus = this.menus.map((m) =>
        m.id === menu.id ? { ...m, is_available: newAvailability } : m
      );
      this.singleStepMenus = this.singleStepMenus.map((m) =>
        m.id === menu.id ? { ...m, is_available: newAvailability } : m
      );

      // Perform the actual database update
      await this.supabaseAuthService.updateProductAvailability(
        menu.id,
        newAvailability
      );

      // Show success message
      const statusText = newAvailability ? 'disponible' : 'indisponible';
      this.snackBar.open(`${menu.name} est maintenant ${statusText}`, 'OK', {
        duration: 3000,
        panelClass: ['success-snackbar'],
      });
    } catch (error: any) {
      console.error('Error updating menu availability:', error);

      // Revert optimistic update by reloading menus
      this.loadMenus();

      // Show error message
      this.snackBar.open('Erreur lors de la mise à jour du menu', 'Fermer', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    } finally {
      // Always remove from loading set
      this.loadingMenus.delete(menu.id);
    }
  }

  trackByMenuId(index: number, menu: MenuAdmin): number {
    return menu.id;
  }

  getTotalOptionsCount(menu: MenuAdmin): number {
    if (!menu.steps) return 0;
    return menu.steps.reduce((total, step) => {
      return total + (step.options?.length || 0);
    }, 0);
  }

  createMenu() {
    this.router.navigate(['menu', 'new'], { relativeTo: this.route });
  }

  editMenu(menu: MenuAdmin) {
    this.router.navigate(['menu', menu.id], { relativeTo: this.route });
  }

  duplicateMenu(menu: MenuAdmin) {
    // Add confirmation dialog
    if (!confirm(`Voulez-vous dupliquer le menu "${menu.name}" ?`)) {
      return;
    }

    if (!this.currentVendorId) {
      this.snackBar.open('Vendor ID non disponible', 'Fermer', {
        duration: 3000,
        panelClass: ['error-snackbar'],
      });
      return;
    }

    // Show loading message
    this.snackBar.open('Duplication en cours...', '', {
      duration: 0, // Keep open until manually dismissed
    });

    // First, get the complete menu data including all steps and options
    this.productAdminService
      .getMenuById(menu.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (completeMenu) => {
          // Create the duplicated menu data
          const duplicatedMenuData: MenuFormData = {
            name: `${completeMenu.name} (Copie)`,
            price: completeMenu.price,
            image_url: completeMenu.image_url,
            short_description: completeMenu.short_description,
            long_description: completeMenu.long_description,
            category_id: completeMenu.category_id,
            is_available: completeMenu.is_available || false,
            stock_quantity: completeMenu.stock_quantity,
            no_catalogable: completeMenu.no_catalogable || false,
          };

          // Create the new menu
          this.productAdminService
            .createMenu(this.currentVendorId!, duplicatedMenuData)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (newMenu) => {
                // If the original menu has steps, duplicate them
                if (completeMenu.steps && completeMenu.steps.length > 0) {
                  // Prepare the steps data for duplication
                  const stepsData = completeMenu.steps.map((step) => ({
                    name: step.name,
                    step_type: step.step_type,
                    description: step.description,
                    is_required: step.is_required,
                    min_selections: step.min_selections,
                    max_selections: step.max_selections,
                    display_order: step.display_order,
                    // Map the options to products format expected by saveMenuSteps
                    products: (step.options || [])
                      .map((option, index) => ({
                        id: option.product_id,
                        name: option.name,
                        price_adjustment: option.price_adjustment,
                        description: option.description,
                        image_url: option.image_url,
                        display_order: index + 1,
                        is_available: option.is_available,
                      }))
                      .filter((product) => product.id !== null), // Filter out component-type options without product_id
                  }));

                  // Save the steps and options to the new menu
                  this.productAdminService
                    .saveMenuSteps(newMenu.id, stepsData, this.currentVendorId!)
                    .then(() => {
                      // Dismiss loading message
                      this.snackBar.dismiss();

                      // Show success message
                      this.snackBar.open(
                        `Menu "${newMenu.name}" dupliqué avec succès avec ${
                          stepsData.length
                        } étape${stepsData.length > 1 ? 's' : ''}`,
                        'Fermer',
                        {
                          duration: 5000,
                          panelClass: ['success-snackbar'],
                        }
                      );

                      // Reload the menus to show the duplicated one
                      this.loadMenus();
                    })
                    .catch((error) => {
                      console.error(
                        'Error saving duplicated menu steps:',
                        error
                      );
                      this.snackBar.dismiss();
                      this.snackBar.open(
                        'Erreur lors de la duplication des étapes',
                        'Fermer',
                        {
                          duration: 5000,
                          panelClass: ['error-snackbar'],
                        }
                      );
                    });
                } else {
                  // No steps to duplicate, just show success message
                  this.snackBar.dismiss();
                  this.snackBar.open(
                    `Menu "${newMenu.name}" dupliqué avec succès`,
                    'Fermer',
                    {
                      duration: 5000,
                      panelClass: ['success-snackbar'],
                    }
                  );

                  // Reload the menus to show the duplicated one
                  this.loadMenus();
                }
              },
              error: (error) => {
                console.error('Error creating duplicated menu:', error);
                this.snackBar.dismiss();
                this.snackBar.open(
                  'Erreur lors de la création du menu dupliqué',
                  'Fermer',
                  {
                    duration: 5000,
                    panelClass: ['error-snackbar'],
                  }
                );
              },
            });
        },
        error: (error) => {
          console.error('Error fetching menu for duplication:', error);
          this.snackBar.dismiss();
          this.snackBar.open(
            'Erreur lors de la récupération des données du menu',
            'Fermer',
            {
              duration: 5000,
              panelClass: ['error-snackbar'],
            }
          );
        },
      });
  }

  deleteMenu(menu: MenuAdmin) {
    if (
      confirm(`Êtes-vous sûr de vouloir supprimer le menu "${menu.name}" ?`)
    ) {
      this.productAdminService
        .deleteMenu(menu.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadMenus();
            this.snackBar.open('Menu supprimé avec succès', 'Fermer', {
              duration: 3000,
              panelClass: ['success-snackbar'],
            });
          },
          error: (error) => {
            console.error('Error deleting menu:', error);
            this.snackBar.open('Erreur lors de la suppression', 'Fermer', {
              duration: 5000,
              panelClass: ['error-snackbar'],
            });
          },
        });
    }
  }

  // Customisation methods

  private loadCustomisations() {
    if (!this.currentVendorId) return;

    this.customisationService
      .getCustomisations(this.currentVendorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (customisations) => {
          this.customisations = customisations;
          // Load product counts for each customisation
          this.loadCustomisationProductCounts();
        },
        error: (error) => {
          console.error('Error loading customisations:', error);
          this.snackBar.open(
            'Erreur lors du chargement des customisations',
            'Fermer',
            {
              duration: 5000,
              panelClass: ['error-snackbar'],
            }
          );
        },
      });
  }

  private loadCustomisationProductCounts() {
    this.customisations.forEach((customisation) => {
      this.customisationService
        .getCustomisationProducts(customisation.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (productIds) => {
            this.customisationProductCounts.set(customisation.id, productIds.length);
          },
          error: (error) => {
            console.error(`Error loading product count for customisation ${customisation.id}:`, error);
          },
        });
    });
  }

  getCustomisationProductCount(customisationId: number): number {
    return this.customisationProductCounts.get(customisationId) || 0;
  }

  trackByCustomisationId(index: number, customisation: Customisation): number {
    return customisation.id;
  }

  getCustomisationOptionsCount(customisation: Customisation): number {
    return customisation.options?.length || 0;
  }

  isCustomisationLoading(customisationId: number): boolean {
    return this.loadingCustomisations.has(customisationId);
  }

  createCustomisation() {
    // Will be implemented with the customisation edit dialog
    import('./customisation-edit-dialog/customisation-edit-dialog.component').then(
      ({ CustomisationEditDialogComponent }) => {
        const dialogRef = this.dialog.open(CustomisationEditDialogComponent, {
          width: '90vw',
          maxWidth: '1200px',
          height: '90vh',
          maxHeight: '900px',
          data: {
            vendorId: this.currentVendorId,
          },
          disableClose: true,
        });

        dialogRef.afterClosed().subscribe((result) => {
          if (result) {
            this.loadCustomisations();
          }
        });
      }
    );
  }

  editCustomisation(customisation: Customisation) {
    import('./customisation-edit-dialog/customisation-edit-dialog.component').then(
      ({ CustomisationEditDialogComponent }) => {
        const dialogRef = this.dialog.open(CustomisationEditDialogComponent, {
          width: '90vw',
          maxWidth: '1200px',
          height: '90vh',
          maxHeight: '900px',
          data: {
            customisation,
            vendorId: this.currentVendorId,
          },
          disableClose: true,
        });

        dialogRef.afterClosed().subscribe((result) => {
          if (result) {
            this.loadCustomisations();
          }
        });
      }
    );
  }

  duplicateCustomisation(customisation: Customisation) {
    if (
      !confirm(`Voulez-vous dupliquer la customisation "${customisation.name}" ?`)
    ) {
      return;
    }

    if (!this.currentVendorId) {
      this.snackBar.open('Vendor ID non disponible', 'Fermer', {
        duration: 3000,
        panelClass: ['error-snackbar'],
      });
      return;
    }

    this.snackBar.open('Duplication en cours...', '', {
      duration: 0,
    });

    // First, get the complete customisation data
    this.customisationService
      .getCustomisation(customisation.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (completeCustomisation) => {
          // Create the duplicated customisation data
          const duplicatedData = {
            name: `${completeCustomisation.name} (Copie)`,
            description: completeCustomisation.description,
            selection_type: completeCustomisation.selection_type,
            is_required: completeCustomisation.is_required,
            min_selections: completeCustomisation.min_selections,
            max_selections: completeCustomisation.max_selections,
            display_order: completeCustomisation.display_order,
            is_available: completeCustomisation.is_available,
          };

          // Create the new customisation
          this.customisationService
            .createCustomisation(this.currentVendorId!, duplicatedData)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (newCustomisation) => {
                // If the original has options, duplicate them
                if (
                  completeCustomisation.options &&
                  completeCustomisation.options.length > 0
                ) {
                  const optionPromises = completeCustomisation.options.map(
                    (option) => {
                      const optionData = {
                        name: option.name,
                        product_id: option.product_id,
                        price_adjustment: option.price_adjustment,
                        display_order: option.display_order,
                        is_available: option.is_available,
                        option_type: option.option_type,
                        description: option.description,
                        image_url: option.image_url,
                      };
                      return this.customisationService
                        .addOption(newCustomisation.id, optionData)
                        .toPromise();
                    }
                  );

                  Promise.all(optionPromises)
                    .then(() => {
                      this.snackBar.dismiss();
                      this.snackBar.open(
                        `Customisation "${newCustomisation.name}" dupliquée avec succès`,
                        'Fermer',
                        {
                          duration: 5000,
                          panelClass: ['success-snackbar'],
                        }
                      );
                      this.loadCustomisations();
                    })
                    .catch((error) => {
                      console.error('Error duplicating options:', error);
                      this.snackBar.dismiss();
                      this.snackBar.open(
                        'Erreur lors de la duplication des options',
                        'Fermer',
                        {
                          duration: 5000,
                          panelClass: ['error-snackbar'],
                        }
                      );
                    });
                } else {
                  this.snackBar.dismiss();
                  this.snackBar.open(
                    `Customisation "${newCustomisation.name}" dupliquée avec succès`,
                    'Fermer',
                    {
                      duration: 5000,
                      panelClass: ['success-snackbar'],
                    }
                  );
                  this.loadCustomisations();
                }
              },
              error: (error) => {
                console.error('Error creating duplicated customisation:', error);
                this.snackBar.dismiss();
                this.snackBar.open(
                  'Erreur lors de la création de la customisation',
                  'Fermer',
                  {
                    duration: 5000,
                    panelClass: ['error-snackbar'],
                  }
                );
              },
            });
        },
        error: (error) => {
          console.error('Error fetching customisation for duplication:', error);
          this.snackBar.dismiss();
          this.snackBar.open(
            'Erreur lors de la récupération des données',
            'Fermer',
            {
              duration: 5000,
              panelClass: ['error-snackbar'],
            }
          );
        },
      });
  }

  async toggleCustomisationAvailability(customisation: Customisation) {
    if (this.isCustomisationLoading(customisation.id)) {
      return;
    }

    this.loadingCustomisations.add(customisation.id);

    try {
      const newAvailability = !customisation.is_available;

      // Optimistic update
      this.customisations = this.customisations.map((c) =>
        c.id === customisation.id
          ? { ...c, is_available: newAvailability }
          : c
      );

      // Perform the actual update
      await this.customisationService
        .toggleCustomisationAvailability(customisation.id, newAvailability)
        .toPromise();

      const statusText = newAvailability ? 'disponible' : 'indisponible';
      this.snackBar.open(
        `${customisation.name} est maintenant ${statusText}`,
        'OK',
        {
          duration: 3000,
          panelClass: ['success-snackbar'],
        }
      );
    } catch (error: any) {
      console.error('Error updating customisation availability:', error);

      // Revert optimistic update
      this.loadCustomisations();

      this.snackBar.open(
        'Erreur lors de la mise à jour de la customisation',
        'Fermer',
        {
          duration: 5000,
          panelClass: ['error-snackbar'],
        }
      );
    } finally {
      this.loadingCustomisations.delete(customisation.id);
    }
  }

  deleteCustomisation(customisation: Customisation) {
    if (
      confirm(
        `Êtes-vous sûr de vouloir supprimer la customisation "${customisation.name}" ?`
      )
    ) {
      this.customisationService
        .deleteCustomisation(customisation.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadCustomisations();
            this.snackBar.open('Customisation supprimée avec succès', 'Fermer', {
              duration: 3000,
              panelClass: ['success-snackbar'],
            });
          },
          error: (error) => {
            console.error('Error deleting customisation:', error);
            this.snackBar.open('Erreur lors de la suppression', 'Fermer', {
              duration: 5000,
              panelClass: ['error-snackbar'],
            });
          },
        });
    }
  }
}
