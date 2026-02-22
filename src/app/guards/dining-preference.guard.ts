import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { DiningPreferenceService } from '../services/dining-preference.service';

export const diningPreferenceGuard: CanActivateFn = () => {
  const diningPreferenceService = inject(DiningPreferenceService);

  // Load stored preference if not already loaded
  diningPreferenceService.loadStoredPreference();

  return true;
};
