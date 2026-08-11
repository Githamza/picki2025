import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { SupabaseAuthService } from './supabase-auth.service';
import { AuthStateService } from '../store/auth.state';
import { Database } from '../types/supabase.types';

export type Vendor = Database['public']['Tables']['vendors']['Row'];
export type OrderType = Database['public']['Enums']['order_type'];

export interface BusinessHours {
  day: string;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
  pickup_enabled: boolean;
  pickup_open_time: string | null;
  pickup_close_time: string | null;
}

export interface RestaurantContact {
  phone?: string;
  email?: string;
  website?: string;
}

export interface RestaurantAddress {
  street: string;
  city: string;
  postal_code: string;
  country: string;
}

export interface RestaurantInfo {
  vendor: Vendor;
  businessHours: BusinessHours[];
  contact: RestaurantContact;
  address: RestaurantAddress;
}

@Injectable({
  providedIn: 'root',
})
export class VendorService {
  private supabaseService = inject(SupabaseService);
  private supabaseAuthService = inject(SupabaseAuthService);
  private authStateService = inject(AuthStateService);

  // Track current vendor context
  private currentVendorSubject = new BehaviorSubject<Vendor | null>(null);
  public currentVendor$ = this.currentVendorSubject.asObservable();

  // Track if orders are suspended (all vendors inactive)
  private ordersSuspendedSubject = new BehaviorSubject<boolean>(false);
  public ordersSuspended$ = this.ordersSuspendedSubject.asObservable();

  // Track all vendors
  private vendorsSubject = new BehaviorSubject<Vendor[]>([]);
  public vendors$ = this.vendorsSubject.asObservable();

