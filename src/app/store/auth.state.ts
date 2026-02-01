import { Injectable, computed, effect, signal } from '@angular/core';
import { AuthUser, AuthState, DEFAULT_PERMISSIONS } from '../models/auth.models';
import { environment } from '../../environments/environment';

/**
 * Reactive authentication state management using Angular signals
 * This service provides a centralized way to manage authentication state
 * across the application using Angular's new signal-based reactivity.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthStateService {
  // Private signals for internal state management
  private readonly _user = signal<AuthUser | null>(null);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // Public computed signals (read-only)
  readonly user = computed(() => this._user());
  readonly isAuthenticated = computed(() => !!this._user());
  readonly isLoading = computed(() => this._isLoading());
  readonly error = computed(() => this._error());

  // Combined state signal
  readonly authState = computed<AuthState>(() => ({
    user: this.user(),
    isAuthenticated: this.isAuthenticated(),
    isLoading: this.isLoading(),
    error: this.error(),
  }));

  // Derived state computations
  readonly userRole = computed(() => this.user()?.role);
  readonly vendorId = computed(() => this.user()?.vendorId);
  readonly userDisplayName = computed(() => {
    const user = this.user();
    return user ? `${user.firstName} ${user.lastName}` : null;
  });

  readonly isAdmin = computed(() => this.user()?.role === 'admin');
  readonly isManager = computed(() => this.user()?.role === 'manager');
  readonly isStaff = computed(() => this.user()?.role === 'staff');

  constructor() {
    // Load persisted user data on initialization
    this.loadPersistedUser();

    // Effect to log authentication state changes in development
    if (!environment.production) {
      effect(() => {
        const state = this.authState();
        console.log('Auth State Changed:', {
          isAuthenticated: state.isAuthenticated,
          user: state.user?.email,
          role: state.user?.role,
          vendor: state.user?.vendor.businessName,
          loading: state.isLoading,
          error: state.error,
        });
      });
    }

    // Effect to handle automatic session cleanup
    effect(() => {
      const user = this.user();
      if (user && !user.isActive) {
        console.warn('User account has been deactivated, clearing session');
        this.clearUser();
      }
    });
  }

  // State mutation methods (called by AuthService)

  /**
   * Load persisted user data from localStorage
   */
  private loadPersistedUser(): void {
    try {
      const persistedUser = localStorage.getItem('admin_user_data');
      if (persistedUser) {
        const userData = JSON.parse(persistedUser);
        // Only restore if the data is recent (within session timeout)
        if (this.isUserDataValid(userData)) {
          this._user.set(userData);
          console.log('🔐 Restored user from localStorage:', userData.email);
        } else {
          // Clear expired data
          localStorage.removeItem('admin_user_data');
        }
      }
    } catch (error) {
      console.error('🔐 Error loading persisted user data:', error);
      localStorage.removeItem('admin_user_data');
    }
  }

  /**
   * Check if persisted user data is still valid
   * Note: We only check for data existence here. Actual session validity
   * is handled by Supabase Auth which manages token expiration and refresh.
   * This prevents conflicts between custom timeout logic and Supabase's native session management.
   */
  private isUserDataValid(userData: any): boolean {
    // Only check if essential user data exists
    // Let Supabase Auth handle actual session expiration
    return !!userData && !!userData.id && !!userData.email;
  }

  /**
   * Set the authenticated user
   */
  setUser(user: AuthUser | null): void {
    this._user.set(user);
    this._error.set(null); // Clear any previous errors

    // Persist user data to localStorage
    if (user) {
      try {
        localStorage.setItem('admin_user_data', JSON.stringify(user));
        console.log('🔐 User data persisted to localStorage');
      } catch (error) {
        console.error('🔐 Error persisting user data:', error);
      }
    } else {
      localStorage.removeItem('admin_user_data');
    }
  }

  /**
   * Update loading state
   */
  setLoading(loading: boolean): void {
    this._isLoading.set(loading);
  }

  /**
   * Set error message
   */
  setError(error: string | null): void {
    this._error.set(error);
    if (error) {
      this._isLoading.set(false); // Always stop loading on error
    }
  }

  /**
   * Clear error message
   */
  clearError(): void {
    this._error.set(null);
  }

  /**
   * Clear user data
   */
  clearUser(): void {
    this._user.set(null);
    this._error.set(null);
    this._isLoading.set(false);
    localStorage.removeItem('admin_user_data');
  }

  /**
   * Update user data (for profile updates, etc.)
   */
  updateUser(updates: Partial<AuthUser>): void {
    const currentUser = this._user();
    if (currentUser) {
      this._user.set({ ...currentUser, ...updates });
    }
  }

  /**
   * Check if user has specific permission based on role
   */
  hasPermission = computed(
    () =>
      (resource: string, action: string): boolean => {
        const user = this.user();
        if (!user) return false;

        const userPermissions = DEFAULT_PERMISSIONS[user.role] || [];

        return userPermissions.some(
          (permission: any) =>
            permission.resource === resource && permission.action === action
        );
      }
  );

  /**
   * Check if user has minimum required role
   */
  hasRole = computed(() => (requiredRole: string): boolean => {
    const user = this.user();
    if (!user) return false;

    const roleHierarchy: Record<string, number> = {
      staff: 1,
      manager: 2,
      admin: 3,
    };

    const userRoleLevel = roleHierarchy[user.role] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

    return userRoleLevel >= requiredRoleLevel;
  });

  /**
   * Get user permissions list
   */
  getUserPermissions = computed(() => {
    const user = this.user();
    if (!user) return [];

    return DEFAULT_PERMISSIONS[user.role] || [];
  });

  /**
   * Check if user session data exists locally
   * Note: This is a synchronous check for UI purposes only.
   * For security-critical operations, use AuthService.isSessionValid()
   * which validates with Supabase server using getUser().
   */
  isSessionValid = computed(() => {
    const user = this.user();
    // Only check if user data exists and is active
    // Actual session validity is managed by Supabase Auth
    return !!user && user.isActive;
  });

  /**
   * Session expiry tracking
   * Note: Supabase Auth handles session expiry automatically via token refresh.
   * These computed values are kept for UI compatibility but return simplified values.
   * The actual session lifetime is managed by Supabase Auth settings.
   */
  timeUntilExpiry = computed(() => {
    const user = this.user();
    // Return a non-zero value if user exists (session is managed by Supabase)
    // Actual expiry is handled by Supabase's auto-refresh mechanism
    return user ? Infinity : 0;
  });

  /**
   * Format time until expiry as human-readable string
   * Returns 'Active' when user is logged in since Supabase handles session refresh
   */
  timeUntilExpiryFormatted = computed(() => {
    const user = this.user();
    if (!user) return 'No session';
    // Session is actively managed by Supabase Auth with auto-refresh
    return 'Active';
  });

  /**
   * Reset all state to initial values
   */
  reset(): void {
    this._user.set(null);
    this._isLoading.set(false);
    this._error.set(null);
    localStorage.removeItem('admin_user_data');
  }
}
