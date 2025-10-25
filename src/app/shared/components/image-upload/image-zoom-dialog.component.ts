import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

interface DialogData {
  imageUrl: string;
}

@Component({
  selector: 'app-image-zoom-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="zoom-dialog-container">
      <div class="zoom-header">
        <h2 mat-dialog-title>Aperçu de l'image</h2>
        <button mat-icon-button mat-dialog-close class="close-button">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div mat-dialog-content class="zoom-content">
        <div class="image-container" (wheel)="onWheel($event)">
          <img
            [src]="data.imageUrl"
            alt="Image preview"
            class="zoom-image"
            [style.transform]="'scale(' + zoomLevel + ')'"
            (click)="resetZoom()"
          />
        </div>
      </div>

      <div mat-dialog-actions class="zoom-actions">
        <button mat-button (click)="zoomOut()" [disabled]="zoomLevel <= 0.5">
          <mat-icon>zoom_out</mat-icon>
          Dézoomer
        </button>
        <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
        <button mat-button (click)="zoomIn()" [disabled]="zoomLevel >= 3">
          <mat-icon>zoom_in</mat-icon>
          Zoomer
        </button>
        <button mat-button (click)="resetZoom()">
          <mat-icon>center_focus_strong</mat-icon>
          Réinitialiser
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .zoom-dialog-container {
        width: 90vw;
        height: 90vh;
        max-width: 1200px;
        max-height: 800px;
        display: flex;
        flex-direction: column;
      }

      .zoom-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 24px 0;
      }

      .zoom-header h2 {
        margin: 0;
        flex: 1;
      }

      .close-button {
        margin-left: 16px;
      }

      .zoom-content {
        flex: 1;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: var(--mat-sys-surface-dim);
      }

      .image-container {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: auto;
        cursor: zoom-in;
      }

      .zoom-image {
        max-width: 100%;
        max-height: 100%;
        transition: transform 0.3s ease;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }

      .zoom-actions {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 16px;
        padding: 16px 24px;
        border-top: 1px solid var(--mat-sys-outline-variant);
      }

      .zoom-level {
        font-weight: 500;
        color: var(--mat-sys-on-surface);
        min-width: 50px;
        text-align: center;
      }

      @media (max-width: 768px) {
        .zoom-dialog-container {
          width: 100vw;
          height: 100vh;
          max-width: none;
          max-height: none;
        }

        .zoom-actions {
          flex-wrap: wrap;
          gap: 8px;
        }
      }
    `,
  ],
})
export class ImageZoomDialogComponent {
  zoomLevel = 1;
  Math = Math;

  constructor(
    public dialogRef: MatDialogRef<ImageZoomDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {}

  zoomIn(): void {
    if (this.zoomLevel < 3) {
      this.zoomLevel = Math.min(3, this.zoomLevel + 0.25);
    }
  }

  zoomOut(): void {
    if (this.zoomLevel > 0.5) {
      this.zoomLevel = Math.max(0.5, this.zoomLevel - 0.25);
    }
  }

  resetZoom(): void {
    this.zoomLevel = 1;
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();

    if (event.deltaY < 0) {
      this.zoomIn();
    } else {
      this.zoomOut();
    }
  }
}
