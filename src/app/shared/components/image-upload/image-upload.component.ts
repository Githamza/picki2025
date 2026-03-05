import { Component, inject, signal, forwardRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { SupabaseService } from '../../../services/supabase.service';

@Component({
  selector: 'app-image-upload',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ImageUploadComponent),
      multi: true,
    },
  ],
  template: `
    <div class="image-upload-container">
      <!-- Image Preview Section -->
      @if (imageUrl()) {
      <div class="image-preview-section">
        <div class="image-preview" (click)="openImageZoom()">
          <img [src]="imageUrl()" [alt]="placeholder" class="preview-image" />
          <div class="image-overlay">
            <mat-icon>zoom_in</mat-icon>
            <span>Cliquer pour agrandir</span>
          </div>
        </div>
        <div class="image-actions">
          <button
            mat-icon-button
            type="button"
            color="warn"
            (click)="removeImage()"
            [disabled]="uploading()"
            matTooltip="Supprimer l'image"
          >
            <mat-icon>delete</mat-icon>
          </button>
        </div>
      </div>
      }

      <!-- Upload Section -->
      <div class="upload-section">
        <mat-form-field appearance="fill" class="url-field">
          <mat-label>{{ label }}</mat-label>
          <input
            matInput
            [value]="imageUrl()"
            [placeholder]="placeholder"
            (input)="onUrlChange($event)"
            [disabled]="uploading()"
          />
          <button
            mat-icon-button
            type="button"
            matSuffix
            (click)="fileInput.click()"
            [disabled]="uploading()"
            matTooltip="Télécharger une image"
          >
            @if (uploading()) {
            <mat-spinner [diameter]="20"></mat-spinner>
            } @else {
            <mat-icon>cloud_upload</mat-icon>
            }
          </button>
        </mat-form-field>

        <input
          #fileInput
          type="file"
          accept="image/*"
          (change)="onFileSelected($event)"
          class="file-input"
        />

        @if (uploadProgress() > 0 && uploadProgress() < 100) {
        <div class="upload-progress">
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="uploadProgress()"></div>
          </div>
          <span class="progress-text">{{ uploadProgress() }}%</span>
        </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .image-upload-container {
        display: flex;
        gap: 16px;
        align-items: flex-start;
      }

      .image-preview-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: center;
      }

      .image-preview {
        position: relative;
        width: 120px;
        height: 120px;
        border: 2px solid var(--mat-sys-outline-variant);
        border-radius: 8px;
        overflow: hidden;
        cursor: pointer;
        transition: all 0.3s ease;
      }

      .image-preview:hover {
        border-color: var(--mat-sys-primary);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      }

      .preview-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .image-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
        color: white;
        font-size: 0.75rem;
        text-align: center;
        padding: 8px;
      }

      .image-preview:hover .image-overlay {
        opacity: 1;
      }

      .image-overlay mat-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
        margin-bottom: 4px;
      }

      .image-actions {
        display: flex;
        gap: 4px;
      }

      .upload-section {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .url-field {
        width: 100%;
      }

      .file-input {
        display: none;
      }

      .upload-progress {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .progress-bar {
        flex: 1;
        height: 4px;
        background: var(--mat-sys-surface-variant);
        border-radius: 2px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: var(--mat-sys-primary);
        transition: width 0.3s ease;
      }

      .progress-text {
        font-size: 0.75rem;
        color: var(--mat-sys-on-surface-variant);
        min-width: 35px;
      }

      @media (max-width: 768px) {
        .image-upload-container {
          flex-direction: column;
          align-items: stretch;
        }

        .image-preview-section {
          align-self: center;
        }
      }
    `,
  ],
})
export class ImageUploadComponent implements ControlValueAccessor {
  @Input() label = "URL de l'image";
  @Input() placeholder = 'https://...';
  @Input() bucket = 'productsophotos';
  @Input() folder?: string;

  private supabaseService = inject(SupabaseService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  imageUrl = signal<string>('');
  uploading = signal<boolean>(false);
  uploadProgress = signal<number>(0);

  private onChange = (value: string) => {};
  private onTouched = () => {};
  private disabled = false;

  writeValue(value: string): void {
    this.imageUrl.set(value || '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onUrlChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = target.value;
    this.imageUrl.set(value);
    this.onChange(value);
    this.onTouched();
  }

  async onFileSelected(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.snackBar.open(
        'Veuillez sélectionner un fichier image valide',
        'Fermer',
        {
          duration: 5000,
        }
      );
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      this.snackBar.open(
        'La taille du fichier ne doit pas dépasser 5MB',
        'Fermer',
        {
          duration: 5000,
        }
      );
      return;
    }

    try {
      this.uploading.set(true);
      this.uploadProgress.set(0);

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        const current = this.uploadProgress();
        if (current < 90) {
          this.uploadProgress.set(current + 10);
        }
      }, 100);

      // Delete old image if exists
      if (this.imageUrl()) {
        try {
          await this.supabaseService.deleteImage(this.imageUrl(), this.bucket);
        } catch (error) {
          console.warn('Failed to delete old image:', error);
        }
      }

      // Upload new image
      const imageUrl = await this.supabaseService.uploadImage(
        file,
        this.bucket,
        this.folder
      );

      clearInterval(progressInterval);
      this.uploadProgress.set(100);

      this.imageUrl.set(imageUrl);
      this.onChange(imageUrl);
      this.onTouched();

      this.snackBar.open('Image téléchargée avec succès', 'Fermer', {
        duration: 3000,
      });

      // Reset progress after a short delay
      setTimeout(() => {
        this.uploadProgress.set(0);
      }, 1000);
    } catch (error) {
      console.error('Upload error:', error);
      this.snackBar.open("Erreur lors du téléchargement de l'image", 'Fermer', {
        duration: 5000,
      });
    } finally {
      this.uploading.set(false);
      // Reset file input
      target.value = '';
    }
  }

  async removeImage(): Promise<void> {
    if (!this.imageUrl()) return;

    try {
      await this.supabaseService.deleteImage(this.imageUrl(), this.bucket);
      this.imageUrl.set('');
      this.onChange('');
      this.onTouched();

      this.snackBar.open('Image supprimée', 'Fermer', {
        duration: 2000,
      });
    } catch (error) {
      console.error('Delete error:', error);
      this.snackBar.open('Erreur lors de la suppression', 'Fermer', {
        duration: 5000,
      });
    }
  }

  openImageZoom(): void {
    if (!this.imageUrl()) return;

    import('./image-zoom-dialog.component').then(
      ({ ImageZoomDialogComponent }) => {
        this.dialog.open(ImageZoomDialogComponent, {
          data: { imageUrl: this.imageUrl() },
          maxWidth: '90vw',
          maxHeight: '90vh',
          panelClass: 'image-zoom-dialog',
        });
      }
    );
  }
}
