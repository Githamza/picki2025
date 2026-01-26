import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of, from } from 'rxjs';
import {
  catchError,
  map,
  exhaustMap,
  switchMap,
  withLatestFrom,
} from 'rxjs/operators';
import * as MultiStepProductActions from '../actions/multi-step-product.actions';
import * as CartActions from '../actions/cart.actions';
import { ProductService } from '../../services/product.service';
import { SupabaseService } from '../../services/supabase.service';
import {
  ProductStep,
  ProductStepOption,
  CartMultiStepMetadata,
} from '../../models/multi-step-product.model';
import { Store } from '@ngrx/store';
import { selectMultiStepConfiguration } from '../selectors/multi-step-product.selectors';

@Injectable()
export class MultiStepProductEffects {
  private actions$ = inject(Actions);
  private productService = inject(ProductService);
  private supabaseService = inject(SupabaseService);
  private store = inject(Store);

  initializeMultiStepProduct$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MultiStepProductActions.initializeMultiStepProduct),
      exhaustMap(({ productId }) => {
        return from(this.supabaseService.getProductById(productId)).pipe(
          switchMap(async (productData: any) => {
            if (!productData) {
              throw new Error('Product not found');
            }

            // Transform the database product to our Product interface
            const baseProduct = {
              id: productData.id,
              name: productData.name,
              price: Number(productData.price),
              imageUrl: productData.image_url || '',
              categoryId: productData.category_id || 0,
              description: productData.short_description || '',
              shortDescription: productData.short_description || '',
              longDescription: productData.long_description || '',
              vendorId: productData.vendor_id || undefined,
              isMultiStep: productData.is_multi_step || false,
              displayOrder: productData.display_order || 0,
              stockQuantity: productData.stock_quantity ?? null,
            };

            // Fetch product steps with options from database
            let steps: ProductStep[] = [];

            try {
              // Fetch real product steps from database
              const stepData = await this.supabaseService.getProductSteps(
                productId
              );
              steps = this.transformStepData(stepData);
            } catch (stepError) {
              console.error('Failed to load product steps:', stepError);
              steps = [];
            }

            return { baseProduct, steps };
          }),
          map(({ baseProduct, steps }) =>
            MultiStepProductActions.initializeMultiStepProductSuccess({
              baseProduct,
              steps,
            })
          ),
          catchError((error) => {
            return of(
              MultiStepProductActions.initializeMultiStepProductFailure({
                error: error.message || 'Failed to load multi-step product',
              })
            );
          })
        );
      })
    )
  );

  addMultiStepProductToCart$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MultiStepProductActions.addMultiStepProductToCart),
      withLatestFrom(this.store.select(selectMultiStepConfiguration)),
      switchMap(([action, configuration]) => {
        const { comment, optionCustomisationSelections } = action;
        if (!configuration) {
          return of(
            MultiStepProductActions.addMultiStepProductToCartFailure({
              error: 'No configuration found',
            })
          );
        }

        return from(this.buildMetadataWithCustomisations(
          configuration,
          optionCustomisationSelections
        )).pipe(
          map((metadata) => {
            // Create cart item with multi-step metadata
            const cartItem = {
              product: configuration.baseProduct,
              quantity: 1,
              metadata,
              totalPrice: configuration.totalPrice,
            };

            // Dispatch add to cart action with comment and metadata
            this.store.dispatch(
              CartActions.addToCart({
                product: cartItem.product,
                quantity: cartItem.quantity,
                comment: comment,
                totalPrice: cartItem.totalPrice, // Pass the calculated total price
                metadata: cartItem.metadata, // Pass the multi-step metadata
              })
            );

            return MultiStepProductActions.addMultiStepProductToCartSuccess();
          }),
          catchError((error: any) => {
            return of(
              MultiStepProductActions.addMultiStepProductToCartFailure({
                error: error.message || 'Failed to add to cart',
              })
            );
          })
        );
      })
    )
  );

  private async buildMetadataWithCustomisations(
    configuration: any,
    optionCustomisationSelections?: Map<string, Map<number, number[]>>
  ): Promise<CartMultiStepMetadata> {
    const stepSelections = await Promise.all(
      configuration.steps.map(async (step: ProductStep) => {
        const selection = configuration.selections[step.id];
        const selectedOptions = await Promise.all(
          (selection?.selectedOptionIds || []).map(async (optionId: number) => {
            const option = step.options.find(
              (opt) => opt.id === optionId
            );
            
            if (!option) return null;

            let customisationSelectionsForOption = undefined;

            // Check if this option has customisation selections
            if (optionCustomisationSelections && option.optionType === 'product' && option.productId) {
              const key = `${step.id}-${optionId}`;
              const customisationMap = optionCustomisationSelections.get(key);

              if (customisationMap && customisationMap.size > 0) {
                // Fetch product details with customisations to get customisation names
                try {
                  const product = await this.productService.getProductWithCustomisations(option.productId).toPromise();
                  
                  if (product && product.customisations) {
                    customisationSelectionsForOption = Array.from(customisationMap.entries()).map(
                      ([customisationId, selectedOptionIds]) => {
                        const customisation = product.customisations?.find(
                          (c) => c.id === customisationId
                        );

                        if (!customisation || !customisation.options) {
                          return null;
                        }

                        const selectedOptionNames: string[] = [];
                        const priceAdjustments: number[] = [];

                        selectedOptionIds.forEach((optId) => {
                          const custOption = customisation.options?.find(
                            (o) => o.id === optId
                          );
                          if (custOption) {
                            selectedOptionNames.push(custOption.name);
                            priceAdjustments.push(custOption.price_adjustment || 0);
                          }
                        });

                        return {
                          customisationId,
                          customisationName: customisation.name,
                          selectedOptionIds,
                          selectedOptionNames,
                          priceAdjustments,
                        };
                      }
                    ).filter(Boolean) as any[];
                  }
                } catch (error) {
                  console.error('Error fetching customisation details:', error);
                }
              }
            }

            return {
              optionId: option.id,
              optionName: option.name,
              productId: option.productId,
              priceAdjustment: option.priceAdjustment,
              customisationSelections: customisationSelectionsForOption,
            };
          })
        );

        return {
          stepId: step.id,
          stepName: step.name,
          selectedOptions: selectedOptions.filter(Boolean) as any[],
        };
      })
    );

    return {
      baseProductId: configuration.baseProduct.id,
      stepSelections: stepSelections.filter(
        (stepSelection) => stepSelection.selectedOptions.length > 0
      ),
      totalSteps: configuration.steps.length,
    };
  }

  // Transform database step data to our ProductStep model
  private transformStepData(stepData: any[]): ProductStep[] {
    return stepData
      .map((step) => ({
        id: step.id,
        productId: step.product_id,
        name: step.name,
        displayOrder: step.display_order,
        stepType: this.mapStepType(step.step_type),
        description: step.description || '',
        isRequired: step.is_required,
        minSelections: step.min_selections,
        maxSelections: step.max_selections,
        options: (step.product_step_options || []).map((option: any) => ({
          id: option.id,
          stepIds: option.step_ids, // Changed from stepId: step.id to use array
          productId: option.product_id, // Can be null for component options
          name: option.name,
          priceAdjustment: Number(option.price_adjustment) || 0,
          displayOrder: option.display_order,
          isAvailable: option.is_available,
          optionType: (option.option_type || 'component') as
            | 'component'
            | 'product',
          description: option.description || '',
          vendorId: option.vendor_id, // Added vendor_id
          // Image logic: use option's own image for components, or product's image for products
          imageUrl: this.getOptionImageUrl(option),
          stockQuantity: option.option_product?.stock_quantity ?? null,
        })),
      }))
      // Filter out steps that have no visible options
      .filter((step) => step.options.length > 0);
  }

  // Helper method to determine the correct image URL based on option type
  private getOptionImageUrl(option: any): string {
    if (option.option_type === 'product' && option.option_product?.image_url) {
      // For product options, use the linked product's image
      return option.option_product.image_url;
    } else if (option.image_url) {
      // For component options, use the option's own image
      return option.image_url;
    }
    // Fallback to empty string if no image is available
    return '';
  }

  // Map database step types to our interface types
  private mapStepType(
    dbStepType: string
  ): 'single-select' | 'multi-select' | 'summary' {
    switch (dbStepType) {
      case 'single-select':
        return 'single-select';
      case 'multi-select':
        return 'multi-select';
      case 'text_input':
        return 'summary'; // Map text input to summary for display purposes
      case 'required':
        // Handle legacy or incorrectly set "required" step type
        // "required" refers to whether the step is mandatory, not the selection type
        console.warn(
          'Step type "required" is not a valid selection type. This should be either "single-select" or "multi-select". Defaulting to "single-select". Please update the database to use proper step types.'
        );
        return 'single-select';
      case null:
      case undefined:
      case '':
        // Handle null, undefined, or empty step types
        console.warn('Empty step type detected, defaulting to single-select');
        return 'single-select';
      default:
        console.warn(
          'Unknown step type:',
          dbStepType,
          'defaulting to single-select'
        );
        return 'single-select';
    }
  }
}
