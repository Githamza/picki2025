import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';

export interface Category {
  id: number;
  name: string;
  icon?: string;
  imageUrl?: string;
  description?: string;
  displayOrder?: number;
}

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private supabaseService = inject(SupabaseService);

  getCategories(): Observable<Category[]> {
    return from(this.supabaseService.getCategories()).pipe(
      map(
        (categories) =>
          categories?.map((cat) => ({
            id: cat.id,
            name: cat.name,
            icon: cat.icon || undefined,
            imageUrl: cat.image_url || undefined,
            description: cat.description || undefined,
            displayOrder: cat.display_order || 0,
          })) || []
      )
    );
  }

  getCategoriesByVendor(vendorId: string): Observable<Category[]> {
    return from(this.supabaseService.getCategoriesByVendor(vendorId)).pipe(
      map(
        (categories) =>
          categories?.map((cat) => ({
            id: cat.id,
            name: cat.name,
            icon: cat.icon || undefined,
            imageUrl: cat.image_url || undefined,
            description: cat.description || undefined,
            displayOrder: cat.display_order || 0,
          })) || []
      )
    );
  }
}
