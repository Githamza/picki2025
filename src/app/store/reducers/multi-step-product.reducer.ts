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
  if (!step.isRequired && selectedOptionIds.length === 0) {
    return true; // Optional steps can be empty
  }

  const selectionCount = selectedOptionIds.length;
  return (
    selectionCount >= step.minSelections && selectionCount <= step.maxSelections
  );
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
          isValid: !step.isRequired || step.minSelections === 0,
        };
      });

      // Create summary step
      const summaryStepId = Math.max(...sortedSteps.map((s) => s.id)) + 1;
      const summaryStep: ProductStep = {
        id: summaryStepId,
        productId: baseProduct.id,
        name: 'Résumé de votre commande',
        displayOrder: Math.max(...sortedSteps.map((s) => s.displayOrder)) + 1,
        stepType: 'summary',
        description: "Vérifiez vos choix avant d'ajouter au panier",
        isRequired: false,
        minSelections: 0,
        maxSelections: 0,
        options: [],
      };

      // Add summary step selection (always valid)
      selections[summaryStepId] = {
        stepId: summaryStepId,
        selectedOptionIds: [],
        isValid: false,
      };

      // Combine original steps with summary step
      const allSteps = [...sortedSteps, summaryStep];

      const configuration: MultiStepProductConfiguration = {
        baseProduct,
        steps: allSteps,
        selections,
        currentStepIndex: 0,
        isComplete: false,
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

    const clampedIndex = Math.max(
      0,
      Math.min(stepIndex, state.configuration.steps.length - 1)
    );

    // Check if the current step is a summary step and mark it as valid
    const currentStep = state.configuration.steps[clampedIndex];
    let updatedSelections = { ...state.configuration.selections };
    let isComplete = state.configuration.isComplete;

    if (currentStep && currentStep.stepType === 'summary') {
      updatedSelections[currentStep.id] = {
        ...updatedSelections[currentStep.id],
        isValid: true,
      };

      // Recalculate isComplete when arriving at summary step
      isComplete = state.configuration.steps.every(
        (s) => updatedSelections[s.id]?.isValid || false
      );
    }

    return {
      ...state,
      configuration: {
        ...state.configuration,
        currentStepIndex: clampedIndex,
        selections: updatedSelections,
        isComplete,
      },
    };
  }),

  on(MultiStepProductActions.nextStep, (state) => {
    if (!state.configuration) return state;

    const nextIndex = Math.min(
      state.configuration.currentStepIndex + 1,
      state.configuration.steps.length - 1
    );

    // Check if the next step is a summary step and mark it as valid
    const nextStep = state.configuration.steps[nextIndex];
    let updatedSelections = { ...state.configuration.selections };
    let isComplete = state.configuration.isComplete;

    if (nextStep && nextStep.stepType === 'summary') {
      updatedSelections[nextStep.id] = {
        ...updatedSelections[nextStep.id],
        isValid: true,
      };

      // Recalculate isComplete when arriving at summary step
      isComplete = state.configuration.steps.every(
        (s) => updatedSelections[s.id]?.isValid || false
      );
    }

    return {
      ...state,
      configuration: {
        ...state.configuration,
        currentStepIndex: nextIndex,
        selections: updatedSelections,
        isComplete,
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
