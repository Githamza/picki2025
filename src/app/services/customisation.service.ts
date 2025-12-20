import { Injectable, inject } from '@angular/core';
import { Observable, from, map, catchError, throwError } from 'rxjs';
import { SupabaseAuthService } from './supabase-auth.service';
import {
  Customisation,
  CustomisationOption,
  CustomisationFormData,
  CustomisationOptionFormData,
} from '../models/customisation.interface';

@Injectable({
  providedIn: 'root',
})
export class CustomisationService {
  private supabaseAuthService = inject(SupabaseAuthService);

  /**
   * Fetch all customisations for a vendor with their options
   */
  getCustomisations(vendorId: string): Observable<Customisation[]> {
    return from(this.fetchCustomisationsFromDb(vendorId));
  }

  /**
   * Fetch a single customisation with its options
   */
  getCustomisation(id: number): Observable<Customisation> {
    return from(this.fetchCustomisationFromDb(id));
  }

  /**
   * Create a new customisation
   */
  createCustomisation(
    vendorId: string,
    data: CustomisationFormData
  ): Observable<Customisation> {
    return from(this.createCustomisationInDb(vendorId, data));
  }

  /**
   * Update an existing customisation
   */
  updateCustomisation(
    id: number,
    data: CustomisationFormData
  ): Observable<Customisation> {
    return from(this.updateCustomisationInDb(id, data));
  }

  /**
   * Delete a customisation
   */
  deleteCustomisation(id: number): Observable<void> {
    return from(this.deleteCustomisationFromDb(id));
  }

  /**
   * Toggle customisation availability
   */
  toggleCustomisationAvailability(
    id: number,
    isAvailable: boolean
  ): Observable<Customisation> {
    return from(this.toggleCustomisationAvailabilityInDb(id, isAvailable));
  }

  /**
   * Add an option to a customisation
   */
  addOption(
    customisationId: number,
    option: CustomisationOptionFormData
  ): Observable<CustomisationOption> {
    return from(this.addOptionToDb(customisationId, option));
  }

  /**
   * Update an existing option
   */
  updateOption(
    optionId: number,
    option: CustomisationOptionFormData
  ): Observable<CustomisationOption> {
    return from(this.updateOptionInDb(optionId, option));
  }

  /**
   * Delete an option
   */
  deleteOption(optionId: number): Observable<void> {
    return from(this.deleteOptionFromDb(optionId));
  }

  /**
   * Toggle option availability
   */
  toggleOptionAvailability(
    optionId: number,
    isAvailable: boolean
  ): Observable<CustomisationOption> {
    return from(this.toggleOptionAvailabilityInDb(optionId, isAvailable));
  }

  /**
   * Attach customisations to a product
   */
  attachToProduct(
    productId: number,
    customisationIds: number[]
  ): Observable<void> {
    return from(this.attachToProductInDb(productId, customisationIds));
  }

  /**
   * Detach customisations from a product
   */
  detachFromProduct(
    productId: number,
    customisationIds: number[]
  ): Observable<void> {
    return from(this.detachFromProductInDb(productId, customisationIds));
  }

  /**
   * Get customisations for a specific product
   */
  getProductCustomisations(productId: number): Observable<Customisation[]> {
    return from(this.fetchProductCustomisationsFromDb(productId));
  }

  /**
   * Get products assigned to a specific customisation
   */
  getCustomisationProducts(customisationId: number): Observable<number[]> {
    return from(this.fetchCustomisationProductsFromDb(customisationId));
  }

  /**
   * Assign products to a customisation
   */
  assignProductsToCustomisation(
    customisationId: number,
    productIds: number[]
  ): Observable<void> {
    return from(this.assignProductsToCustomisationInDb(customisationId, productIds));
  }

  // Private database methods

