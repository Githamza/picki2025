import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { SupabaseAuthService } from './supabase-auth.service';
import {
  ProductAdmin,
  ProductFormData,
  Category,
  MenuAdmin,
  MenuFormData,
  MenuStep,
  MenuStepOption,
} from '../models/product-admin.interface';

@Injectable({
  providedIn: 'root',
})
export class ProductAdminService {
  private supabaseService = inject(SupabaseService);
  private supabaseAuthService = inject(SupabaseAuthService);

  // Get all products for a vendor with category information
  getProducts(vendorId: string): Observable<ProductAdmin[]> {
    return from(this.fetchProductsWithCategories(vendorId));
  }

  // Get categories for dropdown
  getCategories(vendorId: string): Observable<Category[]> {
    return from(this.getCategoriesByVendor(vendorId));
  }

  async getCategoriesByVendor(vendorId: string) {
    if (!vendorId) {
      throw new Error('ProductAdminService.getCategoriesByVendor: vendorId is required');
    }

    const { data, error } = await this.supabaseAuthService
      .getClient()
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .eq('vendorId', vendorId)
      .order('display_order');

    if (error) throw error;
    return data;
  }

  // Update a product
  updateProduct(
    id: number,
    productData: ProductFormData
  ): Observable<ProductAdmin> {
    return from(this.updateProductInDb(id, productData));
  }

  // Create a new product
  createProduct(
    vendorId: string,
    productData: ProductFormData
  ): Observable<ProductAdmin> {
    return from(this.createProductInDb(vendorId, productData));
  }

  // Delete a product
  deleteProduct(id: number): Observable<void> {
    return from(this.deleteProductFromDb(id));
  }

