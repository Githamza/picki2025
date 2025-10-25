import { Tables, TablesInsert } from '../types/supabase.types';

export interface Product {
  id: number;
  name: string;
  price: number;
  image_url?: string;
  short_description?: string;
  is_available?: boolean;
}

export interface ProductComplement {
  id: string;
  product_id: number;
  complement_product_id: number;
  is_required: boolean;
  selection_type: 'single' | 'multiple';
  max_selections: number;
  display_order: number;
  custom_price?: number;
  is_free: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  complement_product?: Product;
}

export interface OrderItemComplement {
  id: string;
  order_item_id: number;
  complement_product_id: number;
  complement_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface ComplementSelection {
  complement_product_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface ProductWithComplements extends Product {
  complements: ProductComplement[];
}

export interface ComplementGroup {
  id: string;
  title: string;
  is_required: boolean;
  selection_type: 'single' | 'multiple';
  max_selections: number;
  complements: ProductComplement[];
}

// Cart item with complements
export interface CartItemWithComplements {
  id: string;
  product_id: number;
  product_name: string;
  product_price: number;
  product_image_url?: string;
  quantity: number;
  selected_complements: ComplementSelection[];
  total_price: number; // includes complement prices
  notes?: string;
}

// For creating orders
export interface OrderItemWithComplements {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  selected_complements: ComplementSelection[];
  vendor_id: string;
  comment?: string;
}

// Type aliases for Supabase types
export type DatabaseProductComplement = Tables<'product_complements'>;
export type DatabaseOrderItemComplement = Tables<'order_item_complements'>;
export type DatabaseProductComplementInsert =
  TablesInsert<'product_complements'>;
export type DatabaseOrderItemComplementInsert =
  TablesInsert<'order_item_complements'>;