  // Cache management
  private vendorsCache: Vendor[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes cache
  private loadingPromise: Promise<void> | null = null;
  private apiCallCount = 0; // Track API calls for debugging

  async loadVendors(): Promise<void> {
    // Check if we already have a loading in progress
    if (this.loadingPromise) {
      console.log('🔄 Vendors already loading, waiting for existing request...');
      return this.loadingPromise;
    }

    // Check if cache is still valid
    const now = Date.now();
    const isCacheValid = this.vendorsCache && 
      (now - this.cacheTimestamp) < this.CACHE_DURATION_MS &&
      this.vendorsCache.length > 0;

    if (isCacheValid) {
      console.log('✅ Using cached vendors data (cache age:', 
        Math.round((now - this.cacheTimestamp) / 1000), 'seconds)');
      
      // Update subjects with cached data
      this.vendorsSubject.next([...this.vendorsCache!]);
      this.updateOrdersSuspendedStatus(this.vendorsCache!);
      
      // Set current vendor if not already set
      if (!this.currentVendorSubject.value && this.vendorsCache!.length > 0) {
        const authVendorId = this.authStateService.vendorId();
        const preferredVendor = authVendorId
          ? this.vendorsCache!.find(v => v.id === authVendorId)
          : null;
        this.currentVendorSubject.next(preferredVendor || this.vendorsCache![0]);
      }
      return;
    }

    console.log('🚀 Loading vendors from database...');
    
    // Create a shared loading promise to coordinate concurrent calls
    this.loadingPromise = this.loadVendorsInternal()
      .finally(() => {
        // Clear the loading promise when done
        this.loadingPromise = null;
      });

    return this.loadingPromise;
  }

  private async loadVendorsInternal(): Promise<void> {
    try {
      this.apiCallCount++;
      console.log(`📊 API Call #${this.apiCallCount} to getAllVendors()`);
      
      const vendors = await this.supabaseService.getAllVendors();
      const vendorsData = vendors || [];
      
      // Update cache
      this.vendorsCache = [...vendorsData];
      this.cacheTimestamp = Date.now();
      
      // Update subjects
      this.vendorsSubject.next(vendorsData);
      this.updateOrdersSuspendedStatus(vendorsData);

      // If no current vendor is set and we have vendors, prefer the authenticated user's vendor
      if (!this.currentVendorSubject.value && vendorsData.length > 0) {
        const authVendorId = this.authStateService.vendorId();
        const preferredVendor = authVendorId
          ? vendorsData.find(v => v.id === authVendorId)
          : null;
        this.currentVendorSubject.next(preferredVendor || vendorsData[0]);
      }
      
      console.log(`✅ Vendors loaded successfully: ${vendorsData.length} vendors (API Call #${this.apiCallCount})`);
    } catch (error) {
      console.error('❌ Error loading vendors:', error);
      throw error;
    }
  }

  // Convert business name to URL-friendly slug
  private createSlug(businessName: string): string {
    return businessName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Resolve a slug to a vendor deterministically. Business names are not
   * unique, so several vendors can share a slug: prefer active vendors,
   * then the oldest account, so a later duplicate registration can never
   * shadow the original storefront.
   */
  private findVendorBySlug(vendors: Vendor[], slug: string): Vendor | null {
    const matches = vendors.filter(
      (v) => this.createSlug(v.business_name) === slug
    );
    if (matches.length === 0) {
      return null;
    }
    matches.sort((a, b) => {
      if (a.is_active !== b.is_active) {
        return a.is_active ? -1 : 1;
      }
      return (a.created_at || '').localeCompare(b.created_at || '');
    });
    return matches[0];
  }

  // Set current vendor by slug
  setCurrentVendorBySlug(slug: string): Observable<Vendor | null> {
    return new Observable((observer) => {
      // Check if we already have vendors loaded
      const currentVendors = this.vendorsSubject.value;
      
      if (currentVendors.length > 0) {
        console.log(`🔍 Vendor data already available, searching for slug: ${slug}`);
        const vendor = this.findVendorBySlug(currentVendors, slug);

        if (vendor) {
          console.log(`✅ Vendor found in existing data: ${vendor.business_name}`);
          this.currentVendorSubject.next(vendor);
          observer.next(vendor);
        } else {
          console.log(`❌ Vendor not found in existing data: ${slug}`);
          this.currentVendorSubject.next(null);
          observer.next(null);
        }
        observer.complete();
      } else {
        console.log(`🔍 No vendor data available, loading vendors for slug: ${slug}`);
        // Load vendors if not already available
        this.loadVendors()
          .then(() => {
            const vendors = this.vendorsSubject.value;
            const vendor = this.findVendorBySlug(vendors, slug);

            if (vendor) {
              console.log(`✅ Vendor found after loading: ${vendor.business_name}`);
              this.currentVendorSubject.next(vendor);
              observer.next(vendor);
            } else {
              console.log(`❌ Vendor not found after loading: ${slug}`);
              this.currentVendorSubject.next(null);
              observer.next(null);
            }
            observer.complete();
          })
          .catch((error) => {
            console.error('❌ Error loading vendors:', error);
            observer.error(error);
          });
      }
    });
  }

  /**
   * Set current vendor by custom domain (e.g. "granola.fr").
   * The provided domain should already have "www." stripped and be lower-cased.
   */
  setCurrentVendorByCustomDomain(customDomain: string): Observable<Vendor | null> {
    return new Observable((observer) => {
      const normalized = (customDomain || '').trim().toLowerCase();

      if (!normalized) {
        this.currentVendorSubject.next(null);
        observer.next(null);
        observer.complete();
        return;
      }

      // If current vendor already matches, return early
      const currentVendor = this.currentVendorSubject.value;
      if (
        currentVendor &&
        (currentVendor.customDomain || '').toString().toLowerCase() === normalized
      ) {
        observer.next(currentVendor);
        observer.complete();
        return;
      }

      this.supabaseService
        .getVendorByCustomDomain(normalized)
        .then((vendor) => {
          if (vendor) {
            this.currentVendorSubject.next(vendor);
            // Populate vendors list/cache minimally so downstream code has vendor context.
            this.vendorsSubject.next([vendor]);
            this.vendorsCache = [vendor];
            this.cacheTimestamp = Date.now();
            this.updateOrdersSuspendedStatus([vendor]);

            // Keep auth service vendor context in sync where relevant.
            this.supabaseAuthService.setCurrentVendorId(vendor.id);

            observer.next(vendor);
          } else {
            this.currentVendorSubject.next(null);
            observer.next(null);
          }
          observer.complete();
        })
        .catch((error) => {
          console.error('❌ Error resolving vendor by custom domain:', error);
          observer.error(error);
        });
    });
  }

  // Get current vendor
  getCurrentVendor(): Vendor | null {
    return this.currentVendorSubject.value;
  }

  getCurrentCurrency(): string {
    const currency = this.currentVendorSubject.value?.currency;
    return (currency || 'EUR').toString().trim().toUpperCase() || 'EUR';
  }

  // Set current vendor directly (used after authentication)
  setCurrentVendor(vendor: Vendor): void {
    this.currentVendorSubject.next(vendor);
    this.supabaseAuthService.setCurrentVendorId(vendor.id);
    this.updateOrdersSuspendedStatus([vendor]);
  }

  // Get vendor slug from vendor object
  getVendorSlug(vendor: Vendor): string {
    return this.createSlug(vendor.business_name);
  }

  // Get all vendor slugs for routing
  getAllVendorSlugs(): string[] {
    return this.vendorsSubject.value.map((vendor) =>
      this.getVendorSlug(vendor)
    );
  }

  private updateOrdersSuspendedStatus(vendors: Vendor[]): void {
    const nowMs = Date.now();
    const currentVendorId = this.currentVendorSubject.value?.id;
    if (currentVendorId) {
      const currentVendor =
        vendors.find((vendor) => vendor.id === currentVendorId) ??
        this.currentVendorSubject.value;
      const isSuspended = currentVendor
        ? this.isVendorOrdersSuspended(currentVendor, nowMs)
        : true;
      this.ordersSuspendedSubject.next(isSuspended);
      return;
    }

    // Fallback: if no current vendor, consider all vendors
    const allSuspended = vendors.every((vendor) =>
      this.isVendorOrdersSuspended(vendor, nowMs)
    );
    this.ordersSuspendedSubject.next(allSuspended);
  }

  async toggleOrdersSuspension(): Promise<boolean> {
    try {
      const currentVendor = this.getCurrentVendor();
      if (!currentVendor) {
        throw new Error('No current vendor selected');
      }

      // Toggle the current vendor's status
      const newStatus = !currentVendor.is_active;

      // Update only the current vendor
      await this.supabaseAuthService.updateVendorStatus(
        currentVendor.id,
        newStatus
      );

      // Clear cache since data has changed
      this.clearCache();

      // When activating, also clear orders_suspended_at to match DB state
      const vendorPatch: Partial<Vendor> = { is_active: newStatus };
      if (newStatus) {
        vendorPatch.orders_suspended_at = null;
      }

      // Update the current vendor's local state
      const updatedVendor = { ...currentVendor, ...vendorPatch };
      this.currentVendorSubject.next(updatedVendor);

      // Update the vendor in the vendors list
      const vendors = this.vendorsSubject.value;
      const updatedVendors = vendors.map((vendor) =>
        vendor.id === currentVendor.id
          ? { ...vendor, ...vendorPatch }
          : vendor
      );
      this.vendorsSubject.next(updatedVendors);

      // Update orders suspended status
      this.updateOrdersSuspendedStatus(updatedVendors);

      return newStatus;
    } catch (error) {
      console.error('Error toggling orders suspension:', error);
      throw error;
    }
  }

  async updateVendorStatus(vendorId: string, isActive: boolean): Promise<void> {
    try {
      await this.supabaseAuthService.updateVendorStatus(vendorId, isActive);
      // Clear cache since data has changed, then reload
      this.clearCache();
      await this.loadVendors();
    } catch (error) {
      console.error('Error updating vendor status:', error);
      throw error;
    }
  }

  async updateVendorLogo(vendorId: string, logoUrl: string): Promise<void> {
    try {
      await this.supabaseAuthService.updateVendorLogo(vendorId, logoUrl);
      // Clear cache since data has changed, then reload
      this.clearCache();
      await this.loadVendors();
    } catch (error) {
      console.error('Error updating vendor logo:', error);
      throw error;
    }
  }

  async getVendorBanner(vendorId: string) {
    try {
      return await this.supabaseAuthService.getVendorBanner(vendorId);
    } catch (error) {
      console.error('Error getting vendor banner:', error);
      throw error;
    }
  }

  async upsertVendorBanner(vendorId: string, imageUrl: string, title?: string): Promise<void> {
    try {
      await this.supabaseAuthService.upsertVendorBanner(vendorId, imageUrl, title);
    } catch (error) {
      console.error('Error updating vendor banner:', error);
      throw error;
    }
  }

  getCurrentOrdersSuspendedStatus(): boolean {
    return this.ordersSuspendedSubject.value;
  }

  getActiveVendorsCount(): number {
    const nowMs = Date.now();
    return this.vendorsSubject.value.filter(
      (vendor) => !this.isVendorOrdersSuspended(vendor, nowMs)
    ).length;
  }

  getTotalVendorsCount(): number {
    return this.vendorsSubject.value.length;
  }

  isVendorOrdersOpen(vendor: Vendor): boolean {
    return !this.isVendorOrdersSuspended(vendor, Date.now());
  }

  private isVendorOrdersSuspended(vendor: Vendor, nowMs: number): boolean {
    if (!vendor.is_active) {
      return true;
    }

    const suspendAt = vendor.orders_suspended_at;
    if (!suspendAt) {
      return false;
    }

    const suspendDate = new Date(suspendAt);
    if (Number.isNaN(suspendDate.getTime())) {
      return false;
    }

    // Compare only the time-of-day, ignoring the date
    const now = new Date(nowMs);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const suspendMinutes = suspendDate.getHours() * 60 + suspendDate.getMinutes();

    return currentMinutes >= suspendMinutes;
  }

  // Clear vendor cache (use after updates)
  clearCache(): void {
    console.log('🗑️ Clearing vendor cache...');
    this.vendorsCache = null;
    this.cacheTimestamp = 0;
    this.loadingPromise = null;
  }

  // Get API call count for debugging
  getApiCallCount(): number {
    return this.apiCallCount;
  }

  // Reset API call count for debugging
  resetApiCallCount(): void {
    this.apiCallCount = 0;
  }

  // Test method to trigger getRestaurantInfo with detailed logging
  testGetRestaurantInfo(vendorId?: string): void {
    console.log('🧪 Testing getRestaurantInfo function...');
    console.log(
      '🧪 Available vendors:',
      this.vendorsSubject.value.map((v) => ({
        id: v.id,
        name: v.business_name,
      }))
    );

    this.getRestaurantInfo(vendorId).subscribe({
      next: (restaurantInfo) => {
        console.log('🧪 Test successful - Restaurant info received:', {
          hasInfo: !!restaurantInfo,
          vendorId: restaurantInfo?.vendor?.id,
          businessName: restaurantInfo?.vendor?.business_name,
          businessHoursCount: restaurantInfo?.businessHours?.length || 0,
          hasContact: !!restaurantInfo?.contact,
          hasAddress: !!restaurantInfo?.address,
        });
      },
      error: (error) => {
        console.error('🧪 Test failed - Error in getRestaurantInfo:', error);
      },
      complete: () => {
        console.log('🧪 Test completed');
      },
    });
  }

  // Get restaurant information including business hours
  // Now connected to the database
  getRestaurantInfo(vendorId?: string): Observable<RestaurantInfo | null> {
    console.log('🍽️ getRestaurantInfo called with vendorId:', vendorId);

    const currentVendor = vendorId
      ? this.vendorsSubject.value.find((v) => v.id === vendorId)
      : this.getCurrentVendor();

    if (!currentVendor) {
      console.warn('⚠️ No current vendor found for getRestaurantInfo');
      return of(null);
    }

    console.log('🏪 Current vendor found:', {
      id: currentVendor.id,
      businessName: currentVendor.business_name,
    });

    return new Observable((observer) => {
      console.log('🔄 Starting parallel database calls for restaurant info...');

      Promise.all([
        this.getBusinessHoursFromDB(currentVendor.id),
        this.getVendorMetadataFromDB(currentVendor.id),
      ])
        .then(([businessHours, metadata]) => {
          console.log('✅ Database calls completed successfully:', {
            businessHoursCount: businessHours?.length || 0,
            hasMetadata: !!metadata,
            metadataKeys: metadata ? Object.keys(metadata) : [],
          });

          const restaurantInfo: RestaurantInfo = {
            vendor: currentVendor,
            businessHours:
              businessHours.length > 0
                ? businessHours
                : this.getMockBusinessHours(),
            contact: {
              phone: metadata?.phone || '',
              email: metadata?.email || '',
              website: metadata?.website || '',
            },
            address: {
              street: metadata?.street || '',
              city: metadata?.city || '',
              postal_code: metadata?.postal_code || '',
              country: metadata?.country || 'France',
            },
          };

          console.log('✅ Restaurant info constructed successfully:', {
            vendorId: restaurantInfo.vendor.id,
            businessHoursCount: restaurantInfo.businessHours.length,
            contact: restaurantInfo.contact,
            address: restaurantInfo.address,
          });

          observer.next(restaurantInfo);
          observer.complete();
        })
        .catch((error) => {
          console.error('❌ Error fetching restaurant info:', {
            error: error,
            message: error?.message,
            stack: error?.stack,
            vendorId: currentVendor.id,
          });

          // Log specific error types
          if (error?.message?.includes('fetch')) {
            console.error('🌐 Network error detected in getRestaurantInfo');
          }
          if (error?.message?.includes('unauthorized')) {
            console.error(
              '🔒 Unauthorized error detected in getRestaurantInfo'
            );
          }
          if (error?.message?.includes('not found')) {
            console.error('🔍 Not found error detected in getRestaurantInfo');
          }

          // Fallback to empty data on error
          console.log('🔄 Falling back to empty data due to error');
          const restaurantInfo: RestaurantInfo = {
            vendor: currentVendor,
            businessHours: this.getMockBusinessHours(),
            contact: {
              phone: '',
              email: '',
              website: '',
            },
            address: {
              street: '',
              city: '',
              postal_code: '',
              country: 'France',
            },
          };

          console.log('✅ Fallback restaurant info created:', {
            vendorId: restaurantInfo.vendor.id,
            usingMockData: true,
          });

          observer.next(restaurantInfo);
          observer.complete();
        });
    });
  }

  // Save restaurant information (business hours + metadata)
  async saveRestaurantInfo(restaurantData: {
    businessHours?: any[];
    contact?: { phone?: string; email?: string; website?: string };
    address?: {
      street: string;
      city: string;
      postal_code: string;
      country: string;
    };
    enabledOrderTypes?: OrderType[];
    onlinePaymentsEnabled?: boolean;
    dailyStockResetEnabled?: boolean;
    autoPrintEnabled?: boolean;
    deliverySettings?: {
      deliverySystem: 'picki' | 'own';
      ownDeliveryPrice: number;
    };
    customMessages?: {
      closed_message?: string | null;
      closed_description?: string | null;
      orders_suspended_message?: string | null;
      info_message?: string | null;
      info_message_enabled?: boolean;
    };
    ordersSuspendedAt?: string | null;
  }): Promise<void> {
    const currentVendor = this.getCurrentVendor();
    if (!currentVendor) {
      throw new Error('No current vendor found');
    }

    try {
      // Save business hours (only if provided)
      if (restaurantData.businessHours) {
        await this.saveBusinessHoursToDB(
          currentVendor.id,
          restaurantData.businessHours
        );
      }

      // Save vendor metadata (only if contact or address provided)
      if (restaurantData.contact || restaurantData.address) {
        await this.saveVendorMetadataToDB(currentVendor.id, {
          ...restaurantData.contact,
          ...restaurantData.address,
        });
      }

      // Apply vendor-level settings updates (enabled order types, online payments toggle)
      let updatedVendor: Vendor | null = null;

      if (restaurantData.enabledOrderTypes?.length) {
        updatedVendor = await this.supabaseAuthService.updateVendorEnabledOrderTypes(
          currentVendor.id,
          restaurantData.enabledOrderTypes
        );
      }

      if (typeof restaurantData.onlinePaymentsEnabled === 'boolean') {
        updatedVendor = await this.supabaseAuthService.updateVendorOnlinePaymentsEnabled(
          currentVendor.id,
          restaurantData.onlinePaymentsEnabled
        );
      }

      if (restaurantData.deliverySettings) {
        updatedVendor = await this.supabaseAuthService.updateVendorDeliverySettings(
          currentVendor.id,
          restaurantData.deliverySettings
        );
      }

      if (typeof restaurantData.dailyStockResetEnabled === 'boolean') {
        updatedVendor = await this.supabaseAuthService.updateVendorDailyStockReset(
          currentVendor.id,
          restaurantData.dailyStockResetEnabled
        );
      }

      if (typeof restaurantData.autoPrintEnabled === 'boolean') {
        updatedVendor = await this.supabaseAuthService.updateVendorAutoPrintEnabled(
          currentVendor.id,
          restaurantData.autoPrintEnabled
        );
      }

      if (restaurantData.customMessages) {
        updatedVendor = await this.supabaseAuthService.updateVendorCustomMessages(
          currentVendor.id,
          restaurantData.customMessages
        );
      }

      if (typeof restaurantData.ordersSuspendedAt !== 'undefined') {
        updatedVendor = await this.supabaseAuthService.updateVendorOrdersSuspendedAt(
          currentVendor.id,
          restaurantData.ordersSuspendedAt ?? null
        );
      }

      if (updatedVendor) {
        // Keep local vendor context in sync
        this.currentVendorSubject.next(updatedVendor);
        this.vendorsSubject.next(
          this.vendorsSubject.value.map((v) =>
            v.id === updatedVendor!.id ? updatedVendor! : v
          )
        );
        this.vendorsCache = this.vendorsSubject.value;
        this.cacheTimestamp = Date.now();
      }
    } catch (error) {
      console.error('Error saving restaurant info:', error);
      throw error;
    }
  }

  // Get business hours from database (now implemented)
  private async getBusinessHoursFromDB(
    vendorId: string
  ): Promise<BusinessHours[]> {
    console.log('🕐 getBusinessHoursFromDB called for vendorId:', vendorId);

    try {
      console.log('🔄 Calling supabaseAuthService.getBusinessHours...');
      const data = await this.supabaseAuthService.getBusinessHours(vendorId);

      console.log('📊 Business hours data received:', {
        dataLength: data?.length || 0,
        data: data,
      });

      // If no business hours exist, initialize default ones
      if (!data || data.length === 0) {
        console.log('⚠️ No business hours found, initializing defaults...');
        await this.supabaseAuthService.initializeDefaultBusinessHours(vendorId);

        console.log('🔄 Fetching newly created default business hours...');
        // Fetch the newly created default business hours
        const defaultData = await this.supabaseAuthService.getBusinessHours(
          vendorId
        );

        console.log('✅ Default business hours fetched:', {
          defaultDataLength: defaultData?.length || 0,
        });

        return this.transformBusinessHours(defaultData || []);
      }

      console.log('✅ Business hours found, transforming data...');
      const transformedData = this.transformBusinessHours(data);

      console.log('✅ Business hours transformed successfully:', {
        transformedLength: transformedData.length,
      });

      return transformedData;
    } catch (error) {
      console.error('❌ Error fetching business hours from database:', {
        error: error,
        message: (error as any)?.message,
        stack: (error as any)?.stack,
        vendorId: vendorId,
      });

      // Log specific error types
      if ((error as any)?.message?.includes('fetch')) {
        console.error('🌐 Network error in getBusinessHoursFromDB');
      }
      if ((error as any)?.message?.includes('unauthorized')) {
        console.error('🔒 Unauthorized error in getBusinessHoursFromDB');
      }
      if ((error as any)?.message?.includes('not found')) {
        console.error('🔍 Not found error in getBusinessHoursFromDB');
      }

      return [];
    }
  }

  // Get vendor metadata from database
  private async getVendorMetadataFromDB(vendorId: string): Promise<any> {
    console.log('📋 getVendorMetadataFromDB called for vendorId:', vendorId);

    try {
      console.log('🔄 Calling supabaseAuthService.getVendorMetadata...');
      const data = await this.supabaseAuthService.getVendorMetadata(vendorId);

      console.log('📊 Vendor metadata data received:', {
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : [],
        data: data,
      });

      // If no metadata exists, initialize default metadata
      if (!data) {
        console.log('⚠️ No vendor metadata found, initializing defaults...');
        await this.supabaseAuthService.initializeDefaultVendorMetadata(
          vendorId
        );

        console.log('🔄 Fetching newly created default metadata...');
        // Fetch the newly created default metadata
        const defaultData = await this.supabaseAuthService.getVendorMetadata(
          vendorId
        );

        console.log('✅ Default metadata fetched:', {
          hasDefaultData: !!defaultData,
          defaultDataKeys: defaultData ? Object.keys(defaultData) : [],
        });

        return defaultData;
      }

      console.log('✅ Vendor metadata found and returned');
      return data;
    } catch (error) {
      console.error('❌ Error fetching vendor metadata from database:', {
        error: error,
        message: (error as any)?.message,
        stack: (error as any)?.stack,
        vendorId: vendorId,
      });

      // Log specific error types
      if ((error as any)?.message?.includes('fetch')) {
        console.error('🌐 Network error in getVendorMetadataFromDB');
      }
      if ((error as any)?.message?.includes('unauthorized')) {
        console.error('🔒 Unauthorized error in getVendorMetadataFromDB');
      }
      if ((error as any)?.message?.includes('not found')) {
        console.error('🔍 Not found error in getVendorMetadataFromDB');
      }

      return null;
    }
  }

  // Save business hours to database
  private async saveBusinessHoursToDB(
    vendorId: string,
    businessHours: any[]
  ): Promise<void> {
    try {
      // Ensure we have business hours for all 7 days of the week
      for (let i = 0; i < 7; i++) {
        const hours = businessHours[i] || {
          is_closed: true,
          open_time: null,
          close_time: null,
          pickup_enabled: false,
          pickup_open_time: null,
          pickup_close_time: null,
        };

        const pickupEnabled = hours.is_closed ? false : (hours.pickup_enabled ?? false);

        await this.supabaseAuthService.updateBusinessHours(vendorId, i, {
          open_time: hours.is_closed ? null : hours.open_time,
          close_time: hours.is_closed ? null : hours.close_time,
          is_closed: hours.is_closed,
          pickup_enabled: pickupEnabled,
          pickup_open_time: pickupEnabled ? hours.pickup_open_time : null,
          pickup_close_time: pickupEnabled ? hours.pickup_close_time : null,
        });
      }
    } catch (error) {
      console.error('Error saving business hours:', error);
      throw error;
    }
  }

  // Save vendor metadata to database
  private async saveVendorMetadataToDB(
    vendorId: string,
    metadata: {
      phone?: string;
      email?: string;
      website?: string;
      street?: string;
      city?: string;
      postal_code?: string;
      country?: string;
    }
  ): Promise<void> {
    try {
      // Convert empty strings to null to ensure proper database update
      const cleanedMetadata = {
        vendor_id: vendorId,
        phone: metadata.phone?.trim() || null,
        email: metadata.email?.trim() || null,
        website: metadata.website?.trim() || null,
        street: metadata.street?.trim() || null,
        city: metadata.city?.trim() || null,
        postal_code: metadata.postal_code?.trim() || null,
        country: metadata.country?.trim() || null,
      };

      await this.supabaseAuthService.upsertVendorMetadata(cleanedMetadata);
    } catch (error) {
      console.error('Error saving vendor metadata:', error);
      throw error;
    }
  }

  // Transform database business hours to display format (now implemented)
  private transformBusinessHours(dbHours: any[]): BusinessHours[] {
    const dayNames = [
      'Dimanche',
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi',
    ];

    return dbHours.map((hour) => ({
      day: dayNames[hour.day_of_week],
      open_time: hour.open_time,
      close_time: hour.close_time,
      is_closed: hour.is_closed,
      pickup_enabled: hour.pickup_enabled ?? false,
      pickup_open_time: hour.pickup_open_time ?? null,
      pickup_close_time: hour.pickup_close_time ?? null,
    }));
  }

  // Fallback mock business hours data
  private getMockBusinessHours(): BusinessHours[] {
    return [
      {
        day: 'Lundi',
        open_time: '11:00',
        close_time: '23:00',
        is_closed: false,
        pickup_enabled: false,
        pickup_open_time: null,
        pickup_close_time: null,
      },
      {
        day: 'Mardi',
        open_time: '11:00',
        close_time: '23:00',
        is_closed: false,
        pickup_enabled: false,
        pickup_open_time: null,
        pickup_close_time: null,
      },
      {
        day: 'Mercredi',
        open_time: '11:00',
        close_time: '23:00',
        is_closed: false,
        pickup_enabled: false,
        pickup_open_time: null,
        pickup_close_time: null,
      },
      {
        day: 'Jeudi',
        open_time: '11:00',
        close_time: '23:00',
        is_closed: false,
        pickup_enabled: false,
        pickup_open_time: null,
        pickup_close_time: null,
      },
      {
        day: 'Vendredi',
        open_time: '11:00',
        close_time: '23:59',
        is_closed: false,
        pickup_enabled: false,
        pickup_open_time: null,
        pickup_close_time: null,
      },
      {
        day: 'Samedi',
        open_time: '11:00',
        close_time: '23:59',
        is_closed: false,
        pickup_enabled: false,
        pickup_open_time: null,
        pickup_close_time: null,
      },
      {
        day: 'Dimanche',
        open_time: null,
        close_time: null,
        is_closed: true,
        pickup_enabled: false,
        pickup_open_time: null,
        pickup_close_time: null,
      },
    ];
  }

  /**
   * Returns business hours adapted for Click & Collect pickup.
   * Days with pickup_enabled use pickup_open_time/pickup_close_time;
   * days without pickup_enabled are marked is_closed.
   */
  getPickupHours(businessHours: BusinessHours[]): BusinessHours[] {
    return businessHours.map((h) => {
      if (h.is_closed || !h.pickup_enabled) {
        return { ...h, is_closed: true, open_time: null, close_time: null };
      }
      return {
        ...h,
        open_time: h.pickup_open_time,
        close_time: h.pickup_close_time,
      };
    });
  }

  // Payment Provider Configuration
  async getPaymentProvidersStatus(vendorId?: string): Promise<{
    stripe: { configured: boolean; accountId: string | null };
    paygreen: { configured: boolean; onboardingCompleted: boolean };
    selectedProvider: 'STRIPE' | 'PAYGREEN' | null;
  }> {
    const currentVendor = vendorId
      ? this.vendorsSubject.value.find((v) => v.id === vendorId)
      : this.getCurrentVendor();

    if (!currentVendor) {
      return {
        stripe: { configured: false, accountId: null },
        paygreen: { configured: false, onboardingCompleted: false },
        selectedProvider: null,
      };
    }

    try {
      const [vendorPaymentConfig, paygreenCredentials] = await Promise.all([
        this.supabaseAuthService.getVendorPaymentConfig(currentVendor.id),
        this.supabaseAuthService.getPaygreenCredentials(currentVendor.id),
      ]);

      const stripeConfigured =
        !!vendorPaymentConfig?.stripe_account_id &&
        vendorPaymentConfig?.stripe_onboarding_completed === true;

      const paygreenOnboardingCompleted =
        vendorPaymentConfig?.paygreen_onboarding_completed === true;

      const paygreenConfigured =
        paygreenOnboardingCompleted &&
        !!paygreenCredentials?.shop_id &&
        paygreenCredentials?.active === true;

      return {
        stripe: {
          configured: stripeConfigured,
          accountId: vendorPaymentConfig?.stripe_account_id ?? null,
        },
        paygreen: { configured: paygreenConfigured, onboardingCompleted: paygreenOnboardingCompleted },
        selectedProvider: vendorPaymentConfig?.paymentprovider ?? null,
      };
    } catch (error) {
      console.error('Error fetching payment providers status:', error);
      return {
        stripe: { configured: false, accountId: null },
        paygreen: { configured: false, onboardingCompleted: false },
        selectedProvider: null,
      };
    }
  }

  async updatePaygreenMode(vendorId: string, mode: 'independent' | 'marketplace'): Promise<void> {
    const updatedVendor = await this.supabaseAuthService.updateVendorPaygreenMode(vendorId, mode);

    // Update local state
    this.currentVendorSubject.next(updatedVendor);
    this.vendorsSubject.next(
      this.vendorsSubject.value.map((v) =>
        v.id === updatedVendor.id ? updatedVendor : v
      )
    );
    this.vendorsCache = this.vendorsSubject.value;
    this.cacheTimestamp = Date.now();
  }

  async updateVendorNationalId(vendorId: string, nationalId: string): Promise<void> {
    const updatedVendor = await this.supabaseAuthService.updateVendorNationalId(vendorId, nationalId);

    // Update local state
    this.currentVendorSubject.next(updatedVendor);
    this.vendorsSubject.next(
      this.vendorsSubject.value.map((v) =>
        v.id === updatedVendor.id ? updatedVendor : v
      )
    );
    this.vendorsCache = this.vendorsSubject.value;
    this.cacheTimestamp = Date.now();
  }

  async updatePaymentProvider(provider: 'STRIPE' | 'PAYGREEN'): Promise<void> {
    const currentVendor = this.getCurrentVendor();
    if (!currentVendor) {
      throw new Error('No current vendor found');
    }

    const updatedVendor = await this.supabaseAuthService.updateVendorPaymentProvider(
      currentVendor.id,
      provider
    );

    // Update local state
    this.currentVendorSubject.next(updatedVendor);
    this.vendorsSubject.next(
      this.vendorsSubject.value.map((v) =>
        v.id === updatedVendor.id ? updatedVendor : v
      )
    );
    this.vendorsCache = this.vendorsSubject.value;
    this.cacheTimestamp = Date.now();
  }
}
