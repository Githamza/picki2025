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
  AUTH_CONFIG,
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
    this.setLoading(true);

    // Listen for auth state changes
    this.supabaseAuthService
      .getClient()
      .auth.onAuthStateChange(async (event, session) => {
        setTimeout(async () => {
          console.log('🔐 Auth state changed:', event, session?.user?.email);

          if (event === 'SIGNED_IN' && session?.user) {
            await this.handleSignIn(session.user);
          } else if (event === 'SIGNED_OUT') {
            this.handleSignOut();
          } else if (event === 'TOKEN_REFRESHED' && session?.user) {
            // Don't call handleSignIn again, just log the refresh
            console.log('🔐 Token refreshed for user:', session.user.email);
            // The session is already valid, no need to re-fetch user data
          } else if (event === 'INITIAL_SESSION' && session?.user) {
            // Handle initial session restoration
            console.log(
              '🔐 Restoring initial session for user:',
              session.user.email
            );
            await this.handleSignIn(session.user);
          }
        }, 0);
      });

    // Check for existing session (this will trigger INITIAL_SESSION event if found)
    this.supabaseAuthService
      .getClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        console.log(
          '🔐 Checking existing session:',
          session ? 'Found' : 'None'
        );
        if (!session) {
          console.log('🔐 No existing session found');
          this.setLoading(false);
        }
        // If session exists, it will be handled by the INITIAL_SESSION event above
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
    try {
      // Get admin user data from database
      const adminUser = await this.getAdminUserData(user.id);

      if (!adminUser) {
        console.error('No admin user data found for user:', user.id);
        this.handleSignOut();
        return;
      }

      if (!adminUser.is_active) {
        throw new Error(AuthError.ACCOUNT_DISABLED);
      }

      // Get vendor data
      const vendor = await this.getVendorData(adminUser.vendor_id);
      if (!vendor) {
        throw new Error(AuthError.VENDOR_NOT_FOUND);
      }
      // Note: We allow admin access even to inactive vendors

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
      console.error('Error handling sign in:', error);
      this.handleSignOut();
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
    this.setLoading(true);
    this.setError(null);

    try {
      // Get current vendor from route or service
      const currentVendor = this.vendorService.getCurrentVendor();
      if (!currentVendor) {
        throw new Error(AuthError.VENDOR_NOT_FOUND);
      }

      // Sign in with Supabase Auth
      const { data, error } = await this.supabaseAuthService
        .getClient()
        .auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

      if (error) throw error;

      // The auth state change handler will take care of the rest
      // We just need to wait for the user to be set
      return new Promise((resolve, reject) => {
        let timeoutId: number;

        const checkUser = () => {
          const user = this.authStateService.user();
          if (user) {
            clearTimeout(timeoutId);
            resolve(user);
          }
        };

        // Check immediately
        checkUser();

        // Set up interval to check periodically
        const intervalId = setInterval(checkUser, 100);

        // Timeout after 10 seconds
        timeoutId = window.setTimeout(() => {
          clearInterval(intervalId);
          reject(new Error('Login timeout'));
        }, 10000);
      });
    } catch (error) {
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

      // Navigate to vendor selection or login
      const currentVendor = this.vendorService.getCurrentVendor();
      if (currentVendor) {
        const vendorSlug = this.vendorService.getVendorSlug(currentVendor);
        await this.router.navigate([`/${vendorSlug}/admin/login`]);
      } else {
        await this.router.navigate(['/']);
      }
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
   * Check if current session is valid
   */
  async isSessionValid(user?: AuthUser): Promise<boolean> {
    try {
      const {
        data: { session },
        error,
      } = await this.supabaseAuthService.getClient().auth.getSession();

      if (error || !session || !session.user) {
        return false;
      }

      // Check if session is expired
      const now = Math.floor(Date.now() / 1000);
      return session.expires_at ? session.expires_at > now : false;
    } catch (error) {
      console.error('Error validating session:', error);
      return false;
    }
  }

  /**
   * Synchronous version for backward compatibility
   * This should be used carefully as it doesn't check actual session validity
   */
  isSessionValidSync(user?: AuthUser): boolean {
    if (user) {
      // If specific user provided, validate that user's session
      if (!user.lastLoginAt) return false;
      const sessionAge = Date.now() - new Date(user.lastLoginAt).getTime();
      return sessionAge < AUTH_CONFIG.SESSION_TIMEOUT;
    }

    // Otherwise use the AuthStateService's computed value
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
