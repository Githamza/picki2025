import { createAction, props } from '@ngrx/store';
import {
  ProductStep,
  StepSelection,
  MultiStepProductConfiguration,
} from '../../models/multi-step-product.model';
import { Product } from '../../services/product.service';

// Initialize multi-step product configuration
export const initializeMultiStepProduct = createAction(
  '[Multi-Step Product] Initialize',
  props<{ productId: number }>()
);

export const initializeMultiStepProductSuccess = createAction(
  '[Multi-Step Product] Initialize Success',
  props<{ baseProduct: Product; steps: ProductStep[] }>()
);

export const initializeMultiStepProductFailure = createAction(
  '[Multi-Step Product] Initialize Failure',
  props<{ error: string }>()
);

// Navigation actions
export const setCurrentStep = createAction(
  '[Multi-Step Product] Set Current Step',
  props<{ stepIndex: number }>()
);

export const nextStep = createAction('[Multi-Step Product] Next Step');

export const previousStep = createAction('[Multi-Step Product] Previous Step');

// Selection actions
export const updateStepSelection = createAction(
  '[Multi-Step Product] Update Step Selection',
  props<{ stepId: number; selectedOptionIds: number[] }>()
);

export const validateStepSelection = createAction(
  '[Multi-Step Product] Validate Step Selection',
  props<{ stepId: number }>()
);

// Configuration actions
export const calculateTotalPrice = createAction(
  '[Multi-Step Product] Calculate Total Price'
);

export const generateSummaryStep = createAction(
  '[Multi-Step Product] Generate Summary Step'
);

export const resetConfiguration = createAction(
  '[Multi-Step Product] Reset Configuration'
);

export const completeConfiguration = createAction(
  '[Multi-Step Product] Complete Configuration'
);

// Add to cart
export const addMultiStepProductToCart = createAction(
  '[Multi-Step Product] Add To Cart',
  props<{ 
    configuration: MultiStepProductConfiguration; 
    comment?: string;
    optionCustomisationSelections?: Map<string, Map<number, number[]>>;
  }>()
);

export const addMultiStepProductToCartSuccess = createAction(
  '[Multi-Step Product] Add To Cart Success'
);

export const addMultiStepProductToCartFailure = createAction(
  '[Multi-Step Product] Add To Cart Failure',
  props<{ error: string }>()
);
