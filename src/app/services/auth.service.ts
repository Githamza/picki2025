import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import { SupabaseAuthService } from './supabase-auth.service';
import { VendorService } from './vendor.service';
import { AuthStateService } from '../store/auth.state';
import {
  AuthUser,
  LoginFormData,
  CreateAdminUserData,
  AdminRole,
  AuthError,
  Permission,
} from '../models/auth.models';
import { User } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly supabaseAuthService = inject(SupabaseAuthService);
  private readonly vendorService = inject(VendorService);
  private readonly authStateService = inject(AuthStateService);
  private readonly router = inject(Router);

  // Public computed signals (delegated to AuthStateService)
  readonly authState = this.authStateService.authState;
  readonly currentUser = this.authStateService.user;
  readonly isAuthenticated = this.authStateService.isAuthenticated;
  readonly isLoading = this.authStateService.isLoading;
  readonly error = this.authStateService.error;

  constructor() {
    this.initializeAuth();
  }

  /**
   * Initialize Supabase Auth and listen for auth state changes
   */
  private initializeAuth(): void {
    console.log('🔐 Initializing authentication service...');
    // Don't set global loading here to avoid blocking the login page
    // if no session is present. handleSignIn will set loading if needed.

    // Listen for auth state changes
    this.supabaseAuthService
      .getClient()
      .auth.onAuthStateChange(async (event, session) => {
        // Use a small delay to ensure Supabase state is stable
        setTimeout(async () => {
          console.log('🔐 Auth state changed:', event, session?.user?.email);

          if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
            // Only handle sign in if we don't already have a user or if it's a new session
            const currentUser = this.currentUser();
            if (!currentUser || currentUser.id !== session.user.id) {
              await this.handleSignIn(session.user);
            } else {
              // User was restored from localStorage but VendorService
              // BehaviorSubject resets on page reload — restore vendor context.
              if (!this.vendorService.getCurrentVendor() && currentUser.vendorId) {
                try {
                  const vendor = await this.getVendorData(currentUser.vendorId);
                  if (vendor) {
                    this.vendorService.setCurrentVendor(vendor);
                  }
                } catch (error) {
                  console.error('Error restoring vendor context:', error);
                }
              }
              this.setLoading(false);
            }
          } else if (event === 'SIGNED_OUT') {
            this.handleSignOut();
            this.setLoading(false);
          } else {
            // For other events like TOKEN_REFRESHED, ensure loading is off
            this.setLoading(false);
          }
        }, 0);
      });

    // Check for existing session
    this.supabaseAuthService
      .getClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        console.log('🔐 Session check completed:', session ? 'Session found' : 'No session');
        if (!session) {
          this.setLoading(false);
        }
        // If session exists, it will be handled by onAuthStateChange
      })
      .catch((error) => {
        console.error('🔐 Error checking session:', error);
        this.setLoading(false);
      });
  }

  /**
   * Handle user sign in
   */
  private async handleSignIn(user: User): Promise<void> {
    console.log('🔐 Handling sign in for:', user.email);
    this.setLoading(true);
    try {
      // Get admin user data from database
      const adminUser = await this.getAdminUserData(user.id);

      if (!adminUser) {
        console.warn('⚠️ No admin user data found for user:', user.id);
        this.handleSignOut();
        return;
      }

      if (!adminUser.is_active) {
        console.warn('⚠️ User account is inactive:', user.email);
        throw new Error(AuthError.ACCOUNT_DISABLED);
      }

      // Get vendor data
      const vendor = await this.getVendorData(adminUser.vendor_id);
      if (!vendor) {
        console.warn('⚠️ Vendor not found for id:', adminUser.vendor_id);
        throw new Error(AuthError.VENDOR_NOT_FOUND);
      }
      
      console.log('✅ Admin user and vendor data loaded:', vendor.business_name);

      // Create auth user object
      const authUser: AuthUser = {
        id: user.id,
        email: user.email!,
        firstName: adminUser.first_name,
        lastName: adminUser.last_name,
        role: adminUser.role as AdminRole,
        vendorId: adminUser.vendor_id,
        vendor: {
          id: vendor.id,
          businessName: vendor.business_name,
          slug: this.vendorService.getVendorSlug(vendor),
          logoUrl: vendor.logo_url || undefined,
        },
        lastLoginAt: adminUser.last_login_at || undefined,
        isActive: adminUser.is_active,
      };

      // Update last login timestamp
      await this.updateLastLogin(user.id);

      // Set user state
      this.setUser(authUser);

      // Set current vendor in VendorService for proper navigation context
      this.vendorService.setCurrentVendor(vendor);
    } catch (error) {
      console.error('❌ Error handling sign in:', error);
      this.handleSignOut();
      const errorMessage = this.handleAuthError(error);
      this.setError(errorMessage);
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Handle user sign out
   */
  private handleSignOut(): void {
    this.setUser(null);
  }

  /**
   * Login with email and password
   */
  async login(formData: LoginFormData): Promise<AuthUser> {
    console.log('🔐 Login process started for:', formData.email);
    this.setLoading(true);
    this.setError(null);

    try {
      // Sign in with Supabase Auth
      const { data, error } = await this.supabaseAuthService
        .getClient()
        .auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

      if (error) throw error;
      
      console.log('✅ Supabase auth successful, fetching vendor data...');

      // Give a tiny bit of time for onAuthStateChange to potentially handle it
      // but we continue anyway to be safe.
      
      // Find vendor by admin email
      const vendorData = await this.supabaseAuthService.getVendorByAdminEmail(formData.email);
      
      if (!vendorData) {
        console.warn('⚠️ No vendor found for admin email:', formData.email);
        throw new Error(AuthError.VENDOR_NOT_FOUND);
      }

      const { vendor, adminUser } = vendorData;

      if (!adminUser.is_active) {
        console.warn('⚠️ Admin user is inactive:', formData.email);
        throw new Error(AuthError.ACCOUNT_DISABLED);
      }

      console.log('✅ Vendor data retrieved:', vendor.business_name);

      // Create auth user object
      const authUser: AuthUser = {
        id: data.user!.id,
        email: data.user!.email!,
        firstName: adminUser.first_name,
        lastName: adminUser.last_name,
        role: adminUser.role as AdminRole,
        vendorId: vendor.id,
        vendor: {
          id: vendor.id,
          businessName: vendor.business_name,
          slug: this.vendorService.getVendorSlug(vendor),
          logoUrl: vendor.logo_url || undefined,
        },
        lastLoginAt: adminUser.last_login_at || undefined,
        isActive: adminUser.is_active,
      };

      // Update last login timestamp
      await this.updateLastLogin(data.user!.id);

      // Set user state
      this.setUser(authUser);

      // Set current vendor in VendorService for proper navigation context
      this.vendorService.setCurrentVendor(vendor);

      return authUser;
    } catch (error) {
      console.error('❌ Login process failed:', error);
      const errorMessage = this.handleAuthError(error);
      this.setError(errorMessage);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Logout and clean up session
   */
  async logout(): Promise<void> {
    this.setLoading(true);

    try {
      // Sign out from Supabase Auth
      await this.supabaseAuthService.getClient().auth.signOut();

      // Navigate to centralized admin login
      await this.router.navigate(['/admin/login']);
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Sign up new admin user
   */
  async signUp(userData: CreateAdminUserData): Promise<void> {
    if (!this.hasPermission('users', 'create')) {
      throw new Error(AuthError.UNAUTHORIZED);
    }

    try {
      this.setLoading(true);

      // Sign up with Supabase Auth
      const { data: authData, error: authError } =
        await this.supabaseAuthService.getClient().auth.signUp({
          email: userData.email,
          password: userData.password,
        });

      if (authError) throw authError;

      if (authData.user) {
        // Create admin user record
        const { error: adminError } = await this.supabaseAuthService
          .getClient()
          .from('vendor_admin_users')
          .insert({
            user_id: authData.user.id,
            vendor_id: userData.vendorId,
            email: userData.email,
            first_name: userData.firstName,
            last_name: userData.lastName,
            role: userData.role,
            created_by: this.currentUser()?.id,
          } as any);

        if (adminError) throw adminError;
      }
    } catch (error) {
      console.error('Error creating admin user:', error);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Get admin user data from database
   */
  private async getAdminUserData(userId: string): Promise<any> {
    return await this.supabaseAuthService.getAdminUserData(userId);
  }

  /**
   * Get vendor data
   */
  private async getVendorData(vendorId: string): Promise<any> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('vendors')
      .select('*')
      .eq('id', vendorId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(resource: string, action: string): boolean {
    return this.authStateService.hasPermission()(resource, action);
  }

  /**
   * Get user permissions
   */
  getUserPermissions(): Permission[] {
    return this.authStateService.getUserPermissions();
  }

  /**
   * Check if current session is valid by verifying with Supabase server
   * Uses getUser() which always validates with the auth server,
   * unlike getSession() which may return cached data.
   * 
   * This is the recommended approach per Supabase documentation:
   * "The only way to ensure that a user has logged out or their session has ended
   * is to get the user's details with getUser()."
   */
  async isSessionValid(user?: AuthUser): Promise<boolean> {
    try {
      // Use getUser() for server-side validation (recommended by Supabase)
      // This ensures the session is actually valid on the server, not just cached locally
      const {
        data: { user: authUser },
        error,
      } = await this.supabaseAuthService.getClient().auth.getUser();

      if (error || !authUser) {
        return false;
      }

      // Optionally verify the user ID matches if a specific user was provided
      if (user && authUser.id !== user.id) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating session:', error);
      return false;
    }
  }

  /**
   * Synchronous version for UI purposes only
   * WARNING: This does NOT validate with Supabase server.
   * Use isSessionValid() for security-critical operations.
   */
  isSessionValidSync(user?: AuthUser): boolean {
    // For sync check, we only verify local state exists
    // Actual session validity must be checked async with isSessionValid()
    if (user) {
      return user.isActive;
    }
    return this.authStateService.isSessionValid();
  }

  /**
   * Refresh user data from database
   */
  async refreshUser(): Promise<AuthUser | null> {
    const currentUser = this.currentUser();
    if (!currentUser) return null;

    try {
      this.setLoading(true);

      const adminUser = await this.getAdminUserData(currentUser.id);
      const vendor = await this.getVendorData(adminUser.vendor_id);

      const refreshedUser: AuthUser = {
        ...currentUser,
        firstName: adminUser.first_name,
        lastName: adminUser.last_name,
        role: adminUser.role as AdminRole,
        isActive: adminUser.is_active,
        vendor: {
          ...currentUser.vendor,
          businessName: vendor.business_name,
          logoUrl: vendor.logo_url || undefined,
        },
      };

      this.setUser(refreshedUser);
      return refreshedUser;
    } catch (error) {
      console.error('Error refreshing user:', error);
      return null;
    } finally {
      this.setLoading(false);
    }
  }

  // Private methods

  /**
   * Update user's last login timestamp
   */
  private async updateLastLogin(userId: string): Promise<void> {
    await this.supabaseAuthService.updateLastLogin(userId);
  }

  /**
   * Handle session expiration
   */
  private handleSessionExpired(): void {
    this.setError('Session expired. Please login again.');
    this.logout();
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError(error: any): string {
    if (error.message?.includes('Invalid login credentials')) {
      return 'Invalid email or password';
    }
    if (error.message === AuthError.ACCOUNT_DISABLED) {
      return 'Your account has been disabled';
    }
    if (error.message === AuthError.VENDOR_NOT_FOUND) {
      return 'Vendor not found or inactive';
    }

    console.error('Authentication error:', error);
    return error.message || 'An error occurred during authentication';
  }

  // State management helpers (delegated to AuthStateService)
  private setLoading(loading: boolean): void {
    this.authStateService.setLoading(loading);
  }

  private setUser(user: AuthUser | null): void {
    this.authStateService.setUser(user);
  }

  private setError(error: string | null): void {
    this.authStateService.setError(error);
  }
}
