// App state model
export interface AppState {
  banner: BannerState;
  categories: CategoryState;
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
  description?: string;
}
