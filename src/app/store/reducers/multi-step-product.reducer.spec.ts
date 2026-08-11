import { multiStepProductReducer, initialMultiStepProductState } from './multi-step-product.reducer';
import * as MultiStepProductActions from '../actions/multi-step-product.actions';
import { ProductStep } from '../../models/multi-step-product.model';
import { Product } from '../../services/product.service';

const baseProduct = { id: 9103, name: 'Menu Burger', price: 12 } as Product;

function makeSteps(): ProductStep[] {
  return [
    {
      id: 1,
      productId: 9103,
      name: 'Burger',
      displayOrder: 1,
      stepType: 'single-select',
      description: undefined,
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      options: [
        { id: 11, name: 'Classique', priceAdjustment: 0, isAvailable: true },
        { id: 12, name: 'Double', priceAdjustment: 2, isAvailable: true },
      ] as ProductStep['options'],
    },
    {
      id: 2,
      productId: 9103,
      name: 'Dessert',
      displayOrder: 2,
      stepType: 'single-select',
      description: undefined,
      isRequired: false,
      minSelections: 0,
      maxSelections: 1,
      options: [
        { id: 21, name: 'Cookie', priceAdjustment: 1.5, isAvailable: true },
      ] as ProductStep['options'],
    },
  ];
}

function initialized() {
  return multiStepProductReducer(
    initialMultiStepProductState,
    MultiStepProductActions.initializeMultiStepProductSuccess({
      baseProduct,
      steps: makeSteps(),
    })
  );
}

describe('multiStepProductReducer (FR4d — no summary step)', () => {
  it('does not synthesize a summary step', () => {
    const state = initialized();
    expect(state.configuration!.steps.length).toBe(2);
    expect(
      state.configuration!.steps.every(
        (s) => s.stepType !== ('summary' as string)
      )
    ).toBeTrue();
  });

  it('is complete once every real step is valid — no summary visit needed', () => {
    let state = initialized();
    expect(state.configuration!.isComplete).toBeFalse();

    state = multiStepProductReducer(
      state,
      MultiStepProductActions.updateStepSelection({
        stepId: 1,
        selectedOptionIds: [11],
      })
    );
    // Required step satisfied + optional step empty-valid = complete.
    expect(state.configuration!.isComplete).toBeTrue();
  });

  it('prices selections on top of the base product', () => {
    let state = initialized();
    state = multiStepProductReducer(
      state,
      MultiStepProductActions.updateStepSelection({
        stepId: 1,
        selectedOptionIds: [12],
      })
    );
    expect(state.configuration!.totalPrice).toBe(14);
  });

  it('nextStep can move one past the last step (all sections collapsed)', () => {
    let state = initialized();
    state = multiStepProductReducer(state, MultiStepProductActions.nextStep());
    state = multiStepProductReducer(state, MultiStepProductActions.nextStep());
    state = multiStepProductReducer(state, MultiStepProductActions.nextStep());
    // Clamps at steps.length, not length - 1: the "nothing active" state.
    expect(state.configuration!.currentStepIndex).toBe(2);
  });
});