  private async fetchCustomisationsFromDb(
    vendorId: string
  ): Promise<Customisation[]> {
    const { data: customisations, error } = await this.supabaseAuthService
      .getClient()
      .from('customisations')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('display_order');

    if (error) {
      console.error('Error fetching customisations:', error);
      throw error;
    }

    // Fetch options for each customisation
    const customisationsWithOptions = await Promise.all(
      (customisations || []).map(async (customisation: any) => {
        const { data: options, error: optionsError } =
          await this.supabaseAuthService
            .getClient()
            .from('customisation_options')
            .select('*')
            .eq('customisation_id', customisation.id)
            .order('display_order');

        if (optionsError) {
          console.error('Error fetching customisation options:', optionsError);
          return {
            ...customisation,
            selection_type: customisation.selection_type as 'single-select' | 'multi-select',
            is_required: customisation.is_required ?? false,
            min_selections: customisation.min_selections ?? 0,
            max_selections: customisation.max_selections ?? 1,
            display_order: customisation.display_order ?? 0,
            is_available: customisation.is_available ?? true,
            options: [],
          } as Customisation;
        }

        return {
          ...customisation,
          selection_type: customisation.selection_type as 'single-select' | 'multi-select',
          is_required: customisation.is_required ?? false,
          min_selections: customisation.min_selections ?? 0,
          max_selections: customisation.max_selections ?? 1,
          display_order: customisation.display_order ?? 0,
          is_available: customisation.is_available ?? true,
          options: (options || []).map((opt: any) => ({
            ...opt,
            price_adjustment: opt.price_adjustment ?? 0,
            display_order: opt.display_order ?? 0,
            is_available: opt.is_available ?? true,
            option_type: (opt.option_type as 'component' | 'product') ?? 'component',
          })) as CustomisationOption[],
        } as Customisation;
      })
    );

    return customisationsWithOptions;
  }

  private async fetchCustomisationFromDb(id: number): Promise<Customisation> {
    const { data: customisation, error } = await this.supabaseAuthService
      .getClient()
      .from('customisations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching customisation:', error);
      throw error;
    }

    // Fetch options
    const { data: options, error: optionsError } = await this.supabaseAuthService
      .getClient()
      .from('customisation_options')
      .select('*')
      .eq('customisation_id', id)
      .order('display_order');

    if (optionsError) {
      console.error('Error fetching customisation options:', optionsError);
      return {
        ...customisation,
        selection_type: customisation.selection_type as 'single-select' | 'multi-select',
        is_required: customisation.is_required ?? false,
        min_selections: customisation.min_selections ?? 0,
        max_selections: customisation.max_selections ?? 1,
        display_order: customisation.display_order ?? 0,
        is_available: customisation.is_available ?? true,
        options: [],
      } as Customisation;
    }

