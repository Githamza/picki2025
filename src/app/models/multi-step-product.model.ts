export interface ProductStep {
  id: number;
  productId: number;
  name: string;
  displayOrder: number;
  stepType: 'single-select' | 'multi-select' | 'text-input';
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
  stockQuantity?: number | null; // Stock quantity from linked product (null = unlimited)
  alaCartePrice?: number; // Product's base price for pro-rata TVA calculation
  tvaRate?: number; // Product's TVA rate for pro-rata TVA calculation
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
  baseProductPrice: number;  // Base product's à la carte price for pro-rata TVA calculation
  baseProductTvaRate: number;  // Base product's TVA rate
  stepSelections: {
    stepId: number;
    stepName: string;
    selectedOptions: Array<{
      optionId: number;
      optionName: string;
      productId: number;
      priceAdjustment: number;
      alaCartePrice: number;    // Product's base price for pro-rata TVA calculation
      tvaRate: number;          // Product's TVA rate
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
