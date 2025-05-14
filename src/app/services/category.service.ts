import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Category {
  id: number;
  name: string;
  icon: string;
  description: string;
}

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private categoriesUrl = 'http://localhost:8080/api/categories'; // URL to web api

  constructor(private http: HttpClient) {}

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(this.categoriesUrl);
  }
}
