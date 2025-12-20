export interface Customisation {
  id: number;
  vendor_id: string;
  name: string;
  description: string | null;
  selection_type: 'single-select' | 'multi-select';
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  display_order: number;
  is_available: boolean;
  created_at?: string;
  updated_at?: string;
  options?: CustomisationOption[];
}

export interface CustomisationOption {
  id: number;
  customisation_id: number;
  product_id: number | null;
  name: string;
  price_adjustment: number | null;
  display_order: number;
  is_available: boolean;
  option_type: 'component' | 'product';
  description: string | null;
  image_url: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CustomisationFormData {
  name: string;
  description: string | null;
  selection_type: 'single-select' | 'multi-select';
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  display_order: number;
  is_available: boolean;
}

export interface CustomisationOptionFormData {
  name: string;
  product_id: number | null;
  price_adjustment: number | null;
  display_order: number;
  is_available: boolean;
  option_type: 'component' | 'product';
  description: string | null;
  image_url: string | null;
}

