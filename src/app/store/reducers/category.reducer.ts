import { createReducer, on } from '@ngrx/store';
import { CategoryState } from '../models/app.state';
import * as CategoryActions from '../actions/category.actions';

export const initialCategoryState: CategoryState = {
  categories: [],
  selectedCategoryId: null,
  loading: false,
  error: null,
};

// Mock categories for testing
const mockCategories = [
  {
    id: 1,
    name: 'Appetizers',
    icon: 'restaurant',
    imageUrl: 'https://foodish-api.com/images/samosa/samosa1.jpg',
    description: 'Starters and small plates',
  },
  {
    id: 2,
    name: 'Main Courses',
    icon: 'lunch_dining',
    imageUrl: 'https://foodish-api.com/images/biryani/biryani1.jpg',
    description: 'Hearty main dishes',
  },
  {
    id: 3,
    name: 'Burgers',
    icon: 'lunch_dining',
    imageUrl: 'https://foodish-api.com/images/burger/burger1.jpg',
    description: 'Handcrafted burgers',
  },
  {
    id: 4,
    name: 'Pizza',
    icon: 'local_pizza',
    imageUrl: 'https://foodish-api.com/images/pizza/pizza1.jpg',
    description: 'Stone-baked pizzas',
  },
  {
    id: 5,
    name: 'Salads',
    icon: 'eco',
    imageUrl: 'https://foodish-api.com/images/rice/rice1.jpg',
    description: 'Fresh and healthy options',
  },
  {
    id: 6,
    name: 'Sides',
    icon: 'dinner_dining',
    imageUrl: 'https://foodish-api.com/images/dosa/dosa1.jpg',
    description: 'Perfect accompaniments',
  },
  {
    id: 7,
    name: 'Desserts',
    icon: 'icecream',
    imageUrl: 'https://foodish-api.com/images/dessert/dessert1.jpg',
    description: 'Sweet treats',
  },
  {
    id: 8,
    name: 'Drinks',
    icon: 'local_bar',
    imageUrl: 'https://foodish-api.com/images/pasta/pasta1.jpg',
    description: 'Refreshing beverages',
  },
];

export const categoryReducer = createReducer(
  initialCategoryState,
  on(CategoryActions.loadCategories, CategoryActions.loadCategoriesByVendor, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(CategoryActions.loadCategoriesSuccess, (state, { categories }) => ({
    ...state,
    categories,
    loading: false,
  })),
  on(CategoryActions.loadCategoriesFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(CategoryActions.selectCategory, (state, { categoryId }) => ({
    ...state,
    selectedCategoryId: categoryId,
  })),
  on(CategoryActions.clearSelectedCategory, (state) => ({
    ...state,
    selectedCategoryId: null,
  })),
  on(CategoryActions.addMockCategories, (state) => ({
    ...state,
    categories: mockCategories,
    loading: false,
  }))
);
