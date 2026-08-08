import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

/**
 * Kiosk cancel-order confirmation (SPEC.md FR4): an always-available
 * cancel that confirms before resetting the session.
 */
@Component({
  selector: 'app-cancel-order-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      <mat-icon aria-hidden="true">remove_shopping_cart</mat-icon>
      Annuler la commande ?
    </h2>
    <mat-dialog-content>
      Votre panier sera vidé et la commande recommencera depuis le début.
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close(false)">
        Continuer ma commande
      </button>
      <button mat-flat-button color="warn" (click)="dialogRef.close(true)">
        Tout annuler
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      h2 {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    `,
  ],
})
export class CancelOrderDialogComponent {
  constructor(readonly dialogRef: MatDialogRef<CancelOrderDialogComponent>) {}
}
