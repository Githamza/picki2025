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
          })) || []
      )
    );
  }
}
