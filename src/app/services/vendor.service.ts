import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { SupabaseAuthService } from './supabase-auth.service';
import { Database } from '../types/supabase.types';

export type Vendor = Database['public']['Tables']['vendors']['Row'];

export interface BusinessHours {
  day: string;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
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

  // Track current vendor context
  private currentVendorSubject = new BehaviorSubject<Vendor | null>(null);
  public currentVendor$ = this.currentVendorSubject.asObservable();

  // Track if orders are suspended (all vendors inactive)
  private ordersSuspendedSubject = new BehaviorSubject<boolean>(false);
  public ordersSuspended$ = this.ordersSuspendedSubject.asObservable();

  // Track all vendors
  private vendorsSubject = new BehaviorSubject<Vendor[]>([]);
  public vendors$ = this.vendorsSubject.asObservable();

  async loadVendors(): Promise<void> {
    try {
      const vendors = await this.supabaseService.getAllVendors();
      this.vendorsSubject.next(vendors || []);
      this.updateOrdersSuspendedStatus(vendors || []);

      // If no current vendor is set and we have vendors, set the first one as current
      if (!this.currentVendorSubject.value && vendors && vendors.length > 0) {
        this.currentVendorSubject.next(vendors[0]);
      }
    } catch (error) {
      console.error('Error loading vendors:', error);
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

  // Set current vendor by slug
  setCurrentVendorBySlug(slug: string): Observable<Vendor | null> {
    return new Observable((observer) => {
      this.loadVendors()
        .then(() => {
          const vendors = this.vendorsSubject.value;
          const vendor = vendors.find(
            (v) => this.createSlug(v.business_name) === slug
          );

          if (vendor) {
            // Set vendor regardless of active status
            this.currentVendorSubject.next(vendor);
            observer.next(vendor);
          } else {
            // Only set null if vendor not found
            this.currentVendorSubject.next(null);
            observer.next(null);
          }
          observer.complete();
        })
        .catch((error) => {
          console.error('Error loading vendors:', error);
          observer.error(error);
        });
    });
  }

  // Get current vendor
  getCurrentVendor(): Vendor | null {
    return this.currentVendorSubject.value;
  }

  // Set current vendor directly (used after authentication)
  setCurrentVendor(vendor: Vendor): void {
    this.currentVendorSubject.next(vendor);
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
    // Orders are suspended if ALL vendors are inactive
    const allInactive = vendors.every((vendor) => !vendor.is_active);
    this.ordersSuspendedSubject.next(allInactive);
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

      // Update the current vendor's local state
      const updatedVendor = { ...currentVendor, is_active: newStatus };
      this.currentVendorSubject.next(updatedVendor);

      // Update the vendor in the vendors list
      const vendors = this.vendorsSubject.value;
      const updatedVendors = vendors.map((vendor) =>
        vendor.id === currentVendor.id
          ? { ...vendor, is_active: newStatus }
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
      await this.loadVendors();
    } catch (error) {
      console.error('Error updating vendor status:', error);
      throw error;
    }
  }

  async updateVendorLogo(vendorId: string, logoUrl: string): Promise<void> {
    try {
      await this.supabaseAuthService.updateVendorLogo(vendorId, logoUrl);
      await this.loadVendors();
    } catch (error) {
      console.error('Error updating vendor logo:', error);
      throw error;
    }
  }

  getCurrentOrdersSuspendedStatus(): boolean {
    return this.ordersSuspendedSubject.value;
  }

  getActiveVendorsCount(): number {
    return this.vendorsSubject.value.filter((vendor) => vendor.is_active)
      .length;
  }

  getTotalVendorsCount(): number {
    return this.vendorsSubject.value.length;
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
              phone: metadata?.phone || '+33 2 47 XX XX XX',
              email: metadata?.email || 'contact@lehabibi.fr',
              website: metadata?.website || 'https://lehabibi.fr',
            },
            address: {
              street: metadata?.street || '83 Bis Rue Du Commerce',
              city: metadata?.city || 'Tours',
              postal_code: metadata?.postal_code || '37000',
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

          // Fallback to mock data on error
          console.log('🔄 Falling back to mock data due to error');
          const restaurantInfo: RestaurantInfo = {
            vendor: currentVendor,
            businessHours: this.getMockBusinessHours(),
            contact: {
              phone: '+33 2 47 XX XX XX',
              email: 'contact@lehabibi.fr',
              website: 'https://lehabibi.fr',
            },
            address: {
              street: '83 Bis Rue Du Commerce',
              city: 'Tours',
              postal_code: '37000',
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
    businessHours: any[];
    contact: { phone?: string; email?: string; website?: string };
    address: {
      street: string;
      city: string;
      postal_code: string;
      country: string;
    };
  }): Promise<void> {
    const currentVendor = this.getCurrentVendor();
    if (!currentVendor) {
      throw new Error('No current vendor found');
    }

    try {
      // Save business hours
      await this.saveBusinessHoursToDB(
        currentVendor.id,
        restaurantData.businessHours
      );

      // Save vendor metadata
      await this.saveVendorMetadataToDB(currentVendor.id, {
        ...restaurantData.contact,
        ...restaurantData.address,
      });
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
        };

        await this.supabaseAuthService.updateBusinessHours(vendorId, i, {
          open_time: hours.is_closed ? null : hours.open_time,
          close_time: hours.is_closed ? null : hours.close_time,
          is_closed: hours.is_closed,
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
      await this.supabaseAuthService.upsertVendorMetadata({
        vendor_id: vendorId,
        ...metadata,
      });
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
      },
      {
        day: 'Mardi',
        open_time: '11:00',
        close_time: '23:00',
        is_closed: false,
      },
      {
        day: 'Mercredi',
        open_time: '11:00',
        close_time: '23:00',
        is_closed: false,
      },
      {
        day: 'Jeudi',
        open_time: '11:00',
        close_time: '23:00',
        is_closed: false,
      },
      {
        day: 'Vendredi',
        open_time: '11:00',
        close_time: '23:59',
        is_closed: false,
      },
      {
        day: 'Samedi',
        open_time: '11:00',
        close_time: '23:59',
        is_closed: false,
      },
      { day: 'Dimanche', open_time: null, close_time: null, is_closed: true },
    ];
  }
}
