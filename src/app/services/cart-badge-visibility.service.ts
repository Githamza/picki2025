import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CartBadgeVisibilityService {
  private showCartBadgeSubject = new BehaviorSubject<boolean>(true);

  // Observable for components to subscribe to
  showCartBadge$ = this.showCartBadgeSubject.asObservable();

  // Method to hide cart badge (called by product components)
  hideCartBadge(): void {
    this.showCartBadgeSubject.next(false);
  }

  // Method to show cart badge (called when leaving product components)
  showCartBadge(): void {
    this.showCartBadgeSubject.next(true);
  }

  // Get current state
  get isCartBadgeVisible(): boolean {
    return this.showCartBadgeSubject.value;
  }
}