  private async fetchProductsWithCategories(
    vendorId: string
  ): Promise<ProductAdmin[]> {
    try {
      console.log(
        'Making database call with authenticated client for vendor:',
        vendorId
      );

      const { data: products, error } = await this.supabaseAuthService
        .getClient()
        .from('products')
        .select(
          `
          *,
          categories!products_category_id_fkey(name)
        `
        )
        .eq('vendor_id', vendorId)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching products:', error);
        throw error;
      }

      console.log('Successfully fetched products:', products?.length || 0);

      return (
        products?.map((product: any) => ({
          ...product,
          category_name: product.categories?.name || null,
          has_customisations: product.has_customisations ?? undefined,
        })) || []
      );
    } catch (error) {
      console.error(
        'Database call failed in fetchProductsWithCategories:',
        error
      );
      throw error;
    }
  }

  private async fetchCategories(): Promise<Category[]> {
    try {
      const { data: categories, error } = await this.supabaseAuthService
        .getClient()
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .eq('vendorId', this.supabaseAuthService.getCurrentVendorId())
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching categories:', error);
        throw error;
      }

      return categories || [];
    } catch (error) {
      console.error('Database call failed in fetchCategories:', error);
      throw error;
    }
  }

  private async updateProductInDb(
    id: number,
    productData: ProductFormData
  ): Promise<ProductAdmin> {
    const { data: product, error } = await this.supabaseAuthService
      .getClient()
      .from('products')
      .update({
        ...productData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(
        `
        *,
        categories!products_category_id_fkey(name)
      `
      )
      .single();

    if (error) {
      console.error('Error updating product:', error);
      throw error;
    }

    return {
      ...product,
      category_name: (product as any).categories?.name || null,
      no_catalogable: (product as any).no_catalogable ?? false,
      display_order: (product as any).display_order ?? 0,
      has_customisations: product.has_customisations ?? undefined,
    };
  }

  private async createProductInDb(
    vendorId: string,
    productData: ProductFormData
  ): Promise<ProductAdmin> {
    const { data: product, error } = await this.supabaseAuthService
      .getClient()
      .from('products')
      .insert({
        ...productData,
        vendor_id: vendorId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(
        `
        *,
        categories!products_category_id_fkey(name)
      `
      )
      .single();

    if (error) {
      console.error('Error creating product:', error);
      throw error;
    }

    return {
      ...product,
      category_name: (product as any).categories?.name || null,
      no_catalogable: (product as any).no_catalogable ?? false,
      display_order: (product as any).display_order ?? 0,
      has_customisations: product.has_customisations ?? undefined,
    };
  }

  private async deleteProductFromDb(id: number): Promise<void> {
    const { error } = await this.supabaseAuthService
      .getClient()
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  // Menu management methods
  getMenus(vendorId: string): Observable<MenuAdmin[]> {
    return from(this.fetchMenusWithSteps(vendorId));
  }

  getMenuById(id: number): Observable<MenuAdmin> {
    return from(this.fetchMenuWithSteps(id));
  }

  createMenu(vendorId: string, menuData: MenuFormData): Observable<MenuAdmin> {
    return from(this.createMenuInDb(vendorId, menuData));
  }

  updateMenu(id: number, menuData: MenuFormData): Observable<MenuAdmin> {
    return from(this.updateMenuInDb(id, menuData));
  }

  deleteMenu(id: number): Observable<void> {
    return from(this.deleteMenuFromDb(id));
  }

  getProductsForSteps(vendorId: string, includeAll = false): Observable<ProductAdmin[]> {
    return from(this.fetchProductsForSteps(vendorId, includeAll));
  }

  private async fetchMenusWithSteps(vendorId: string): Promise<MenuAdmin[]> {
    try {
      console.log(
        'Making database call for menus with authenticated client for vendor:',
        vendorId
      );

      const { data: menus, error } = await this.supabaseAuthService
        .getClient()
        .from('products')
        .select(
          `
        *,
        categories!products_category_id_fkey(name),
        product_steps(
          id, product_id, name, display_order, step_type, description, is_required,
          min_selections, max_selections, created_at, updated_at
        )
      `
        )
        .eq('vendor_id', vendorId)
        .eq('is_multi_step', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching menus:', error);
        throw error;
      }

      // Fetch step options for each menu's steps
      const menusWithCompleteSteps = await Promise.all(
        (menus || []).map(async (menu: any) => {
          const stepsWithOptions = await Promise.all(
            (menu.product_steps || []).map(async (step: any) => {
              const { data: options, error: optionsError } =
                await this.supabaseAuthService
                  .getClient()
                  .from('product_step_options')
                  .select('*')
                  .contains('step_ids', [step.id])
                  .eq('vendor_id', vendorId);

              if (optionsError) {
                console.error(
                  'Error fetching step options for list:',
                  optionsError
                );
                return {
                  ...step,
                  step_type: step.step_type as
                    | 'single-select'
                    | 'multi-select'
                    | null,
                  options: [],
                };
              }

              return {
                ...step,
                step_type: step.step_type as
                  | 'single-select'
                  | 'multi-select'
                  | null,
                options: options || [],
              };
            })
          );

          return {
            ...menu,
            category_name: menu.categories?.name || null,
            has_customisations: menu.has_customisations ?? undefined,
            steps: stepsWithOptions,
            step_count: menu.product_steps?.length || 0,
          };
        })
      );

      // Debug logging to verify complete data loading
      console.log(
        'Fetched menus with complete data:',
        menusWithCompleteSteps.map((menu) => ({
          id: menu.id,
          name: menu.name,
          stepCount: menu.steps?.length || 0,
          totalOptions:
            menu.steps?.reduce(
              (total: number, step: any) => total + (step.options?.length || 0),
              0
            ) || 0,
        }))
      );

      return menusWithCompleteSteps;
    } catch (error) {
      console.error('Database call failed in fetchMenusWithSteps:', error);
      throw error;
    }
  }

  private async fetchMenuWithSteps(id: number): Promise<MenuAdmin> {
    const { data: menu, error } = await this.supabaseAuthService
      .getClient()
      .from('products')
      .select(
        `
        *,
        categories!products_category_id_fkey(name),
        product_steps(
          id, product_id, name, display_order, step_type, description, is_required,
          min_selections, max_selections, created_at, updated_at
        )
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching menu:', error);
      throw error;
    }

    // Fetch step options for each step
    const stepsWithOptions = await Promise.all(
      (menu.product_steps || []).map(async (step: any) => {
        const { data: options, error: optionsError } =
          await this.supabaseAuthService
            .getClient()
            .from('product_step_options')
            .select('*')
            .contains('step_ids', [step.id])
            .eq('vendor_id', menu.vendor_id || '');

        if (optionsError) {
          console.error('Error fetching step options:', optionsError);
          return {
            ...step,
            step_type: step.step_type as
              | 'single-select'
              | 'multi-select'
              | null,
            options: [],
          };
        }

        return {
          ...step,
          step_type: step.step_type as 'single-select' | 'multi-select' | null,
          options: options || [],
        };
      })
    );

    // Sort steps by display_order to ensure correct order
    const sortedSteps = stepsWithOptions.sort((a, b) => {
      const orderA = a.display_order || 0;
      const orderB = b.display_order || 0;
      return orderA - orderB;
    });

    return {
      ...menu,
      category_name: menu.categories?.name || null,
      no_catalogable: (menu as any).no_catalogable ?? false,
      has_customisations: menu.has_customisations ?? undefined,
      steps: sortedSteps,
      step_count: menu.product_steps?.length || 0,
    };
  }

  private async createMenuInDb(
    vendorId: string,
    menuData: MenuFormData
  ): Promise<MenuAdmin> {
    const { data: menu, error } = await this.supabaseAuthService
      .getClient()
      .from('products')
      .insert({
        ...menuData,
        vendor_id: vendorId,
        is_multi_step: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(
        `
        *,
        categories!products_category_id_fkey(name)
      `
      )
      .single();

    if (error) {
      console.error('Error creating menu:', error);
      throw error;
    }

    return {
      ...menu,
      category_name: menu.categories?.name || null,
      no_catalogable: (menu as any).no_catalogable ?? false,
      has_customisations: menu.has_customisations ?? undefined,
      steps: [],
      step_count: 0,
    };
  }

  private async updateMenuInDb(
    id: number,
    menuData: MenuFormData
  ): Promise<MenuAdmin> {
    const { data: menu, error } = await this.supabaseAuthService
      .getClient()
      .from('products')
      .update({
        ...menuData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(
        `
        *,
        categories!products_category_id_fkey(name)
      `
      )
      .single();

    if (error) {
      console.error('Error updating menu:', error);
      throw error;
    }

    return {
      ...menu,
      category_name: menu.categories?.name || null,
      no_catalogable: (menu as any).no_catalogable ?? false,
      has_customisations: menu.has_customisations ?? undefined,
    };
  }

  private async deleteMenuFromDb(id: number): Promise<void> {
    const { error } = await this.supabaseAuthService
      .getClient()
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting menu:', error);
      throw error;
    }
  }

  private async fetchProductsForSteps(
    vendorId: string,
    includeAll = false
  ): Promise<ProductAdmin[]> {
    let query = this.supabaseAuthService
      .getClient()
      .from('products')
      .select(
        `
        *,
        categories!products_category_id_fkey(name)
      `
      )
      .eq('vendor_id', vendorId)
      .eq('is_multi_step', false);

    if (!includeAll) {
      query = query.eq('is_available', true);
    }

    const { data: products, error } = await query.order('name');

    if (error) {
      console.error('Error fetching products for steps:', error);
      throw error;
    }

    return (
      products?.map((product: any) => ({
        ...product,
        category_name: product.categories?.name || null,
        has_customisations: product.has_customisations ?? undefined,
      })) || []
    );
  }

  // Step Management Methods
  async saveMenuSteps(
    menuId: number,
    steps: any[],
    vendorId: string
  ): Promise<void> {
    // First, delete existing steps and their options
    await this.deleteMenuSteps(menuId);

    // Create new steps
    for (let i = 0; i < steps.length; i++) {
      const stepData = steps[i];
      const step = await this.createMenuStep(menuId, {
        name: stepData.name,
        step_type: stepData.step_type,
        description: stepData.description,
        is_required: stepData.is_required,
        min_selections: stepData.min_selections,
        max_selections: stepData.max_selections,
        display_order: i + 1,
      });

      // Create step options for this step
      if (stepData.products && stepData.products.length > 0) {
        await this.createStepOptions(step.id, stepData.products, vendorId);
      }
    }
  }

  private async deleteMenuSteps(menuId: number): Promise<void> {
    await this.supabaseAuthService.deleteMenuSteps(menuId);
  }

  private async createMenuStep(menuId: number, stepData: any): Promise<any> {
    return await this.supabaseAuthService.createMenuStep(menuId, stepData);
  }

  private async createStepOptions(
    stepId: number,
    products: any[],
    vendorId: string
  ): Promise<void> {
    await this.supabaseAuthService.createStepOptions(
      stepId,
      products,
      vendorId
    );
  }

  // Category Management Methods
  getCategoriesWithProducts(vendorId: string): Observable<any[]> {
    return from(this.fetchCategoriesWithProducts(vendorId));
  }

  private async fetchCategoriesWithProducts(vendorId: string): Promise<any[]> {
    console.log(
      'ProductAdminService: Starting fetchCategoriesWithProducts for vendor:',
      vendorId
    );

    // Fetch categories directly by vendorId (much more efficient!)
    const { data: categories, error } = await this.supabaseAuthService
      .getClient()
      .from('categories')
      .select(
        `
        id,
        name,
        description,
        is_active,
        display_order,
        created_at,
        updated_at
      `
      )
      .eq('vendorId', vendorId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('ProductAdminService: Error fetching categories:', error);
      throw error;
    }

    console.log(
      'ProductAdminService: Fetched categories:',
      categories?.length || 0
    );

    if (!categories ) {
      console.log(
        'ProductAdminService: No categories found for this vendor'
      );
      return [];
    }

    // Fetch products for each category
    const categoriesWithProducts = await Promise.all(
      categories.map(async (category: any) => {
        console.log(
          `ProductAdminService: Fetching products for category ${category.id} (${category.name})`
        );

        const { data: products, error: productsError } =
          await this.supabaseAuthService
            .getClient()
            .from('products')
            .select(
              `
            id,
            name,
            price,
            image_url,
            short_description,
            is_available,
            is_multi_step,
            stock_quantity
          `
            )
            .eq('category_id', category.id)
            .eq('vendor_id', vendorId);

        if (productsError) {
          console.error(
            `ProductAdminService: Error fetching products for category ${category.id}:`,
            productsError
          );
          return {
            ...category,
            products: [],
            product_count: 0,
          };
        }

        console.log(
          `ProductAdminService: Found ${
            products?.length || 0
          } products for category ${category.name} (${category.id})`
        );

        const result = {
          ...category,
          products: products || [],
          product_count: products?.length || 0,
        };

        return result;
      })
    );

    console.log(
      'ProductAdminService: Final categoriesWithProducts summary:',
      categoriesWithProducts.map((cat) => ({
        name: cat.name,
        product_count: cat.product_count,
      }))
    );

    return categoriesWithProducts;
  }

  createCategory(categoryData: any): Observable<any> {
    return from(this.createCategoryAsync(categoryData));
  }

  private async createCategoryAsync(categoryData: any): Promise<any> {
    return await this.supabaseAuthService.createCategory(categoryData);
  }

  updateCategory(categoryId: number, categoryData: any): Observable<any> {
    return from(this.updateCategoryAsync(categoryId, categoryData));
  }

  private async updateCategoryAsync(
    categoryId: number,
    categoryData: any
  ): Promise<any> {
    return await this.supabaseAuthService.updateCategory(
      categoryId,
      categoryData
    );
  }

  deleteCategory(categoryId: number): Observable<void> {
    return from(this.deleteCategoryAsync(categoryId));
  }

  private async deleteCategoryAsync(categoryId: number): Promise<void> {
    await this.supabaseAuthService.deleteCategory(categoryId);
  }

  updateProductCategory(
    productId: number,
    categoryId: number | null
  ): Observable<any> {
    return from(this.updateProductCategoryAsync(productId, categoryId));
  }

  private async updateProductCategoryAsync(
    productId: number,
    categoryId: number | null
  ): Promise<any> {
    return await this.supabaseAuthService.updateProductCategory(
      productId,
      categoryId
    );
  }

  // Reorder categories by updating their display_order
  reorderCategories(vendorId: string, categoryIds: number[]): Observable<void> {
    return from(this.reorderCategoriesAsync(categoryIds));
  }

  private async reorderCategoriesAsync(categoryIds: number[]): Promise<void> {
    await this.supabaseAuthService.reorderCategories(categoryIds);
  }

  // Auto-associate a newly created product with existing menu steps
  // that already contain products from the same category
  autoAssociateProductToMenuSteps(
    product: ProductAdmin,
    vendorId: string
  ): Observable<{ associatedStepCount: number }> {
    return from(this.autoAssociateProductToMenuStepsAsync(product, vendorId));
  }

  private async autoAssociateProductToMenuStepsAsync(
    product: ProductAdmin,
    vendorId: string
  ): Promise<{ associatedStepCount: number }> {
    if (!product.category_id) {
      return { associatedStepCount: 0 };
    }

    const client = this.supabaseAuthService.getClient();

    // Step 1: Find sibling products in the same category (excluding the new one)
    const { data: siblingProducts, error: siblingError } = await client
      .from('products')
      .select('id')
      .eq('category_id', product.category_id)
      .eq('vendor_id', vendorId)
      .eq('is_multi_step', false)
      .neq('id', product.id);

    if (siblingError) throw siblingError;
    if (!siblingProducts || siblingProducts.length === 0) {
      return { associatedStepCount: 0 };
    }

    const siblingProductIds = siblingProducts.map(p => p.id);

    // Step 2: Find step options that reference those sibling products
    const { data: matchingOptions, error: matchError } = await client
      .from('product_step_options')
      .select('id, step_ids')
      .eq('option_type', 'product')
      .eq('vendor_id', vendorId)
      .in('product_id', siblingProductIds);

    if (matchError) throw matchError;
    if (!matchingOptions || matchingOptions.length === 0) {
      return { associatedStepCount: 0 };
    }

    // Step 3: Get unique step IDs
    const uniqueStepIds = [...new Set(
      matchingOptions.flatMap(opt => opt.step_ids)
    )];

    // Step 4: Check for existing associations to avoid duplicates
    const { data: existingOptions, error: existingError } = await client
      .from('product_step_options')
      .select('id, step_ids')
      .eq('product_id', product.id)
      .eq('vendor_id', vendorId);

    if (existingError) throw existingError;

    const existingStepIds = new Set(
      existingOptions?.flatMap(opt => opt.step_ids) || []
    );
    const stepsToAdd = uniqueStepIds.filter(id => !existingStepIds.has(id));

    if (stepsToAdd.length === 0) {
      return { associatedStepCount: 0 };
    }

    // Step 5: Insert new step options
    const optionsToInsert = stepsToAdd.map(stepId => ({
      product_id: product.id,
      name: product.name,
      price_adjustment: 0,
      display_order: 999,
      is_available: true,
      option_type: 'product' as const,
      description: null,
      image_url: product.image_url || null,
      step_ids: [stepId],
      vendor_id: vendorId,
    }));

    const { error: insertError } = await client
      .from('product_step_options')
      .insert(optionsToInsert);

    if (insertError) throw insertError;

    return { associatedStepCount: stepsToAdd.length };
  }
}
