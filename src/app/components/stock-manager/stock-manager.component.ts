import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { ProductService } from '../../services/product.service';
import { SupabaseService } from '../../services/supabase.service';
import { CategoryService } from '../../services/category.service';
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
} from 'rxjs';
import { map, startWith } from 'rxjs/operators';

export interface ProductWithCategory {
  id: number;
  name: string;
  price: number;
  imageUrl: string;
  categoryId: number;
  categoryName: string;
  description: string;
  shortDescription: string;
  longDescription: string;
  isAvailable: boolean;
  stockQuantity?: number;
}

@Component({
  selector: 'app-stock-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatChipsModule,
  ],
  templateUrl: './stock-manager.component.html',
  styleUrl: './stock-manager.component.scss',
})
export class StockManagerComponent implements OnInit {
  private productService = inject(ProductService);
  private supabaseService = inject(SupabaseService);
  private categoryService = inject(CategoryService);
  private snackBar = inject(MatSnackBar);
  private changeDetectorRef = inject(ChangeDetectorRef);

  // Loading states
  isLoading = signal(false);
  private loadingProductsSubject = new BehaviorSubject<Set<number>>(new Set());
  loadingProducts$ = this.loadingProductsSubject.asObservable();

  // Search functionality
  searchTerm = signal('');
  private searchSubject = new BehaviorSubject<string>('');

  // Data
  private productsSubject = new BehaviorSubject<ProductWithCategory[]>([]);
  products$ = this.productsSubject.asObservable();

  // Filtered products based on search
  filteredProducts$ = combineLatest([
    this.products$,
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      startWith('')
    ),
  ]).pipe(
    map(([products, searchTerm]) => {
      if (!searchTerm.trim()) {
        return products;
      }

      const term = searchTerm.toLowerCase().trim();
      return products.filter(
        (product) =>
          product.name.toLowerCase().includes(term) ||
          product.categoryName.toLowerCase().includes(term) ||
          product.description.toLowerCase().includes(term)
      );
    })
  );

  // Statistics - Remplacer les computed() par des observables réactifs
  totalProducts$ = this.products$.pipe(map((products) => products.length));

  availableProducts$ = this.products$.pipe(
    map((products) => products.filter((p) => p.isAvailable).length)
  );

  unavailableProducts$ = this.products$.pipe(
    map((products) => products.filter((p) => !p.isAvailable).length)
  );

  ngOnInit() {
    this.loadProducts();

    // Setup search
    this.searchSubject.subscribe((term) => {
      this.searchTerm.set(term);
    });
  }

  async loadProducts() {
    this.isLoading.set(true);
    try {
      // Load products and categories in parallel
      const [productsData, categoriesData] = await Promise.all([
        this.supabaseService.getAllProducts(),
        this.supabaseService.getCategories(),
      ]);

      // Create category lookup map
      const categoryMap = new Map(
        categoriesData?.map((cat: any) => [cat.id, cat.name]) || []
      );

      // Map products with category names
      const productsWithCategories: ProductWithCategory[] =
        productsData?.map((product: any) => ({
          id: product.id,
          name: product.name,
          price: Number(product.price),
          imageUrl: product.image_url || '',
          categoryId: product.category_id || 0,
          categoryName:
            categoryMap.get(product.category_id || 0) || 'Sans catégorie',
          description: product.short_description || '',
          shortDescription: product.short_description || '',
          longDescription: product.long_description || '',
          isAvailable: product.is_available ?? true,
          stockQuantity: product.stock_quantity || 0,
        })) || [];

      // Sort by category name, then by product name
      productsWithCategories.sort((a, b) => {
        const categoryCompare = a.categoryName.localeCompare(b.categoryName);
        if (categoryCompare !== 0) return categoryCompare;
        return a.name.localeCompare(b.name);
      });

      this.productsSubject.next(productsWithCategories);
    } catch (error) {
      console.error('Error loading products:', error);
      this.showErrorMessage('Erreur lors du chargement des produits');
    } finally {
      this.isLoading.set(false);
    }
  }

  async updateProductAvailability(
    product: ProductWithCategory,
    newAvailability: boolean
  ) {
    // Prevent multiple simultaneous updates for the same product
    if (this.isProductLoading(product.id)) {
      return;
    }

    // Add product to loading set
    this.setProductLoading(product.id, true);

    try {
      // Optimistic update - temporarily update the product in the UI
      const currentProducts = this.productsSubject.value;
      const optimisticProducts = currentProducts.map((p) =>
        p.id === product.id ? { ...p, isAvailable: newAvailability } : p
      );
      this.productsSubject.next(optimisticProducts);

      // Trigger change detection to ensure UI updates immediately
      this.changeDetectorRef.detectChanges();

      // Perform the actual database update
      await this.supabaseService.updateProductAvailability(
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
      await this.loadProducts();

      // Show error message
      this.showErrorMessage('Erreur lors de la mise à jour du produit');
    } finally {
      // Always remove from loading set
      this.setProductLoading(product.id, false);
    }
  }

  private setProductLoading(productId: number, loading: boolean) {
    const currentLoadingProducts = this.loadingProductsSubject.value;
    const newLoadingProducts = new Set(currentLoadingProducts);

    if (loading) {
      newLoadingProducts.add(productId);
    } else {
      newLoadingProducts.delete(productId);
    }

    this.loadingProductsSubject.next(newLoadingProducts);
  }

  isProductLoading(productId: number): boolean {
    return this.loadingProductsSubject.value.has(productId);
  }

  onSearchChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchSubject.next(input.value);
  }

  clearSearch() {
    this.searchSubject.next('');
    this.searchTerm.set('');
  }

  private showErrorMessage(message: string) {
    this.snackBar.open(message, 'Fermer', {
      duration: 5000,
      panelClass: ['error-snackbar'],
    });
  }

  // Track by function for better performance with ngFor
  trackByProductId(index: number, product: ProductWithCategory): number {
    return product.id;
  }
}
