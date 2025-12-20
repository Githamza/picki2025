export interface ProductStep {
  id: number;
  productId: number;
  name: string;
  displayOrder: number;
  stepType: 'single-select' | 'multi-select' | 'summary';
  description?: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  options: ProductStepOption[];
}

export interface ProductStepOption {
  id: number;
  stepIds: number[]; // Changed from stepId: number to support multiple steps
  productId: number | null; // Now nullable for component options
  name: string;
  priceAdjustment: number;
  displayOrder: number;
  isAvailable: boolean;
  imageUrl?: string;
  optionType: 'component' | 'product'; // New: Distinguish between components and products
  description?: string; // New: Additional description for options
  vendorId: string; // Added vendor isolation
}

export interface StepSelection {
  stepId: number;
  selectedOptionIds: number[];
  isValid: boolean;
}

export interface MultiStepProductConfiguration {
  baseProduct: any; // Product interface from product.service
  steps: ProductStep[];
  selections: { [stepId: number]: StepSelection };
  currentStepIndex: number;
  isComplete: boolean;
  totalPrice: number;
}

export interface CartMultiStepMetadata {
  baseProductId: number;
  stepSelections: {
    stepId: number;
    stepName: string;
    selectedOptions: Array<{
      optionId: number;
      optionName: string;
      productId: number;
      priceAdjustment: number;
      customisationSelections?: {
        customisationId: number;
        customisationName: string;
        selectedOptionIds: number[];
        selectedOptionNames: string[];
        priceAdjustments: number[];
      }[];
    }>;
  }[];
  totalSteps: number;
}
