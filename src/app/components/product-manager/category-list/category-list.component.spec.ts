import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CategoryEditDialogComponent } from './category-list.component';
import { ProductAdminService } from '../../../services/product-admin.service';
import { CATEGORY_TYPES } from '../../../models/category-type.model';

describe('CategoryEditDialogComponent (category_type)', () => {
  function createDialog(data: Record<string, unknown>): CategoryEditDialogComponent {
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: () => {} } },
        {
          provide: ProductAdminService,
          useValue: jasmine.createSpyObj('ProductAdminService', [
            'createCategory',
            'updateCategory',
          ]),
        },
        { provide: MatSnackBar, useValue: { open: () => {} } },
      ],
    });
    const component = TestBed.runInInjectionContext(
      () => new CategoryEditDialogComponent()
    );
    component.ngOnInit();
    return component;
  }

  it('exposes the 7 fixed category types with French labels', () => {
    expect(CATEGORY_TYPES.length).toBe(7);
    expect(CATEGORY_TYPES.map((t) => t.value)).toEqual([
      'entree',
      'plat',
      'boisson',
      'dessert',
      'sauce',
      'accompagnement',
      'autre',
    ]);
    expect(CATEGORY_TYPES.find((t) => t.value === 'entree')?.label).toBe('Entrée');
    expect(CATEGORY_TYPES.find((t) => t.value === 'boisson')?.label).toBe('Boisson');
  });

  it('requires category_type on create', () => {
    const dialog = createDialog({ vendorId: 'v1' });
    dialog.categoryForm.patchValue({ name: 'Boissons' });
    expect(dialog.categoryForm.get('category_type')?.hasError('required')).toBeTrue();
    expect(dialog.categoryForm.valid).toBeFalse();
  });

  it('is valid once name and category_type are set', () => {
    const dialog = createDialog({ vendorId: 'v1' });
    dialog.categoryForm.patchValue({ name: 'Boissons', category_type: 'boisson' });
    expect(dialog.categoryForm.valid).toBeTrue();
  });

  it('editing an untyped category prompts for a type (form invalid until set)', () => {
    const dialog = createDialog({
      vendorId: 'v1',
      category: { id: 1, name: 'Desserts', category_type: null },
    });
    expect(dialog.categoryForm.valid).toBeFalse();
    dialog.categoryForm.patchValue({ category_type: 'dessert' });
    expect(dialog.categoryForm.valid).toBeTrue();
  });

  it('preserves an existing type when editing a typed category', () => {
    const dialog = createDialog({
      vendorId: 'v1',
      category: { id: 2, name: 'Boissons', category_type: 'boisson' },
    });
    expect(dialog.categoryForm.get('category_type')?.value).toBe('boisson');
    expect(dialog.categoryForm.valid).toBeTrue();
  });
});
