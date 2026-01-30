import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map } from 'rxjs/operators';

import { AppState } from '../../store/models/app.state';
import * as CategorySelectors from '../../store/selectors/category.selectors';
import * as CategoryActions from '../../store/actions/category.actions';
import { Category } from '../../store/models/app.state';
import { VendorNavigationService } from '../../services/vendor-navigation.service';
import { VendorService } from '../../services/vendor.service';
import { PRODUCT_PLACEHOLDER_IMAGE } from '../../shared/utils/image-placeholder';
import { CachedImageDirective } from '../../shared/directives/cached-image.directive';

@Component({
  selector: 'app-category-grid',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatProgressSpinnerModule, CachedImageDirective],
  templateUrl: './category-grid.component.html',
  styleUrls: ['./category-grid.component.scss'],
})
export class CategoryGridComponent implements OnInit {
  private store = inject(Store<AppState>);
  private vendorNavigation = inject(VendorNavigationService);
  private breakpointObserver = inject(BreakpointObserver);

  categories$!: Observable<Category[]>;
  loading$!: Observable<boolean>;
  error$!: Observable<string | null>;
  isHandset$ = this.breakpointObserver
    .observe(Breakpoints.Handset)
    .pipe(map((result) => result.matches));

  readonly placeholderImage = PRODUCT_PLACEHOLDER_IMAGE;

  ngOnInit() {
    this.categories$ = this.store.select(CategorySelectors.selectAllCategories);
    this.loading$ = this.store.select(CategorySelectors.selectCategoriesLoading);
    this.error$ = this.store.select(CategorySelectors.selectCategoriesError);


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

    // Use vendor-aware navigation
    this.vendorNavigation.navigateWithVendor(['promotional-banner', kebab, 'products']);
  }
}










