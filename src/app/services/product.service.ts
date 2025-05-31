import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { Tables } from '../types/supabase.types';

export interface Product {
  id: number;
  name: string;
  price: number;
  imageUrl: string;
  categoryId: number;
  description: string;
  shortDescription: string;
  longDescription: string;
}

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private supabaseService = inject(SupabaseService);

  getProducts(): Observable<Product[]> {
    return from(this.supabaseService.getProducts()).pipe(
      map((products) => products?.map((p) => this.mapToProduct(p)) || [])
    );
  }

  getProductsByCategory(categoryId: number): Observable<Product[]> {
    return from(this.supabaseService.getProducts(categoryId)).pipe(
      map((products) => products?.map((p) => this.mapToProduct(p)) || [])
    );
  }

  getProductById(id: number): Observable<Product | null> {
    return from(this.supabaseService.getProductById(id)).pipe(
      map((product) => (product ? this.mapToProduct(product) : null))
    );
  }

  private mapToProduct(dbProduct: any): Product {
    return {
      id: dbProduct.id,
      name: dbProduct.name,
      price: Number(dbProduct.price),
      imageUrl: dbProduct.image_url || '',
      categoryId: dbProduct.category_id || 0,
      description: dbProduct.short_description || '',
      shortDescription: dbProduct.short_description || '',
      longDescription: dbProduct.long_description || '',
    };
  }
}
