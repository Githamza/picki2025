export type OnboardingCatalog = {
  categories: Array<{
    key: string;
    name: string;
    description?: string;
    image_url?: string;
  }>;
  products: Array<{
    name: string;
    price: number;
    categoryKey: string;
    short_description?: string;
    long_description?: string;
    image_url?: string;
    multi_step?: {
      steps: Array<{
        name: string;
        step_type: 'single-select' | 'multi-select';
        description?: string;
        is_required?: boolean;
        min_selections?: number;
        max_selections?: number;
        options: Array<{
          productName: string;
          price_adjustment?: number;
        }>;
      }>;
    };
  }>;
  banners?: Array<{
    image_url: string;
    link_url?: string | null;
    title?: string | null;
  }>;
};