    return {
      ...customisation,
      selection_type: customisation.selection_type as 'single-select' | 'multi-select',
      is_required: customisation.is_required ?? false,
      min_selections: customisation.min_selections ?? 0,
      max_selections: customisation.max_selections ?? 1,
      display_order: customisation.display_order ?? 0,
      is_available: customisation.is_available ?? true,
      options: (options || []).map((opt: any) => ({
        ...opt,
        price_adjustment: opt.price_adjustment ?? 0,
        display_order: opt.display_order ?? 0,
        is_available: opt.is_available ?? true,
        option_type: (opt.option_type as 'component' | 'product') ?? 'component',
      })) as CustomisationOption[],
    } as Customisation;
  }

  private async createCustomisationInDb(
    vendorId: string,
    data: CustomisationFormData
  ): Promise<Customisation> {
    const { data: customisation, error } = await this.supabaseAuthService
      .getClient()
      .from('customisations')
      .insert({
        ...data,
        vendor_id: vendorId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating customisation:', error);
      throw error;
    }

    return {
      ...customisation,
      selection_type: customisation.selection_type as 'single-select' | 'multi-select',
      is_required: customisation.is_required ?? false,
      min_selections: customisation.min_selections ?? 0,
      max_selections: customisation.max_selections ?? 1,
      display_order: customisation.display_order ?? 0,
      is_available: customisation.is_available ?? true,
      options: [],
    } as Customisation;
  }

  private async updateCustomisationInDb(
    id: number,
    data: CustomisationFormData
  ): Promise<Customisation> {
    const { data: customisation, error } = await this.supabaseAuthService
      .getClient()
      .from('customisations')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating customisation:', error);
      throw error;
    }

    return this.fetchCustomisationFromDb(id);
  }

  private async deleteCustomisationFromDb(id: number): Promise<void> {
    const { error } = await this.supabaseAuthService
      .getClient()
      .from('customisations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting customisation:', error);
      throw error;
    }
  }

  private async toggleCustomisationAvailabilityInDb(
    id: number,
    isAvailable: boolean
  ): Promise<Customisation> {
    const { data: customisation, error } = await this.supabaseAuthService
      .getClient()
      .from('customisations')
      .update({
        is_available: isAvailable,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error toggling customisation availability:', error);
      throw error;
    }

    return this.fetchCustomisationFromDb(id);
  }

  private async addOptionToDb(
    customisationId: number,
    option: CustomisationOptionFormData
  ): Promise<CustomisationOption> {
    const { data: newOption, error } = await this.supabaseAuthService
      .getClient()
      .from('customisation_options')
      .insert({
        ...option,
        customisation_id: customisationId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding option:', error);
      throw error;
    }

    return {
      ...newOption,
      price_adjustment: newOption.price_adjustment ?? 0,
      display_order: newOption.display_order ?? 0,
      is_available: newOption.is_available ?? true,
      option_type: (newOption.option_type as 'component' | 'product') ?? 'component',
    } as CustomisationOption;
  }

  private async updateOptionInDb(
    optionId: number,
    option: CustomisationOptionFormData
  ): Promise<CustomisationOption> {
    const { data: updatedOption, error } = await this.supabaseAuthService
      .getClient()
      .from('customisation_options')
      .update({
        ...option,
        updated_at: new Date().toISOString(),
      })
      .eq('id', optionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating option:', error);
      throw error;
    }

    return {
      ...updatedOption,
      price_adjustment: updatedOption.price_adjustment ?? 0,
      display_order: updatedOption.display_order ?? 0,
      is_available: updatedOption.is_available ?? true,
      option_type: (updatedOption.option_type as 'component' | 'product') ?? 'component',
    } as CustomisationOption;
  }

  private async deleteOptionFromDb(optionId: number): Promise<void> {
    const { error } = await this.supabaseAuthService
      .getClient()
      .from('customisation_options')
      .delete()
      .eq('id', optionId);

    if (error) {
      console.error('Error deleting option:', error);
      throw error;
    }
  }

  private async toggleOptionAvailabilityInDb(
    optionId: number,
    isAvailable: boolean
  ): Promise<CustomisationOption> {
    const { data: option, error } = await this.supabaseAuthService
      .getClient()
      .from('customisation_options')
      .update({
        is_available: isAvailable,
        updated_at: new Date().toISOString(),
      })
      .eq('id', optionId)
      .select()
      .single();

    if (error) {
      console.error('Error toggling option availability:', error);
      throw error;
    }

    return {
      ...option,
      price_adjustment: option.price_adjustment ?? 0,
      display_order: option.display_order ?? 0,
      is_available: option.is_available ?? true,
      option_type: (option.option_type as 'component' | 'product') ?? 'component',
    } as CustomisationOption;
  }

  private async attachToProductInDb(
    productId: number,
    customisationIds: number[]
  ): Promise<void> {
    // First, delete existing associations
    await this.supabaseAuthService
      .getClient()
      .from('product_customisations')
      .delete()
      .eq('product_id', productId);

    if (customisationIds.length === 0) {
      // Update product to set has_customisations to false
      await this.supabaseAuthService
        .getClient()
        .from('products')
        .update({ has_customisations: false })
        .eq('id', productId);
      return;
    }

    // Insert new associations
    const associations = customisationIds.map((customisationId, index) => ({
      product_id: productId,
      customisation_id: customisationId,
      display_order: index,
      created_at: new Date().toISOString(),
    }));

    const { error } = await this.supabaseAuthService
      .getClient()
      .from('product_customisations')
      .insert(associations);

    if (error) {
      console.error('Error attaching customisations to product:', error);
      throw error;
    }

    // Update product to set has_customisations to true
    await this.supabaseAuthService
      .getClient()
      .from('products')
      .update({ has_customisations: true })
      .eq('id', productId);
  }

  private async detachFromProductInDb(
    productId: number,
    customisationIds: number[]
  ): Promise<void> {
    const { error } = await this.supabaseAuthService
      .getClient()
      .from('product_customisations')
      .delete()
      .eq('product_id', productId)
      .in('customisation_id', customisationIds);

    if (error) {
      console.error('Error detaching customisations from product:', error);
      throw error;
    }

    // Check if product still has any customisations
    const { data: remainingCustomisations } = await this.supabaseAuthService
      .getClient()
      .from('product_customisations')
      .select('id')
      .eq('product_id', productId);

    if (!remainingCustomisations || remainingCustomisations.length === 0) {
      // Update product to set has_customisations to false
      await this.supabaseAuthService
        .getClient()
        .from('products')
        .update({ has_customisations: false })
        .eq('id', productId);
    }
  }

  private async fetchProductCustomisationsFromDb(
    productId: number
  ): Promise<Customisation[]> {
    const { data: productCustomisations, error } = await this.supabaseAuthService
      .getClient()
      .from('product_customisations')
      .select(
        `
        customisation_id,
        display_order,
        customisations (*)
      `
      )
      .eq('product_id', productId)
      .order('display_order');

    if (error) {
      console.error('Error fetching product customisations:', error);
      throw error;
    }

    if (!productCustomisations || productCustomisations.length === 0) {
      return [];
    }

    // Fetch options for each customisation
    const customisationsWithOptions = await Promise.all(
      productCustomisations.map(async (pc: any) => {
        const customisation = pc.customisations;
        const { data: options, error: optionsError } =
          await this.supabaseAuthService
            .getClient()
            .from('customisation_options')
            .select('*')
            .eq('customisation_id', customisation.id)
            .order('display_order');

        if (optionsError) {
          console.error('Error fetching customisation options:', optionsError);
          return {
            ...customisation,
            selection_type: customisation.selection_type as 'single-select' | 'multi-select',
            is_required: customisation.is_required ?? false,
            min_selections: customisation.min_selections ?? 0,
            max_selections: customisation.max_selections ?? 1,
            display_order: customisation.display_order ?? 0,
            is_available: customisation.is_available ?? true,
            options: [],
          } as Customisation;
        }

        return {
          ...customisation,
          selection_type: customisation.selection_type as 'single-select' | 'multi-select',
          is_required: customisation.is_required ?? false,
          min_selections: customisation.min_selections ?? 0,
          max_selections: customisation.max_selections ?? 1,
          display_order: customisation.display_order ?? 0,
          is_available: customisation.is_available ?? true,
          options: (options || []).map((opt: any) => ({
            ...opt,
            price_adjustment: opt.price_adjustment ?? 0,
            display_order: opt.display_order ?? 0,
            is_available: opt.is_available ?? true,
            option_type: (opt.option_type as 'component' | 'product') ?? 'component',
          })) as CustomisationOption[],
        } as Customisation;
      })
    );

    return customisationsWithOptions;
  }

  private async fetchCustomisationProductsFromDb(
    customisationId: number
  ): Promise<number[]> {
    const { data: productCustomisations, error } = await this.supabaseAuthService
      .getClient()
      .from('product_customisations')
      .select('product_id')
      .eq('customisation_id', customisationId);

    if (error) {
      console.error('Error fetching customisation products:', error);
      throw error;
    }

    return (productCustomisations || []).map((pc: any) => pc.product_id);
  }

  private async assignProductsToCustomisationInDb(
    customisationId: number,
    productIds: number[]
  ): Promise<void> {
    // First, delete existing associations for this customisation
    await this.supabaseAuthService
      .getClient()
      .from('product_customisations')
      .delete()
      .eq('customisation_id', customisationId);

    if (productIds.length === 0) {
      // Update all previously assigned products to set has_customisations to false if they have no other customisations
      return;
    }

    // Insert new associations
    const associations = productIds.map((productId, index) => ({
      product_id: productId,
      customisation_id: customisationId,
      display_order: index,
      created_at: new Date().toISOString(),
    }));

    const { error } = await this.supabaseAuthService
      .getClient()
      .from('product_customisations')
      .insert(associations);

    if (error) {
      console.error('Error assigning products to customisation:', error);
      throw error;
    }

    // Update all assigned products to set has_customisations to true
    for (const productId of productIds) {
      await this.supabaseAuthService
        .getClient()
        .from('products')
        .update({ has_customisations: true })
        .eq('id', productId);
    }
  }
}

