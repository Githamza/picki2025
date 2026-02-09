import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface RestaurantClosedDialogData {
  closedMessage?: string;
  closedDescription?: string;
}

@Component({
  selector: 'app-restaurant-closed-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="restaurant-closed-dialog">
      <div class="dialog-header">
        <mat-icon class="closed-icon">restaurant_menu</mat-icon>
        <h2 mat-dialog-title>{{ closedMessage }}</h2>
      </div>

      <div mat-dialog-content class="dialog-content">
        <p class="description">{{ closedDescription }}</p>
        <div class="illustration">
          <mat-icon class="clock-icon">schedule</mat-icon>
        </div>
      </div>

      <div mat-dialog-actions class="dialog-actions">
        <button
          mat-raised-button
          color="primary"
          (click)="closeDialog()"
          class="close-button"
        >
          <mat-icon>close</mat-icon>
          Fermer
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .restaurant-closed-dialog {
        padding: 24px;
        text-align: center;
        max-width: 400px;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin: 0 auto;
      }

      .dialog-header {
        margin-bottom: 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        width: 100%;

        .closed-icon {
          font-size: 48px;
          width: 48px;
          height: 48px;
          color: #f44336;
          opacity: 0.8;
        }

        h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          color: var(--mat-sys-on-surface);
          line-height: 1.3;
          text-align: center;
        }
      }

      .dialog-content {
        margin-bottom: 32px;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;

        .description {
          font-size: 16px;
          color: var(--mat-sys-on-surface-variant);
          line-height: 1.5;
          margin: 0 0 24px 0;
          text-align: center;
        }

        .illustration {
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 16px 0;

          .clock-icon {
            font-size: 64px;
            width: 64px;
            height: 64px;
            color: var(--mat-sys-outline);
            opacity: 0.6;
          }
        }
      }

      .dialog-actions {
        display: flex;
        justify-content: center;
        margin: 0;
        width: 100%;

        .close-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          font-weight: 500;
          border-radius: 8px;
          transition: all 0.3s ease;

          &:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          }
        }
      }

      // Responsive design
      @media (max-width: 480px) {
        .restaurant-closed-dialog {
          padding: 20px;
        }

        .dialog-header {
          .closed-icon {
            font-size: 40px;
            width: 40px;
            height: 40px;
          }

          h2 {
            font-size: 20px;
          }
        }

        .dialog-content {
          .description {
            font-size: 14px;
          }

          .illustration .clock-icon {
            font-size: 48px;
            width: 48px;
            height: 48px;
          }
        }
      }

      // Animation classes
      .restaurant-closed-dialog {
        animation: fadeInScale 0.3s ease-out;
      }

      @keyframes fadeInScale {
        from {
          opacity: 0;
          transform: scale(0.9);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      // Dark mode support
      @media (prefers-color-scheme: dark) {
        .dialog-header .closed-icon {
          color: #ff5252;
        }
      }

      // High contrast support
      @media (prefers-contrast: high) {
        .dialog-header .closed-icon {
          color: #d32f2f;
        }

        .dialog-content .illustration .clock-icon {
          opacity: 0.8;
        }
      }
    `,
  ],
})
export class RestaurantClosedDialogComponent {
  closedMessage: string;
  closedDescription: string;

  constructor(
    public dialogRef: MatDialogRef<RestaurantClosedDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RestaurantClosedDialogData | null
  ) {
    this.closedMessage = data?.closedMessage || 'On est fermé actuellement';
    this.closedDescription = data?.closedDescription || 'N\'hésitez pas à revenir plus tard.';
  }

  closeDialog(): void {
    this.dialogRef.close();
  }
}
