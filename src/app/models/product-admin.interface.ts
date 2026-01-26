export interface ProductAdmin {
  id: number;
  name: string;
  price: number;
  image_url: string | null;
  short_description: string | null;
  long_description: string | null;
  category_id: number | null;
  category_name?: string | null;
  vendor_id: string | null;
  is_available: boolean | null;
  stock_quantity: number | null;
  is_multi_step: boolean | null;
  no_catalogable: boolean | null;
  has_customisations?: boolean;
  display_order?: number;
  created_at: string | null;
  updated_at: string | null;
  steps?: ProductStep[];
  customisations?: import('./customisation.interface').Customisation[];
}

export interface ProductStep {
  id: number;
  product_id: number;
  name: string;
  display_order: number;
  step_type: string | null;
  description: string | null;
  is_required: boolean | null;
  min_selections: number | null;
  max_selections: number | null;
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean | null;
  display_order: number | null;
}

export interface ProductFormData {
  name: string;
  price: number;
  image_url: string | null;
  short_description: string | null;
  long_description: string | null;
  category_id: number | null;
  is_available: boolean;
  stock_quantity: number | null;
  is_multi_step: boolean;
  no_catalogable: boolean;
  display_order: number;
}

// Menu-specific interfaces (corrected based on actual DB schema)
export interface MenuAdmin extends ProductAdmin {
  step_count?: number;
  steps?: MenuStep[];
}

export interface MenuStep {
  id: number;
  product_id: number;
  name: string;
  display_order: number;
  step_type: 'single-select' | 'multi-select' | null;
  description: string | null;
  is_required: boolean | null;
  min_selections: number | null;
  max_selections: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  options?: MenuStepOption[];
}

export interface MenuStepOption {
  id: number;
  product_id: number | null; // Can be null for component-type options
  name: string;
  price_adjustment: number; // Numeric type in DB
  display_order: number;
  option_type: 'component' | 'product';
  description: string | null;
  image_url: string | null;
  step_ids: number[]; // Array type in PostgreSQL
  vendor_id: string; // Required UUID
  created_at?: string;
  updated_at?: string;
}

export interface MenuFormData {
  name: string;
  price: number;
  image_url: string | null;
  short_description: string | null;
  long_description: string | null;
  category_id: number | null;
  is_available: boolean;
  stock_quantity: number | null;
  no_catalogable: boolean;
}

export interface MenuStepFormData {
  name: string;
  step_type: 'single-select' | 'multi-select';
  description: string | null;
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  display_order: number;
}
