import { Component, OnInit, Pipe, PipeTransform } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AppState, Category } from '../../store/models/app.state';
import * as CategoryActions from '../../store/actions/category.actions';
import * as CategorySelectors from '../../store/selectors/category.selectors';

@Pipe({
  name: 'kebabCase',
  standalone: true,
})
export class KebabCasePipe implements PipeTransform {
  transform(value: string): string {
    return value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }
}

@Component({
  selector: 'app-category-menu',
  standalone: true,
  imports: [
    CommonModule,
    NgClass,
    RouterModule,
    MatListModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './category-menu.component.html',
  styleUrls: ['./category-menu.component.scss'],
})
export class CategoryMenuComponent implements OnInit {
  categories$: Observable<Category[]>;
  selectedCategoryId$: Observable<number | null>;
  loading$: Observable<boolean>;
  error$: Observable<string | null>;

  constructor(private store: Store<AppState>, private router: Router) {
    this.categories$ = this.store.select(CategorySelectors.selectAllCategories);
    this.selectedCategoryId$ = this.store.select(
      CategorySelectors.selectSelectedCategoryId
    );
    this.loading$ = this.store.select(
      CategorySelectors.selectCategoriesLoading
    );
    this.error$ = this.store.select(CategorySelectors.selectCategoriesError);
  }

  ngOnInit() {
    // Dispatch action to load categories when component initializes
    this.store.dispatch(CategoryActions.loadCategories());
  }

  selectCategory(category: Category) {
    this.store.dispatch(
      CategoryActions.selectCategory({ categoryId: category.id })
    );
    // Convert category name to kebab-case for URL
    const kebab = category.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    this.router.navigate([`/${kebab}/products`]);
  }
}
