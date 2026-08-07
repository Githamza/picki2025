import { TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';

import {
  StepSectionComponent,
  selectionHint,
} from './step-section.component';
import { ProductStep } from '../../../models/multi-step-product.model';
import { ProductService } from '../../../services/product.service';

function makeStep(partial: Partial<ProductStep>): ProductStep {
  return {
    id: 1,
    productId: 9,
    name: 'Accompagnements',
    displayOrder: 1,
    stepType: 'multi-select',
    description: null,
    isRequired: true,
    minSelections: 1,
    maxSelections: 2,
    options: [
      {
        id: 11,
        name: 'Frites',
        priceAdjustment: 0,
        isAvailable: true,
      } as ProductStep['options'][number],
      {
        id: 12,
        name: 'Salade',
        priceAdjustment: 0,
        isAvailable: true,
      } as ProductStep['options'][number],
    ],
    ...partial,
  } as ProductStep;
}

describe('selectionHint', () => {
  it('single-select prompts for one choice', () => {
    const step = makeStep({ stepType: 'single-select', minSelections: 1, maxSelections: 1 });
    expect(selectionHint(step, 0)).toBe('Choisissez une option');
  });

  it('multi-select counts down remaining required choices', () => {
    const step = makeStep({ minSelections: 2, maxSelections: 3 });
    expect(selectionHint(step, 0)).toBe('Choisissez 2 à 3 options');
    expect(selectionHint(step, 1)).toBe('Encore 1 choix');
  });

  it('multi-select reports optional remaining picks once satisfied', () => {
    const step = makeStep({ minSelections: 1, maxSelections: 2 });
    expect(selectionHint(step, 1)).toBe('Encore 1 choix possible');
    expect(selectionHint(step, 2)).toBe('');
  });
});

describe('StepSectionComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideMockStore(),
        { provide: ProductService, useValue: {} },
      ],
    });
  });

  function create(inputs: {
    step: ProductStep;
    selectedOptionIds?: number[];
    active?: boolean;
  }) {
    const fixture = TestBed.createComponent(StepSectionComponent);
    fixture.componentRef.setInput('step', inputs.step);
    fixture.componentRef.setInput(
      'selectedOptionIds',
      inputs.selectedOptionIds ?? []
    );
    fixture.componentRef.setInput('active', inputs.active ?? false);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the step name exactly once', () => {
    const fixture = create({ step: makeStep({}), active: true });
    const text: string = fixture.nativeElement.textContent;
    expect(text.split('Accompagnements').length - 1).toBe(1);
  });

  it('collapsed + satisfied shows the chosen options and a modify affordance', () => {
    const fixture = create({
      step: makeStep({}),
      selectedOptionIds: [11],
      active: false,
    });
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Frites');
    expect(text.toLowerCase()).toContain('modifier');
  });

  it('active section shows Obligatoire for required steps', () => {
    const fixture = create({ step: makeStep({}), active: true });
    expect(fixture.nativeElement.textContent).toContain('Obligatoire');
  });

  it('active optional step shows Optionnel', () => {
    const fixture = create({
      step: makeStep({ isRequired: false, minSelections: 0 }),
      active: true,
    });
    expect(fixture.nativeElement.textContent).toContain('Optionnel');
  });
});
