import { Injectable, inject } from '@angular/core';
import { from, Observable, combineLatest, forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { SupabaseAuthService } from './supabase-auth.service';
import { CategoryService } from './category.service';
import { CustomisationService } from './customisation.service';
import { VendorService } from './vendor.service';
import { Tables } from '../types/supabase.types';
import {
  ProductWithComplements,
  ProductComplement,
  ComplementSelection,
  DatabaseProductComplementInsert,
} from '../models/complement.model';
import { getDefaultVatRate } from '../shared/utils/vat-rates.util';
import { UPSELLABLE_CATEGORY_TYPES } from '../models/category-type.model';

export interface Product {
  id: number;
  name: string;
  price: number;
  tvaRate: number;
  imageUrl: string;
  categoryId: number;
  description: string;
  shortDescription: string;
  longDescription: string;
  vendorId?: string;
  isMultiStep?: boolean;
  displayOrder: number;
  stockQuantity?: number | null;
  hasCustomisations?: boolean;
  customisations?: import('../models/customisation.interface').Customisation[];
  isAccessory?: boolean;
  applicableOrderTypes?: string[];
  iconEmoji?: string;
  maxQuantityPerOrder?: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private supabaseService = inject(SupabaseService);
  private supabaseAuthService = inject(SupabaseAuthService);
  private categoryService = inject(CategoryService);
  private customisationService = inject(CustomisationService);
  private vendorService = inject(VendorService);

  // Accessories cache: key = vendorId_orderType, value = { data, timestamp }
  private accessoriesCache = new Map<string, { data: Product[]; timestamp: number }>();
  private readonly ACCESSORIES_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  // Upsell pool + menu-containment caches, same shape and lifetime as the
  // accessories cache.
  private upsellPoolCache = new Map<string, { data: Product[]; timestamp: number }>();
  private menuContainmentCache = new Map<string, { data: Product[]; timestamp: number }>();
  private readonly UPSELL_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  getProducts(vendorId?: string): Observable<Product[]> {
    // Combine products and categories to sort by category displayOrder when no category filter is applied
    return combineLatest([
      from(this.supabaseService.getProducts(undefined, vendorId)).pipe(
        map((products) => products?.map((p) => this.mapToProduct(p)) || [])
      ),
      vendorId
        ? this.categoryService.getCategoriesByVendor(vendorId)
        : this.categoryService.getCategories(),
    ]).pipe(
      map(([products, categories]) => {
        // Sort products by their category's displayOrder, then by product's displayOrder within category
        return products.sort((a, b) => {
          const categoryA = categories.find((c) => c.id === a.categoryId);
          const categoryB = categories.find((c) => c.id === b.categoryId);
          if (!categoryA || !categoryB) return 0;

          // First sort by category display order
          const categoryDisplayOrderA = categoryA.displayOrder ?? 0;
          const categoryDisplayOrderB = categoryB.displayOrder ?? 0;
          if (categoryDisplayOrderA !== categoryDisplayOrderB) {
            return categoryDisplayOrderA - categoryDisplayOrderB;
          }

          // Then sort by product display order within the same category
          const productDisplayOrderA = a.displayOrder ?? 0;
          const productDisplayOrderB = b.displayOrder ?? 0;
          return productDisplayOrderA - productDisplayOrderB;
        });
      })
    );
  }

  getProductsByCategory(
    categoryId: number,
    vendorId?: string
  ): Observable<Product[]> {
    return from(this.supabaseService.getProducts(categoryId, vendorId)).pipe(
      map((products) => {
        const mappedProducts = products?.map((p) => this.mapToProduct(p)) || [];
        // Sort products by their display_order within the category
        return mappedProducts.sort((a, b) => {
          const displayOrderA = a.displayOrder ?? 0;
          const displayOrderB = b.displayOrder ?? 0;
          return displayOrderA - displayOrderB;
        });
      })
    );
  }

  getAllProducts(vendorId?: string): Observable<Product[]> {
    // Combine products and categories to sort by category displayOrder
    return combineLatest([
      from(this.supabaseService.getAllProducts(vendorId)).pipe(
        map((products) => products?.map((p) => this.mapToProduct(p)) || [])
      ),
      vendorId
        ? this.categoryService.getCategoriesByVendor(vendorId)
        : this.categoryService.getCategories(),
    ]).pipe(
      map(([products, categories]) => {
        // Sort products by their category's displayOrder, then by product's displayOrder within category
        return products.sort((a, b) => {
          const categoryA = categories.find((c) => c.id === a.categoryId);
          const categoryB = categories.find((c) => c.id === b.categoryId);
          if (!categoryA || !categoryB) return 0;

          // First sort by category display order
          const categoryDisplayOrderA = categoryA.displayOrder ?? 0;
          const categoryDisplayOrderB = categoryB.displayOrder ?? 0;
          if (categoryDisplayOrderA !== categoryDisplayOrderB) {
            return categoryDisplayOrderA - categoryDisplayOrderB;
          }

          // Then sort by product display order within the same category
          const productDisplayOrderA = a.displayOrder ?? 0;
          const productDisplayOrderB = b.displayOrder ?? 0;
          return productDisplayOrderA - productDisplayOrderB;
        });
      })
    );
  }

  getProductById(id: number): Observable<Product | null> {
    return from(this.supabaseService.getProductById(id)).pipe(
      map((product) => (product ? this.mapToProduct(product) : null))
    );
  }

  getProductWithCustomisations(id: number): Observable<Product | null> {
    return from(this.supabaseService.getProductById(id)).pipe(
      switchMap((dbProduct) => {
        if (!dbProduct) {
          return of(null);
        }

        const product = this.mapToProduct(dbProduct);

        // If product has customisations, fetch them
        if (product.hasCustomisations && product.vendorId) {
          return this.customisationService
            .getProductCustomisations(product.id)
            .pipe(
              map((customisations) => ({
                ...product,
                customisations,
              }))
            );
        }

        return of(product);
      })
    );
  }

  // Complement-related methods
  getProductWithComplements(
    productId: number
  ): Observable<ProductWithComplements | null> {
    return from(this.supabaseService.getProductWithComplements(productId)).pipe(
      map((product) =>
        product ? this.mapToProductWithComplements(product) : null
      )
    );
  }

  getProductComplements(productId: number): Observable<ProductComplement[]> {
    return from(this.supabaseService.getProductComplements(productId)).pipe(
      map(
        (complements) =>
          complements?.map((c: any) => this.mapToProductComplement(c)) || []
      )
    );
  }

  // Complement writes are admin operations and must run on the authenticated
  // client — RLS only allows the vendor's own admins to modify complements.
  createProductComplement(
    complementData: DatabaseProductComplementInsert
  ): Observable<ProductComplement> {
    return from(
      this.supabaseAuthService.createProductComplement(complementData)
    ).pipe(map((complement) => this.mapToProductComplement(complement)));
  }

  updateProductComplement(
    complementId: string,
    complementData: Partial<DatabaseProductComplementInsert>
  ): Observable<ProductComplement> {
    return from(
      this.supabaseAuthService.updateProductComplement(
        complementId,
        complementData
      )
    ).pipe(map((complement) => this.mapToProductComplement(complement)));
  }

  deleteProductComplement(complementId: string): Observable<void> {
    return from(
      this.supabaseAuthService.deleteProductComplement(complementId)
    );
  }

  // Calculate the price for a complement based on custom pricing rules
  calculateComplementPrice(complement: ProductComplement): number {
    if (complement.is_free) {
      return 0;
    }
    if (
      complement.custom_price !== null &&
      complement.custom_price !== undefined
    ) {
      return complement.custom_price;
    }
    return complement.complement_product?.price || 0;
  }

  // Calculate total price for complement selections
  calculateComplementSelectionTotal(
    complements: ProductComplement[],
    selections: ComplementSelection[]
  ): number {
    return selections.reduce((total, selection) => {
      const complement = complements.find(
        (c) => c.complement_product_id === selection.complement_product_id
      );
      if (complement) {
        const unitPrice = this.calculateComplementPrice(complement);
        return total + unitPrice * selection.quantity;
      }
      return total;
    }, 0);
  }

  // Validate complement selections against rules
  validateComplementSelections(
    complements: ProductComplement[],
    selections: ComplementSelection[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Group complements by their selection rules
    const complementGroups = this.groupComplementsByType(complements);

    for (const group of complementGroups) {
      const groupSelections = selections.filter((s) =>
        group.complements.some(
          (c: ProductComplement) =>
            c.complement_product_id === s.complement_product_id
        )
      );

      if (group.is_required && groupSelections.length === 0) {
        errors.push(`${group.title} is required`);
      }

      if (group.selection_type === 'single' && groupSelections.length > 1) {
        errors.push(`Only one ${group.title} can be selected`);
      }

      if (
        group.selection_type === 'multiple' &&
        groupSelections.length > group.max_selections
      ) {
        errors.push(
          `Maximum ${group.max_selections} ${group.title} can be selected`
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  getAccessories(vendorId: string, orderType?: string): Observable<Product[]> {
    const cacheKey = `${vendorId}_${orderType || 'all'}`;
    const cached = this.accessoriesCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.ACCESSORIES_CACHE_TTL) {
      return of(cached.data);
    }

    return from(this.supabaseService.getAccessories(vendorId, orderType)).pipe(
      map((products) => {
        const mapped = products?.map((p) => this.mapToProduct(p)) || [];
        this.accessoriesCache.set(cacheKey, { data: mapped, timestamp: Date.now() });
        return mapped;
      })
    );
  }

  getUpsellPool(vendorId: string, orderType?: string): Observable<Product[]> {
    const cacheKey = `${vendorId}_${orderType || 'all'}`;
    const cached = this.upsellPoolCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.UPSELL_CACHE_TTL) {
      return of(cached.data);
    }

    return from(
      this.supabaseService.getUpsellProducts(
        vendorId,
        UPSELLABLE_CATEGORY_TYPES,
        orderType
      )
    ).pipe(
      map((products) => {
        const mapped = products?.map((p) => this.mapToProduct(p)) || [];
        this.upsellPoolCache.set(cacheKey, { data: mapped, timestamp: Date.now() });
        return mapped;
      })
    );
  }

  getMenusContaining(productId: number, vendorId: string): Observable<Product[]> {
    const cacheKey = `${vendorId}_${productId}`;
    const cached = this.menuContainmentCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.UPSELL_CACHE_TTL) {
      return of(cached.data);
    }

    return from(
      this.supabaseService.getMenusContainingProduct(productId, vendorId)
    ).pipe(
      map((menus) => {
        const mapped = menus?.map((m) => this.mapToProduct(m)) || [];
        this.menuContainmentCache.set(cacheKey, { data: mapped, timestamp: Date.now() });
        return mapped;
      })
    );
  }

  private groupComplementsByType(complements: ProductComplement[]): any[] {
    // For now, we'll treat all complements as one group
    // In the future, this could be extended to support multiple complement groups
    if (complements.length === 0) return [];

    const firstComplement = complements[0];
    return [
      {
        id: 'default',
        title: 'Complements',
        is_required: firstComplement.is_required,
        selection_type: firstComplement.selection_type,
        max_selections: firstComplement.max_selections,
        complements,
      },
    ];
  }

  private mapToProduct(dbProduct: any): Product {
    const defaultVatRate = getDefaultVatRate(
      dbProduct.vendor?.country ?? this.vendorService.getCurrentVendor()?.country
    );

    return {
      id: dbProduct.id,
      name: dbProduct.name,
      price: Number(dbProduct.price),
      tvaRate: Number(dbProduct.tva_rate) || defaultVatRate,
      imageUrl: dbProduct.image_url || '',
      categoryId: dbProduct.category_id || 0,
      description: dbProduct.short_description || '',
      shortDescription: dbProduct.short_description || '',
      longDescription: dbProduct.long_description || '',
      vendorId: dbProduct.vendor_id,
      isMultiStep: dbProduct.is_multi_step,
      displayOrder: dbProduct.display_order || 0,
      stockQuantity: dbProduct.stock_quantity,
      hasCustomisations: dbProduct.has_customisations || false,
      isAccessory: dbProduct.is_accessory || false,
      applicableOrderTypes: dbProduct.applicable_order_types || ['eat-in', 'take-away', 'delivery'],
      iconEmoji: dbProduct.icon_emoji || '',
      maxQuantityPerOrder: dbProduct.max_quantity_per_order ?? null,
    };
  }

  private mapToProductWithComplements(dbProduct: any): ProductWithComplements {
    const product = this.mapToProduct(dbProduct);
    return {
      ...product,
      complements:
        dbProduct.product_complements?.map((c: any) =>
          this.mapToProductComplement(c)
        ) || [],
    };
  }

  private mapToProductComplement(dbComplement: any): ProductComplement {
    return {
      id: dbComplement.id,
      product_id: dbComplement.product_id,
      complement_product_id: dbComplement.complement_product_id,
      is_required: dbComplement.is_required || false,
      selection_type: dbComplement.selection_type || 'single',
      max_selections: dbComplement.max_selections || 1,
      display_order: dbComplement.display_order || 0,
      custom_price: dbComplement.custom_price,
      is_free: dbComplement.is_free || false,
      created_at: dbComplement.created_at,
      updated_at: dbComplement.updated_at,
      complement_product: dbComplement.complement_product
        ? {
            id: dbComplement.complement_product.id,
            name: dbComplement.complement_product.name,
            price: Number(dbComplement.complement_product.price),
            image_url: dbComplement.complement_product.image_url,
            short_description:
              dbComplement.complement_product.short_description,
            is_available: dbComplement.complement_product.is_available,
          }
        : undefined,
    };
  }

  private loadCustomisationsForProducts(
    products: Product[]
  ): Observable<Product[]> {
    // Find products that have customisations
    const productsWithCustomisations = products.filter(
      (p) => p.hasCustomisations
    );

    if (productsWithCustomisations.length === 0) {
      return of(products);
    }

    // Load customisations for each product that has them
    const customisationRequests = productsWithCustomisations.map((product) =>
      this.customisationService.getProductCustomisations(product.id).pipe(
        map((customisations) => ({
          productId: product.id,
          customisations,
        }))
      )
    );

    return forkJoin(customisationRequests).pipe(
      map((results) => {
        // Create a map of product ID to customisations
        const customisationsMap = new Map(
          results.map((r) => [r.productId, r.customisations])
        );

        // Return products with customisations attached
        return products.map((product) => {
          if (product.hasCustomisations) {
            return {
              ...product,
              customisations: customisationsMap.get(product.id) || [],
            };
          }
          return product;
        });
      })
    );
  }
}
