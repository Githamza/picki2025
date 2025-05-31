import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { Database } from '../types/supabase.types';

export type Vendor = Database['public']['Tables']['vendors']['Row'];

@Injectable({
  providedIn: 'root',
})
export class VendorService {
  private supabaseService = inject(SupabaseService);

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

          if (vendor && vendor.is_active) {
            this.currentVendorSubject.next(vendor);
            observer.next(vendor);
          } else {
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
      const vendors = this.vendorsSubject.value;
      const currentlyAllInactive = vendors.every((vendor) => !vendor.is_active);

      // If all are inactive, activate all. If any are active, deactivate all.
      const newStatus = currentlyAllInactive;

      // Update all vendors
      const updatePromises = vendors.map((vendor) =>
        this.supabaseService.updateVendorStatus(vendor.id, newStatus)
      );

      await Promise.all(updatePromises);

      // Reload vendors to refresh state
      await this.loadVendors();

      return newStatus;
    } catch (error) {
      console.error('Error toggling orders suspension:', error);
      throw error;
    }
  }

  async updateVendorStatus(vendorId: string, isActive: boolean): Promise<void> {
    try {
      await this.supabaseService.updateVendorStatus(vendorId, isActive);
      await this.loadVendors();
    } catch (error) {
      console.error('Error updating vendor status:', error);
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
}
