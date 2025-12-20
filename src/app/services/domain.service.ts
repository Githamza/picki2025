import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class DomainService {
  /**
   * Returns the current hostname (no port). In browsers, `window.location.hostname`
   * already excludes ports (e.g. "localhost" instead of "localhost:4200").
   */
  getHostname(): string {
    if (typeof window === 'undefined') return '';
    return window.location.hostname || '';
  }

  /**
   * Normalize a domain for matching:
   * - lower-case
   * - strip leading "www."
   * - ignore empty
   */
  normalizeDomain(hostname: string): string {
    const host = (hostname || '').trim().toLowerCase();
    if (!host) return '';
    return host.startsWith('www.') ? host.slice(4) : host;
  }

  /**
   * Is the given hostname a configured pikiapp domain (or subdomain)?
   *
   * Example:
   * - pikiappDomains = ['pikiapp.com']
   * - "pikiapp.com" -> true
   * - "staging.pikiapp.com" -> true
   */
  isPikiappDomain(hostname: string): boolean {
    const host = this.normalizeDomain(hostname);
    if (!host) return false;

    const domains = (environment.pikiappDomains ?? [])
      .map((d) => this.normalizeDomain(d))
      .filter(Boolean);

    return domains.some((d) => host === d || host.endsWith(`.${d}`));
  }

  isCustomDomain(hostname: string): boolean {
    const host = this.normalizeDomain(hostname);
    if (!host) return false;
    return !this.isPikiappDomain(host);
  }
}

