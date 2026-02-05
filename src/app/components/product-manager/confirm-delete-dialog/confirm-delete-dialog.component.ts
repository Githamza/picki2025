import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogRef,
  MatDialogModule,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDeleteDialogData {
  title: string;
  message: string;
  itemCount: number;
  itemNames?: string[];
}

@Component({
  selector: 'app-confirm-delete-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <div class="confirm-delete-dialog">
      <div class="dialog-header">
        <div class="icon-container">
          <mat-icon>delete_forever</mat-icon>
        </div>
        <h2 mat-dialog-title>{{ data.title }}</h2>
      </div>

      <mat-dialog-content>
        <p class="message">{{ data.message }}</p>

        @if (data.itemNames && data.itemNames.length > 0) {
          <div class="items-list">
            <p class="list-label">Produits sélectionnés ({{ data.itemCount }}) :</p>
            <ul>
              @for (name of displayedItems; track name) {
                <li>{{ name }}</li>
              }
              @if (data.itemNames.length > maxDisplayItems) {
                <li class="more-items">
                  ... et {{ data.itemNames.length - maxDisplayItems }} autre(s)
                </li>
              }
            </ul>
          </div>
        }

        <div class="warning-box">
          <mat-icon>warning</mat-icon>
          <span>Cette action est irréversible</span>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions>
        <button mat-button (click)="onCancel()">
          Annuler
        </button>
        <button mat-flat-button color="warn" (click)="onConfirm()">
          <mat-icon>delete</mat-icon>
          Supprimer
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .confirm-delete-dialog {
      max-width: 400px;
    }

    .dialog-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 24px 0;
      text-align: center;
    }

    .icon-container {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--mat-sys-error-container);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;

      mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: var(--mat-sys-on-error-container);
      }
    }

    h2[mat-dialog-title] {
      margin: 0;
      font: var(--mat-sys-headline-small);
      color: var(--mat-sys-on-surface);
    }

    mat-dialog-content {
      padding: 16px 24px;
    }

    .message {
      margin: 0 0 16px;
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
      text-align: center;
    }

    .items-list {
      background: var(--mat-sys-surface-container-high);
      border-radius: var(--mat-sys-corner-medium);
      padding: 12px 16px;
      margin-bottom: 16px;
      max-height: 150px;
      overflow-y: auto;

      .list-label {
        margin: 0 0 8px;
        font: var(--mat-sys-label-medium);
        color: var(--mat-sys-on-surface-variant);
      }

      ul {
        margin: 0;
        padding-left: 20px;

        li {
          font: var(--mat-sys-body-small);
          color: var(--mat-sys-on-surface);
          padding: 2px 0;
        }

        .more-items {
          color: var(--mat-sys-on-surface-variant);
          font-style: italic;
        }
      }
    }

    .warning-box {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px;
      background: var(--mat-sys-error-container);
      border-radius: var(--mat-sys-corner-small);
      color: var(--mat-sys-on-error-container);
      font: var(--mat-sys-label-medium);

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    mat-dialog-actions {
      padding: 16px 24px 24px;
      display: flex;
      justify-content: flex-end;
      gap: 8px;

      button mat-icon {
        margin-right: 4px;
      }
    }

    @media (max-width: 600px) {
      .confirm-delete-dialog {
        max-width: 100%;
      }

      mat-dialog-actions {
        flex-direction: column;

        button {
          width: 100%;
        }
      }
    }
  `],
})
export class ConfirmDeleteDialogComponent {
  dialogRef = inject(MatDialogRef<ConfirmDeleteDialogComponent>);
  data = inject<ConfirmDeleteDialogData>(MAT_DIALOG_DATA);

  readonly maxDisplayItems = 5;

  get displayedItems(): string[] {
    return this.data.itemNames?.slice(0, this.maxDisplayItems) || [];
  }

  onCancel() {
    this.dialogRef.close(false);
  }

  onConfirm() {
    this.dialogRef.close(true);
  }
}
