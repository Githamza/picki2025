import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ImageZoomDialogData {
  imageUrl: string;
  imageName: string;
}

@Component({
  selector: 'app-image-zoom-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <div class="image-zoom-dialog">
      <div class="dialog-header">
        <h2 mat-dialog-title>{{ data.imageName }}</h2>
        <button
          mat-icon-button
          [mat-dialog-close]="true"
          class="close-button"
          aria-label="Fermer"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>
      
      <div mat-dialog-content class="image-container">
        <img 
          [src]="data.imageUrl" 
          [alt]="data.imageName"
          class="zoom-image"
          [style.transform]="'scale(' + scale + ')'"
        />
      </div>
      
      <div mat-dialog-actions class="zoom-controls">
        <button
          mat-mini-fab
          (click)="zoomOut()"
          [disabled]="scale <= 1"
          aria-label="Zoom out"
        >
          <mat-icon>remove</mat-icon>
        </button>
        
        <span class="zoom-level">{{ Math.round(scale * 100) }}%</span>
        
        <button
          mat-mini-fab
          (click)="zoomIn()"
          [disabled]="scale >= 3"
          aria-label="Zoom in"
        >
          <mat-icon>add</mat-icon>
        </button>
        
        <button
          mat-mini-fab
          (click)="resetZoom()"
          [disabled]="scale === 1"
          aria-label="Reset zoom"
        >
          <mat-icon>refresh</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .image-zoom-dialog {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }

    h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 500;
    }

    .close-button {
      margin-left: auto;
    }

    .image-container {
      flex: 1;
      overflow: auto;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 24px;
      background-color: var(--mat-sys-surface-variant);
      min-height: 400px;
      max-height: calc(90vh - 180px);
    }

    .zoom-image {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      transition: transform 0.2s ease-in-out;
      cursor: grab;
    }

    .zoom-image:active {
      cursor: grabbing;
    }

    .zoom-controls {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;
      padding: 16px 24px;
      border-top: 1px solid var(--mat-sys-outline-variant);
    }

    .zoom-level {
      min-width: 60px;
      text-align: center;
      font-weight: 500;
      font-size: 1rem;
    }

    @media (max-width: 768px) {
      .image-container {
        min-height: 300px;
        padding: 16px;
      }
      
      h2 {
        font-size: 1rem;
      }
    }
  `],
})
export class ImageZoomDialogComponent {
  data = inject<ImageZoomDialogData>(MAT_DIALOG_DATA);
  dialogRef = inject(MatDialogRef<ImageZoomDialogComponent>);
  
  scale = 1;
  Math = Math;

  zoomIn(): void {
    if (this.scale < 3) {
      this.scale += 0.25;
    }
  }

  zoomOut(): void {
    if (this.scale > 1) {
      this.scale -= 0.25;
    }
  }

  resetZoom(): void {
    this.scale = 1;
  }
}

