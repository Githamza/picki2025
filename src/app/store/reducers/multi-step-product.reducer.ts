import { createReducer, on } from '@ngrx/store';
import * as MultiStepProductActions from '../actions/multi-step-product.actions';
import {
  MultiStepProductConfiguration,
  ProductStep,
  StepSelection,
} from '../../models/multi-step-product.model';

export interface MultiStepProductState {
  configuration: MultiStepProductConfiguration | null;
  loading: boolean;
  error: string | null;
}

export const initialMultiStepProductState: MultiStepProductState = {
  configuration: null,
  loading: false,
  error: null,
};

// Helper function to validate step selection
function isStepSelectionValid(
  step: ProductStep,
  selectedOptionIds: number[]
): boolean {
  const selectionCount = selectedOptionIds.length;

  // Optional steps can be empty (no selection).
  if (!step.isRequired && selectionCount === 0) {
    return true;
  }

  // Required steps must have at least one selection, even if backend sends minSelections=0.
  if (step.isRequired && selectionCount === 0) {
    return false;
  }

  const minSelections = step.isRequired ? Math.max(step.minSelections, 1) : step.minSelections;

  return selectionCount >= minSelections && selectionCount <= step.maxSelections;
}

// Helper function to calculate total price
function calculateConfigurationPrice(
  configuration: MultiStepProductConfiguration
): number {
  if (!configuration.baseProduct || !configuration.steps) return 0;

  let totalPrice = configuration.baseProduct.price || 0;

  configuration.steps.forEach((step) => {
    const selection = configuration.selections[step.id];
    if (selection && selection.selectedOptionIds.length > 0) {
      selection.selectedOptionIds.forEach((optionId) => {
        const option = step.options.find((opt) => opt.id === optionId);
        if (option) {
          totalPrice += option.priceAdjustment;
        }
      });
    }
  });

  return totalPrice;
}

export const multiStepProductReducer = createReducer(
  initialMultiStepProductState,

  // Initialize
  on(MultiStepProductActions.initializeMultiStepProduct, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(
    MultiStepProductActions.initializeMultiStepProductSuccess,
    (state, { baseProduct, steps }) => {
      const selections: { [stepId: number]: StepSelection } = {};

      // Sort steps by display order
      const sortedSteps = [...steps].sort(
        (a, b) => a.displayOrder - b.displayOrder
      );

      // Initialize empty selections for each step
      sortedSteps.forEach((step) => {
        selections[step.id] = {
          stepId: step.id,
          selectedOptionIds: [],
          isValid: isStepSelectionValid(step, []),
        };
      });

      // FR4d: no synthetic summary step — completion is purely "every
      // real step's selection is valid", and the scroll shell's collapsed
      // sections are the recap.
      const isComplete = sortedSteps.every(
        (step) => selections[step.id]?.isValid || false
      );

      const configuration: MultiStepProductConfiguration = {
        baseProduct,
        steps: sortedSteps,
        selections,
        currentStepIndex: 0,
        isComplete,
        totalPrice: baseProduct.price || 0,
      };

      return {
        ...state,
        configuration,
        loading: false,
        error: null,
      };
    }
  ),

  on(
    MultiStepProductActions.initializeMultiStepProductFailure,
    (state, { error }) => ({
      ...state,
      loading: false,
      error,
    })
  ),

  // Navigation
  on(MultiStepProductActions.setCurrentStep, (state, { stepIndex }) => {
    if (!state.configuration) return state;

    // steps.length (one past the end) is a valid resting state: no step
    // is active, every section is collapsed (FR4d — the last step closes
    // after its choice so the comment/add-to-cart area is revealed).
    const clampedIndex = Math.max(
      0,
      Math.min(stepIndex, state.configuration.steps.length)
    );

    return {
      ...state,
      configuration: {
        ...state.configuration,
        currentStepIndex: clampedIndex,
      },
    };
  }),

  on(MultiStepProductActions.nextStep, (state) => {
    if (!state.configuration) return state;

    const nextIndex = Math.min(
      state.configuration.currentStepIndex + 1,
      state.configuration.steps.length
    );

    return {
      ...state,
      configuration: {
        ...state.configuration,
        currentStepIndex: nextIndex,
      },
    };
  }),

  on(MultiStepProductActions.previousStep, (state) => {
    if (!state.configuration) return state;

    const prevIndex = Math.max(state.configuration.currentStepIndex - 1, 0);

    return {
      ...state,
      configuration: {
        ...state.configuration,
        currentStepIndex: prevIndex,
      },
    };
  }),

  // Selections
  on(
    MultiStepProductActions.updateStepSelection,
    (state, { stepId, selectedOptionIds }) => {
      if (!state.configuration) return state;

      const step = state.configuration.steps.find((s) => s.id === stepId);
      if (!step) return state;

      const isValid = isStepSelectionValid(step, selectedOptionIds);

      const updatedSelections = {
        ...state.configuration.selections,
        [stepId]: {
          stepId,
          selectedOptionIds,
          isValid,
        },
      };

      // Check if all steps are complete
      const isComplete = state.configuration.steps.every(
        (s) => updatedSelections[s.id]?.isValid || false
      );

      const updatedConfiguration = {
        ...state.configuration,
        selections: updatedSelections,
        isComplete,
      };

      // Recalculate total price
      updatedConfiguration.totalPrice =
        calculateConfigurationPrice(updatedConfiguration);

      return {
        ...state,
        configuration: updatedConfiguration,
      };
    }
  ),

  on(MultiStepProductActions.calculateTotalPrice, (state) => {
    if (!state.configuration) return state;

    const totalPrice = calculateConfigurationPrice(state.configuration);

    return {
      ...state,
      configuration: {
        ...state.configuration,
        totalPrice,
      },
    };
  }),

  on(MultiStepProductActions.resetConfiguration, (state) => ({
    ...state,
    configuration: null,
    error: null,
  })),

  on(MultiStepProductActions.completeConfiguration, (state) => {
    if (!state.configuration) return state;

    return {
      ...state,
      configuration: {
        ...state.configuration,
        isComplete: true,
      },
    };
  }),

  // Add to cart
  on(MultiStepProductActions.addMultiStepProductToCart, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(MultiStepProductActions.addMultiStepProductToCartSuccess, (state) => ({
    ...state,
    loading: false,
    configuration: null, // Reset after successful add
  })),

  on(
    MultiStepProductActions.addMultiStepProductToCartFailure,
    (state, { error }) => ({
      ...state,
      loading: false,
      error,
    })
  )
);
