import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Post-add positive feedback: a short congratulation shown after a product
 * lands in the cart. Complements the add-to-cart-bar -> cart-badge view
 * transition morph (the "product flies into the basket" animation).
 */
@Injectable({ providedIn: 'root' })
export class CartCelebrationService {
  private snackBar = inject(MatSnackBar);

  /**
   * Count last displayed by the cart badge. Lives here because the badge
   * component is destroyed on product pages: on remount after an add, the
   * badge rolls its odometer from this value to the real count instead of
   * appearing with the new number already applied.
   */
  lastShownCount = 0;

  /** Latest router view transition, stored by onViewTransitionCreated
   *  (app.config.ts). Already-settled when no transition is in flight. */
  private transitionDone: Promise<void> = Promise.resolve();

  noteViewTransition(finished: Promise<void>): void {
    // Never reject: a skipped/aborted transition should release waiters too.
    this.transitionDone = finished.catch(() => {});
  }

  /** Resolves once the current page transition (if any) has finished —
   *  the badge waits for this so its roll + bounce play on a fully
   *  visible page instead of behind the transition overlay. */
  whenPageSettled(): Promise<void> {
    return this.transitionDone;
  }

  private readonly messages = [
    'Excellent choix !',
    'Très bon choix !',
    'Bien joué !',
    'Miam, ça arrive !',
  ];

  celebrate(): void {
    const message =
      this.messages[Math.floor(Math.random() * this.messages.length)];
    this.snackBar.open(`🎉 ${message} C'est dans le panier.`, undefined, {
      duration: 2200,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: 'cart-celebration-snackbar',
    });
  }
}
