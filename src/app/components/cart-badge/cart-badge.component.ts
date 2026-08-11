import { Component, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { Observable, map, startWith } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { selectCartTotalCount } from '../../store/selectors/cart.selectors';
import { AppState } from '../../store/models/app.state';
import { CartDetailsSheetComponent } from '../cart-details-sheet/cart-details-sheet.component';
import { Router } from '@angular/router';
import { CartCelebrationService } from '../../services/cart-celebration.service';

/** One column of the odometer: rolls from `prev` to `curr`. */
interface OdometerCell {
  prev: string;
  curr: string;
  roll: boolean;
  dir: 'up' | 'down';
}

/** Drum roll duration — keep in sync with $roll-ms in the SCSS. */
const ROLL_MS = 480;

@Component({
  selector: 'app-cart-badge',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './cart-badge.component.html',
  styleUrls: ['./cart-badge.component.scss'],
})
export class CartBadgeComponent {
  private store = inject(Store<AppState>);
  private bottomSheet = inject(MatBottomSheet);
  private router = inject(Router);
  private celebration = inject(CartCelebrationService);

  readonly count = toSignal(this.store.select(selectCartTotalCount), {
    initialValue: 0,
  });
  showBadge$: Observable<boolean>;

  /** Odometer columns currently rendered inside "Voir mon panier (…)". */
  readonly cells = signal<OdometerCell[]>([]);
  /** Squash-and-stretch hop, played when the count goes up. */
  readonly bounce = signal(false);

  private rollTimer: ReturnType<typeof setTimeout> | null = null;
  private bounceTimer: ReturnType<typeof setTimeout> | null = null;
  /** Invalidates a pending page-settle wait when a newer roll supersedes it. */
  private rollSeq = 0;

  constructor() {
    // Observable that emits true if not on add product page
    this.showBadge$ = this.router.events.pipe(
      startWith(null),
      map(() => {
        const url = this.router.url;
        // Matches /product/:productName or /:category/product/:productName
        const addProductRegex = /^\/(?:[\w-]+\/)?product\//;
        return !addProductRegex.test(url);
      })
    );

    // The badge is destroyed on product pages (main-layout hides it), so
    // "which number was last shown" lives in CartCelebrationService: on
    // remount after an add, the odometer rolls old -> new instead of
    // popping in with the new count already applied.
    effect(() => {
      const target = this.count();
      untracked(() => this.syncOdometer(target));
    });
  }

  private syncOdometer(target: number): void {
    const shown = this.celebration.lastShownCount;
    if (target === 0) {
      // Button is hidden at zero — nothing to animate, just resync.
      this.celebration.lastShownCount = 0;
      this.setStatic(0);
      return;
    }
    if (target === shown) {
      this.setStatic(target);
      return;
    }
    this.playRoll(shown, target);
  }

  private playRoll(from: number, to: number): void {
    if (this.rollTimer) clearTimeout(this.rollTimer);
    if (this.bounceTimer) clearTimeout(this.bounceTimer);
    this.celebration.lastShownCount = to;
    this.bounce.set(false);
    const seq = ++this.rollSeq;

    // Until the roll starts, the badge honestly shows the previous count.
    this.cells.set(this.rollCells(from, from));

    // The page transition captures the badge in its snapshot, so a roll
    // started during it plays behind the overlay. Wait for the page to
    // settle (resolves immediately when no transition is in flight).
    this.celebration.whenPageSettled().then(() => {
      if (seq !== this.rollSeq) return;

      this.cells.set(this.rollCells(from, to));
      this.rollTimer = setTimeout(() => this.setStatic(to), ROLL_MS);

      // Bounce only celebrates growth; a removal rolls down quietly.
      if (to > from) {
        this.bounceTimer = setTimeout(() => this.bounce.set(true), 20);
      }
    });
  }

  private setStatic(count: number): void {
    this.bounce.set(false);
    this.cells.set(
      count === 0
        ? []
        : String(count)
            .split('')
            .map((d) => ({ prev: d, curr: d, roll: false, dir: 'up' as const }))
    );
  }

  private rollCells(from: number, to: number): OdometerCell[] {
    const dir: 'up' | 'down' = to > from ? 'up' : 'down';
    const len = Math.max(String(from).length, String(to).length);
    const f = String(from).padStart(len, ' ');
    const t = String(to).padStart(len, ' ');
    return Array.from({ length: len }, (_, i) => {
      const prev = f[i].trim();
      const curr = t[i].trim();
      return { prev, curr, roll: prev !== curr, dir };
    });
  }

  openCartDetails() {
    this.bottomSheet.open(CartDetailsSheetComponent);
  }
}
