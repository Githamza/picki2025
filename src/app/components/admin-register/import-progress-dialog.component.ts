import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';

const IMPORT_MESSAGES = [
  'Création de votre boutique en cours…',
  'Nous importons vos produits…',
  "Si certaines images ne sont pas chargées, vous pouvez les importer manuellement depuis le panel d’administration.",
  'Ne payez plus de commissions à chaque vente avec Piki.',
] as const;

@Component({
  selector: 'app-import-progress-dialog',
  imports: [CommonModule, MatDialogModule, MatProgressBarModule, MatProgressSpinnerModule],
  template: `
    <h2 mat-dialog-title>Importation de vos produits</h2>

    <mat-dialog-content class="content">
      <div class="header">
        @if (totalCategories() > 0) {
          <div class="step">Étape {{ formattedCategories() }}/{{ totalCategories() }}</div>
        } @else {
          <div class="step">Préparation de l’import…</div>
        }
        <mat-spinner diameter="18"></mat-spinner>
      </div>

      <mat-progress-bar
        [mode]="totalCategories() > 0 ? 'determinate' : 'indeterminate'"
        [value]="progressValue()"
      ></mat-progress-bar>

      <p class="message">{{ message() }}</p>
    </mat-dialog-content>
  `,
  styles: [
    `
      .content {
        display: grid;
        gap: 12px;
        min-width: min(520px, 90vw);
      }

      :host ::ng-deep .mat-mdc-dialog-title {
        font-size: 22px;
        font-weight: 800;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .step {
        font-weight: 700;
        font-size: 18px;
      }

      .message {
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
        line-height: 1.4;
        font-size: 16px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportProgressDialogComponent {
  readonly currentIndex = signal(0);
  readonly categoryProgress = signal<{ formatted: number; total: number } | null>(null);

  readonly message = computed(() => IMPORT_MESSAGES[this.currentIndex()] ?? '');
  readonly formattedCategories = computed(() => this.categoryProgress()?.formatted ?? 0);
  readonly totalCategories = computed(() => this.categoryProgress()?.total ?? 0);
  readonly progressValue = computed(() => {
    const total = this.totalCategories();
    if (!total) return 0;
    return Math.round((this.formattedCategories() / total) * 100);
  });

  constructor() {
    interval(5000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.currentIndex.update((i) => (i + 1) % IMPORT_MESSAGES.length);
      });
  }

  setCategoryProgress(formattedCategories: number, totalCategories: number): void {
    this.categoryProgress.set({
      formatted: Math.max(0, formattedCategories),
      total: Math.max(0, totalCategories),
    });
  }
}


