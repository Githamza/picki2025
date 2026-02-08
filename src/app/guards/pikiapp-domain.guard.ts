import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { DomainService } from '../services/domain.service';

/**
 * Guard that only matches routes when the app is running on a pikiapp domain
 * (e.g., localhost, piki-app.com). Returns false for custom vendor domains.
 */
export const pikiappDomainGuard: CanMatchFn = () => {
  const domainService = inject(DomainService);
  const hostname = domainService.getHostname();
  return domainService.isPikiappDomain(hostname);
};

