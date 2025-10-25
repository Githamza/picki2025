import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProductService } from '../../services/product.service';
import {
  ProductComplement,
  DatabaseProductComplementInsert,
} from '../../models/complement.model';
import { Product } from '../../services/product.service';
import { VendorService } from '../../services/vendor.service';

@Component({
  selector: 'app-product-complements-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './product-complements-admin.component.html',
  styleUrls: ['./product-complements-admin.component.scss'],
})
export class ProductComplementsAdminComponent implements OnInit {
  private productService = inject(ProductService);
  private vendorService = inject(VendorService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  products = signal<Product[]>([]);
  complements = signal<ProductComplement[]>([]);
  selectedProduct = signal<Product | null>(null);
  isLoading = signal(false);

  complementForm: FormGroup;
  editingComplement = signal<ProductComplement | null>(null);
  showForm = signal(false);

  displayedColumns: string[] = [
    'complementName',
    'selectionType',
    'isRequired',
    'customPrice',
    'isFree',
    'displayOrder',
    'actions',
  ];

  constructor() {
    this.complementForm = this.fb.group({
      complement_product_id: ['', [Validators.required]],
      is_required: [false],
      selection_type: ['single', [Validators.required]],
      max_selections: [1, [Validators.min(1)]],
      display_order: [0, [Validators.min(0)]],
      custom_price: [null, [Validators.min(0)]],
      is_free: [false],
    });
  }

  ngOnInit(): void {
    this.loadProducts();
  }

  private loadProducts(): void {
    this.isLoading.set(true);
    const currentVendor = this.vendorService.getCurrentVendor();

    this.productService.getAllProducts(currentVendor?.id).subscribe({
      next: (products) => {
        this.products.set(products);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading products:', error);
        this.showError('Failed to load products');
        this.isLoading.set(false);
      },
    });
  }

  selectProduct(product: Product): void {
    this.selectedProduct.set(product);
    this.loadComplements(product.id);
    this.showForm.set(false);
    this.editingComplement.set(null);
  }

  private loadComplements(productId: number): void {
    this.isLoading.set(true);
    this.productService.getProductComplements(productId).subscribe({
      next: (complements) => {
        this.complements.set(complements);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading complements:', error);
        this.showError('Failed to load complements');
        this.isLoading.set(false);
      },
    });
  }

  showAddForm(): void {
    this.editingComplement.set(null);
    this.complementForm.reset({
      complement_product_id: '',
      is_required: false,
      selection_type: 'single',
      max_selections: 1,
      display_order: 0,
      custom_price: null,
      is_free: false,
    });
    this.showForm.set(true);
  }

  editComplement(complement: ProductComplement): void {
    this.editingComplement.set(complement);
    this.complementForm.patchValue({
      complement_product_id: complement.complement_product_id,
      is_required: complement.is_required,
      selection_type: complement.selection_type,
      max_selections: complement.max_selections,
      display_order: complement.display_order,
      custom_price: complement.custom_price,
      is_free: complement.is_free,
    });
    this.showForm.set(true);
  }

  saveComplement(): void {
    if (this.complementForm.invalid || !this.selectedProduct()) {
      return;
    }

    const formValue = this.complementForm.value;
    const editing = this.editingComplement();

    if (editing) {
      // Update existing complement
      this.productService
        .updateProductComplement(editing.id, formValue)
        .subscribe({
          next: () => {
            this.showSuccess('Complement updated successfully');
            this.loadComplements(this.selectedProduct()!.id);
            this.cancelForm();
          },
          error: (error) => {
            console.error('Error updating complement:', error);
            this.showError('Failed to update complement');
          },
        });
    } else {
      // Create new complement
      const complementData: DatabaseProductComplementInsert = {
        product_id: this.selectedProduct()!.id,
        complement_product_id: formValue.complement_product_id,
        is_required: formValue.is_required,
        selection_type: formValue.selection_type,
        max_selections: formValue.max_selections,
        display_order: formValue.display_order,
        custom_price: formValue.custom_price,
        is_free: formValue.is_free,
      };

      this.productService.createProductComplement(complementData).subscribe({
        next: () => {
          this.showSuccess('Complement created successfully');
          this.loadComplements(this.selectedProduct()!.id);
          this.cancelForm();
        },
        error: (error) => {
          console.error('Error creating complement:', error);
          this.showError('Failed to create complement');
        },
      });
    }
  }

  deleteComplement(complement: ProductComplement): void {
    if (confirm('Are you sure you want to delete this complement?')) {
      this.productService.deleteProductComplement(complement.id).subscribe({
        next: () => {
          this.showSuccess('Complement deleted successfully');
          this.loadComplements(this.selectedProduct()!.id);
        },
        error: (error) => {
          console.error('Error deleting complement:', error);
          this.showError('Failed to delete complement');
        },
      });
    }
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingComplement.set(null);
  }

  getAvailableProducts(): Product[] {
    const selectedProduct = this.selectedProduct();
    if (!selectedProduct) return [];

    // Filter out the main product and already selected complements
    const existingComplementIds = this.complements().map(
      (c) => c.complement_product_id
    );

    return this.products().filter(
      (p) =>
        p.id !== selectedProduct.id && !existingComplementIds.includes(p.id)
    );
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['success-snackbar'],
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['error-snackbar'],
    });
  }
}
