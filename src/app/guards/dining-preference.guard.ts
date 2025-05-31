import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { DiningPreferenceService } from '../services/dining-preference.service';

export const diningPreferenceGuard: CanActivateFn = (route) => {
  const diningPreferenceService = inject(DiningPreferenceService);
  const router = inject(Router);

  // Load stored preference if not already loaded
  diningPreferenceService.loadStoredPreference();

  if (!diningPreferenceService.hasSelectedPreference()) {
    // Get vendor slug from route params
    const vendorSlug = route.parent?.paramMap.get('vendorSlug');
    if (vendorSlug) {
      return router.createUrlTree([vendorSlug, 'dining-preference']);
    }
    return router.createUrlTree(['/dining-preference']);
  }

  return true;
};
