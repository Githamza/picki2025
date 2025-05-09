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
    description: 'Starters and small plates',
  },
  {
    id: 2,
    name: 'Main Courses',
    icon: 'lunch_dining',
    description: 'Hearty main dishes',
  },
  {
    id: 3,
    name: 'Burgers',
    icon: 'lunch_dining',
    description: 'Handcrafted burgers',
  },
  {
    id: 4,
    name: 'Pizza',
    icon: 'local_pizza',
    description: 'Stone-baked pizzas',
  },
  {
    id: 5,
    name: 'Salads',
    icon: 'eco',
    description: 'Fresh and healthy options',
  },
  {
    id: 6,
    name: 'Sides',
    icon: 'dinner_dining',
    description: 'Perfect accompaniments',
  },
  { id: 7, name: 'Desserts', icon: 'icecream', description: 'Sweet treats' },
  {
    id: 8,
    name: 'Drinks',
    icon: 'local_bar',
    description: 'Refreshing beverages',
  },
];

export const categoryReducer = createReducer(
  initialCategoryState,
  on(CategoryActions.loadCategories, (state) => ({
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
  on(CategoryActions.addMockCategories, (state) => ({
    ...state,
    categories: mockCategories,
    loading: false,
  }))
);
