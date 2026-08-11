import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

/**
 * Kiosk idle countdown (SPEC.md FR4): "Toujours là ?" with a visible
 * countdown. Closes with `true` when the customer continues; auto-closes
 * with `false` on expiry (the host resets the session).
 */
@Component({
  selector: 'app-idle-warning-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      <mat-icon aria-hidden="true">hourglass_bottom</mat-icon>
      Toujours là ?
    </h2>
    <mat-dialog-content>
      <p>
        Sans action de votre part, la commande sera annulée dans
        <strong>{{ remaining() }}</strong> seconde{{
          remaining() > 1 ? 's' : ''
        }}.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" (click)="dialogRef.close(true)">
        <mat-icon>touch_app</mat-icon>
        Je continue ma commande
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
export class IdleWarningDialogComponent implements OnInit, OnDestroy {
  readonly dialogRef = inject(MatDialogRef<IdleWarningDialogComponent>);
  private readonly data: { countdownMs: number } = inject(MAT_DIALOG_DATA, {
    optional: true,
  }) ?? { countdownMs: 20_000 };

  readonly remaining = signal(Math.ceil(this.data.countdownMs / 1000));
  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.timer = setInterval(() => {
      const next = this.remaining() - 1;
      this.remaining.set(next);
      if (next <= 0) {
        this.dialogRef.close(false);
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}
