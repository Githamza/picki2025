import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ScrollingModule } from '@angular/cdk/scrolling';

import { AppState, Category } from '../../store/models/app.state';
import * as CategoryActions from '../../store/actions/category.actions';
import * as CategorySelectors from '../../store/selectors/category.selectors';
import { VendorNavigationService } from '../../services/vendor-navigation.service';
import { VendorService } from '../../services/vendor.service';

@Component({
  selector: 'app-horizontal-category-menu',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ScrollingModule,
  ],
  template: `
    <div class="horizontal-category-menu">
      <div *ngIf="loading$ | async" class="loader-container">
        <mat-spinner diameter="24"></mat-spinner>
      </div>

      <div *ngIf="error$ | async as error" class="error-message">
        {{ error }}
      </div>

      <div class="chips-container" *ngIf="categories$ | async as categories">
        <mat-chip-option
          *ngFor="let category of categories"
          (click)="selectCategory(category)"
          [selected]="(selectedCategoryId$ | async) === category.id"
          [aria-label]="'Select ' + category.name + ' category'"
        >
          <img
            *ngIf="category.imageUrl; else iconTemplate"
            matChipAvatar
            [src]="category.imageUrl"
            alt="Category image"
            [title]="category.name + ' category'"
            class="category-chip-image"
          />
          <ng-template #iconTemplate>
            <mat-icon *ngIf="category.icon" matChipAvatar>{{
              category.icon
            }}</mat-icon>
          </ng-template>
          {{ category.name }}
        </mat-chip-option>
      </div>
    </div>
  `,
  styles: [
    `
      .horizontal-category-menu {
        width: 100%;
        overflow-x: auto;
        padding: 8px 0;

        /* Hide scrollbar but allow scrolling */
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none; /* IE and Edge */
        &::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }
      }

      .chips-container {
        display: flex;
        flex-wrap: nowrap;
        gap: 8px;
        padding: 0 16px;
        min-width: min-content;
      }

      .loader-container {
        display: flex;
        justify-content: center;
        padding: 8px 0;
      }

      .error-message {
        color: var(--mat-warn);
        padding: 4px 16px;
        white-space: nowrap;
        font-size: 0.875rem;
      }

      mat-chip-option {
        height: 32px;
      }

      .category-chip-image {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        object-fit: cover;
      }
    `,
  ],
})
export class HorizontalCategoryMenuComponent implements OnInit {
  categories$: Observable<Category[]>;
  selectedCategoryId$: Observable<number | null>;
  loading$: Observable<boolean>;
  error$: Observable<string | null>;

  private vendorNavigation = inject(VendorNavigationService);
  private vendorService = inject(VendorService);

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
    // Get current vendor and load vendor-specific categories
    const currentVendor = this.vendorService.getCurrentVendor();
    if (currentVendor) {
      this.store.dispatch(
        CategoryActions.loadCategoriesByVendor({ vendorId: currentVendor.id })
      );
    } else {
      // If no vendor is selected, you might want to wait or show a message
      // For now, we'll dispatch without vendor ID which will load all categories
      this.store.dispatch(
        CategoryActions.loadCategories({ vendorId: undefined })
      );
    }
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
    this.vendorNavigation.navigateWithVendor([kebab, 'products']);
  }
}
