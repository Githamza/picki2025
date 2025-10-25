import { Product } from '../../services/product.service';
import { ProductState } from '../reducers/product.reducer'; // Adjust path as necessary
import { MultiStepProductState } from '../reducers/multi-step-product.reducer';
import { ComplementSelection } from '../../models/complement.model';

// App state model
export interface AppState {
  banner: BannerState;
  category: CategoryState;
  product: ProductState; // Added product state
  multiStepProduct: MultiStepProductState;
  cart: CartState;
  // Add more state slices as needed
}

// Banner feature state
export interface BannerState {
  title: string;
  subtitle: string;
  isVisible: boolean;
}

// Category feature state
export interface CategoryState {
  categories: Category[];
  selectedCategoryId: number | null;
  loading: boolean;
  error: string | null;
}

// Category model
export interface Category {
  id: number;
  name: string;
  icon?: string;
  imageUrl?: string;
  description?: string;
  displayOrder?: number;
}

// Re-exporting individual states for convenience if needed elsewhere

// If ProductState is not in a separate file like banner.state.ts or category.state.ts,
// then its definition would be directly in product.reducer.ts as we created.
// No separate product.state.ts file needed if ProductState is defined in product.reducer.ts.

export interface CartItem {
  product: Product;
  quantity: number;
  comment?: string;
  selectedComplements?: ComplementSelection[];
  totalPrice?: number; // Add this for multi-step products
  metadata?: any; // Add metadata field for multi-step products
}

export interface CartState {
  items: CartItem[];
}
