import { createFeatureSelector, createSelector } from '@ngrx/store';
import { MultiStepProductState } from '../reducers/multi-step-product.reducer';

export const selectMultiStepProductState =
  createFeatureSelector<MultiStepProductState>('multiStepProduct');

export const selectMultiStepConfiguration = createSelector(
  selectMultiStepProductState,
  (state: MultiStepProductState) => state.configuration
);

export const selectMultiStepLoading = createSelector(
  selectMultiStepProductState,
  (state: MultiStepProductState) => state.loading
);

export const selectMultiStepError = createSelector(
  selectMultiStepProductState,
  (state: MultiStepProductState) => state.error
);

export const selectBaseProduct = createSelector(
  selectMultiStepConfiguration,
  (configuration) => configuration?.baseProduct || null
);

export const selectProductSteps = createSelector(
  selectMultiStepConfiguration,
  (configuration) => configuration?.steps || []
);

export const selectCurrentStepIndex = createSelector(
  selectMultiStepConfiguration,
  (configuration) => configuration?.currentStepIndex || 0
);

export const selectCurrentStep = createSelector(
  selectProductSteps,
  selectCurrentStepIndex,
  (steps, currentIndex) => steps[currentIndex] || null
);

export const selectStepSelections = createSelector(
  selectMultiStepConfiguration,
  (configuration) => configuration?.selections || {}
);

export const selectCurrentStepSelection = createSelector(
  selectCurrentStep,
  selectStepSelections,
  (currentStep, selections) => {
    if (!currentStep) return null;
    return selections[currentStep.id] || null;
  }
);

export const selectIsCurrentStepValid = createSelector(
  selectCurrentStepSelection,
  (selection) => selection?.isValid || false
);

export const selectCanGoNext = createSelector(
  selectCurrentStepIndex,
  selectProductSteps,
  selectIsCurrentStepValid,
  (currentIndex, steps, isCurrentStepValid) => {
    return isCurrentStepValid && currentIndex < steps.length - 1;
  }
);

export const selectCanGoPrevious = createSelector(
  selectCurrentStepIndex,
  (currentIndex) => currentIndex > 0
);

export const selectIsLastStep = createSelector(
  selectCurrentStepIndex,
  selectProductSteps,
  (currentIndex, steps) => currentIndex === steps.length - 1
);

export const selectIsConfigurationComplete = createSelector(
  selectMultiStepConfiguration,
  (configuration) => configuration?.isComplete || false
);

export const selectTotalPrice = createSelector(
  selectMultiStepConfiguration,
  (configuration) => configuration?.totalPrice || 0
);

export const selectCompletedStepsCount = createSelector(
  selectStepSelections,
  (selections) => {
    return Object.values(selections).filter((selection) => selection.isValid)
      .length;
  }
);

export const selectStepsSummary = createSelector(
  selectProductSteps,
  selectStepSelections,
  (steps, selections) => {
    return steps.map((step) => {
      const selection = selections[step.id];
      const selectedOptions = selection?.selectedOptionIds || [];
      const selectedOptionDetails = selectedOptions
        .map((optionId) => step.options.find((opt) => opt.id === optionId))
        .filter(Boolean);

      return {
        step,
        selection,
        selectedOptions: selectedOptionDetails,
        isCompleted: selection?.isValid || false,
      };
    });
  }
);

// Get previous steps summary (excludes current step)
export const selectPreviousStepsSummary = createSelector(
  selectStepsSummary,
  selectCurrentStepIndex,
  (stepsSummary, currentIndex) => {
    return stepsSummary.slice(0, currentIndex);
  }
);
