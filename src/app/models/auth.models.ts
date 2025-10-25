import { Database } from '../types/supabase.types';

// Database types
export type VendorAdminUser =
  Database['public']['Tables']['vendor_admin_users']['Row'];
export type VendorAdminUserInsert =
  Database['public']['Tables']['vendor_admin_users']['Insert'];
export type VendorAdminUserUpdate =
  Database['public']['Tables']['vendor_admin_users']['Update'];

// Extended types for Supabase Auth integration
export interface VendorAdminUserWithAuth extends VendorAdminUser {
  user_id: string; // Supabase Auth user ID
}

export interface VendorAdminUserInsertWithAuth extends VendorAdminUserInsert {
  user_id: string; // Supabase Auth user ID
}

// Authentication interfaces
export interface LoginCredentials {
  email: string;
  password: string;
  vendorId: string;
}

export interface LoginResponse {
  user: VendorAdminUser;
  vendor: Database['public']['Tables']['vendors']['Row'];
  token?: string;
}

export interface AuthUser {
  id: string; // This is now the Supabase Auth user ID
  email: string;
  firstName: string;
  lastName: string;
  role: AdminRole;
  vendorId: string;
  vendor: {
    id: string;
    businessName: string;
    slug: string;
    logoUrl?: string;
  };
  lastLoginAt?: string;
  isActive: boolean;
  // Supabase Auth specific properties
  emailConfirmed?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Enums
export enum AdminRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  STAFF = 'staff',
}

export enum AuthError {
  INVALID_CREDENTIALS = 'invalid_credentials',
  ACCOUNT_DISABLED = 'account_disabled',
  VENDOR_NOT_FOUND = 'vendor_not_found',
  SESSION_EXPIRED = 'session_expired',
  UNAUTHORIZED = 'unauthorized',
  NETWORK_ERROR = 'network_error',
  EMAIL_NOT_CONFIRMED = 'email_not_confirmed',
  WEAK_PASSWORD = 'weak_password',
  USER_ALREADY_EXISTS = 'user_already_exists',
  INVALID_EMAIL = 'invalid_email',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
}

// Form interfaces
export interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface CreateAdminUserData {
  vendorId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: AdminRole;
}

// Permission interfaces
export interface Permission {
  resource: string;
  action: string;
}

export interface RolePermissions {
  [AdminRole.ADMIN]: Permission[];
  [AdminRole.MANAGER]: Permission[];
  [AdminRole.STAFF]: Permission[];
}

// Default permissions configuration
export const DEFAULT_PERMISSIONS: RolePermissions = {
  [AdminRole.ADMIN]: [
    { resource: 'orders', action: 'read' },
    { resource: 'orders', action: 'update' },
    { resource: 'products', action: 'read' },
    { resource: 'products', action: 'create' },
    { resource: 'products', action: 'update' },
    { resource: 'products', action: 'delete' },
    { resource: 'users', action: 'read' },
    { resource: 'users', action: 'create' },
    { resource: 'users', action: 'update' },
    { resource: 'vendor', action: 'read' },
    { resource: 'vendor', action: 'update' },
    { resource: 'analytics', action: 'read' },
  ],
  [AdminRole.MANAGER]: [
    { resource: 'orders', action: 'read' },
    { resource: 'orders', action: 'update' },
    { resource: 'products', action: 'read' },
    { resource: 'products', action: 'update' },
    { resource: 'analytics', action: 'read' },
  ],
  [AdminRole.STAFF]: [
    { resource: 'orders', action: 'read' },
    { resource: 'orders', action: 'update' },
    { resource: 'products', action: 'read' },
  ],
};

// Utility types
export type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: AuthUser | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'LOGOUT' };

// Constants
export const AUTH_CONFIG = {
  // Supabase Auth handles session management, so we don't need these keys
  // but keeping them for backward compatibility with existing code
  TOKEN_KEY: 'vendor_admin_token',
  USER_KEY: 'vendor_admin_user',
  SESSION_TIMEOUT: 8 * 60 * 60 * 1000, // 8 hours
  REMEMBER_ME_TIMEOUT: 30 * 24 * 60 * 60 * 1000, // 30 days
  // Supabase Auth specific config
  REFRESH_TOKEN_THRESHOLD: 60 * 1000, // Refresh token 1 minute before expiry
} as const;
