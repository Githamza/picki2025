import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ProductAdminService } from '../../../services/product-admin.service';
import {
  ProductAdmin,
  Category,
  ProductFormData,
} from '../../../models/product-admin.interface';
import { ImageUploadComponent } from '../../../shared/components';

export interface DialogData {
  product?: ProductAdmin;
  vendorId: string;
}

@Component({
  selector: 'app-product-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    ImageUploadComponent,
  ],
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>
        <mat-icon>{{ data.product ? 'edit' : 'add' }}</mat-icon>
        {{ data.product ? 'Modifier le produit' : 'Ajouter un produit' }}
      </h2>
      <button mat-icon-button mat-dialog-close>
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <div mat-dialog-content class="dialog-content">
      <form [formGroup]="productForm" class="product-form">
        <!-- Product Name -->
        <mat-form-field appearance="fill">
          <mat-label>Nom du produit</mat-label>
          <input
            matInput
            formControlName="name"
            placeholder="Ex: Pizza Margherita"
          />
          @if (productForm.get('name')?.hasError('required')) {
          <mat-error>Le nom est requis</mat-error>
          }
        </mat-form-field>

        <!-- Price -->
        <mat-form-field appearance="fill">
          <mat-label>Prix</mat-label>
          <input
            matInput
            type="number"
            formControlName="price"
            placeholder="0.00"
            step="0.01"
            min="0"
          />
          <span matTextPrefix>€&nbsp;</span>
          @if (productForm.get('price')?.hasError('required')) {
          <mat-error>Le prix est requis</mat-error>
          } @if (productForm.get('price')?.hasError('min')) {
          <mat-error>Le prix doit être positif</mat-error>
          }
        </mat-form-field>

        <!-- Category -->
        <mat-form-field appearance="fill">
          <mat-label>Catégorie</mat-label>
          <mat-select formControlName="category_id">
            @for (category of categories; track category.id) {
            <mat-option [value]="category.id">{{ category.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <!-- Display Order -->
        <mat-form-field appearance="fill">
          <mat-label>Ordre d'affichage</mat-label>
          <input
            matInput
            type="number"
            formControlName="display_order"
            placeholder="0"
            min="0"
            step="10"
          />
          <mat-hint>Ordre d'affichage dans la catégorie (0 = premier)</mat-hint>
        </mat-form-field>

        <!-- Image URL -->
        <app-image-upload
          formControlName="image_url"
          label="URL de l'image"
          placeholder="https://..."
        ></app-image-upload>

        <!-- Short Description -->
        <mat-form-field appearance="fill">
          <mat-label>Description courte</mat-label>
          <input
            matInput
            formControlName="short_description"
            placeholder="Description courte"
          />
        </mat-form-field>

        <!-- Long Description -->
        <mat-form-field appearance="fill">
          <mat-label>Description détaillée</mat-label>
          <textarea
            matInput
            formControlName="long_description"
            rows="3"
            placeholder="Description détaillée"
          ></textarea>
        </mat-form-field>

        <!-- Stock Quantity -->
        <mat-form-field appearance="fill">
          <mat-label>Quantité en stock (optionnel)</mat-label>
          <input
            matInput
            type="number"
            formControlName="stock_quantity"
            placeholder="Illimité si vide"
            min="0"
          />
        </mat-form-field>

        <!-- Toggles -->
        <div class="toggle-section">
          <mat-slide-toggle formControlName="is_available">
            Produit disponible
          </mat-slide-toggle>

          <mat-slide-toggle formControlName="no_catalogable">
            Exclure du catalogue
          </mat-slide-toggle>

          <mat-slide-toggle formControlName="is_multi_step">
            Menu multi-étapes
          </mat-slide-toggle>
        </div>

        @if (productForm.get('no_catalogable')?.value) {
        <div class="catalog-notice">
          <mat-icon>info</mat-icon>
          <span
            >Ce produit sera masqué du catalogue public mais restera accessible
            pour les commandes directes.</span
          >
        </div>
        } @if (productForm.get('is_multi_step')?.value) {
        <div class="multi-step-notice">
          <mat-icon>info</mat-icon>
          <span
            >Vous pourrez configurer les étapes du menu après la création du
            produit.</span
          >
        </div>
        }
      </form>
    </div>

    <div mat-dialog-actions class="dialog-actions">
      <button mat-button mat-dialog-close>Annuler</button>
      <button
        mat-raised-button
        color="primary"
        (click)="saveProduct()"
        [disabled]="productForm.invalid || saving"
      >
        @if (saving) {
        <mat-icon>hourglass_empty</mat-icon>
        } @else {
        <mat-icon>{{ data.product ? 'save' : 'add' }}</mat-icon>
        }
        {{ data.product ? 'Modifier' : 'Créer' }}
      </button>
    </div>
  `,
  styles: [
    `
      .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }

      .dialog-header h2 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 1.25rem;
        font-weight: 500;
      }

      .dialog-content {
        min-width: 500px;
        max-height: 70vh;
        overflow-y: auto;
      }

      .product-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .toggle-section {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        background: var(--mat-sys-surface-variant);
        border-radius: 8px;
      }

      .catalog-notice {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background: var(--mat-sys-secondary-container);
        color: var(--mat-sys-on-secondary-container);
        border-radius: 8px;
        font-size: 0.875rem;
      }

      .multi-step-notice {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
        border-radius: 8px;
        font-size: 0.875rem;
      }

      .dialog-actions {
        margin-top: 24px;
        gap: 8px;
      }

      @media (max-width: 600px) {
        .dialog-content {
          min-width: unset;
          width: 100%;
        }
      }
    `,
  ],
})
export class ProductEditDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private productAdminService = inject(ProductAdminService);
  private snackBar = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<ProductEditDialogComponent>);

  productForm: FormGroup;
  categories: Category[] = [];
  saving = false;

  constructor(@Inject(MAT_DIALOG_DATA) public data: DialogData) {
    this.productForm = this.createForm();
  }

  ngOnInit() {
    this.loadCategories();
    if (this.data.product) {
      this.populateForm(this.data.product);
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required]],
      price: [0, [Validators.required, Validators.min(0)]],
      category_id: [null],
      display_order: [0, [Validators.min(0)]],
      image_url: [''],
      short_description: [''],
      long_description: [''],
      stock_quantity: [null],
      is_available: [true],
      is_multi_step: [false],
      no_catalogable: [false],
    });
  }

  private loadCategories() {
    this.productAdminService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        this.snackBar.open(
          'Erreur lors du chargement des catégories',
          'Fermer',
          {
            duration: 3000,
          }
        );
      },
    });
  }

  private populateForm(product: ProductAdmin) {
    this.productForm.patchValue({
      name: product.name,
      price: product.price,
      category_id: product.category_id,
      display_order: product.display_order ?? 0,
      image_url: product.image_url,
      short_description: product.short_description,
      long_description: product.long_description,
      stock_quantity: product.stock_quantity,
      is_available: product.is_available ?? true,
      is_multi_step: product.is_multi_step ?? false,
      no_catalogable: product.no_catalogable ?? false,
    });
  }

  saveProduct() {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    const formData: ProductFormData = this.productForm.value;

    const operation = this.data.product
      ? this.productAdminService.updateProduct(this.data.product.id, formData)
      : this.productAdminService.createProduct(this.data.vendorId, formData);

    operation.subscribe({
      next: (product) => {
        this.dialogRef.close(product);
      },
      error: (error) => {
        console.error('Error saving product:', error);
        this.snackBar.open('Erreur lors de la sauvegarde', 'Fermer', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
        this.saving = false;
      },
    });
  }
}
