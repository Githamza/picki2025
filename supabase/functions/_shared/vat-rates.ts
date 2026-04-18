export type SupportedVatCountryCode = 'FR' | 'BE';

const COUNTRY_ALIASES: Record<string, SupportedVatCountryCode> = {
  FR: 'FR',
  FRA: 'FR',
  FRANCE: 'FR',
  BE: 'BE',
  BEL: 'BE',
  BELGIUM: 'BE',
  BELGIQUE: 'BE',
  BELGIE: 'BE',
};

const DEFAULT_VAT_RATE_BY_COUNTRY: Record<SupportedVatCountryCode, number> = {
  FR: 10,
  BE: 12,
};

export function normalizeVatCountryCode(
  country: string | null | undefined
): SupportedVatCountryCode {
  if (!country) {
    return 'FR';
  }

  const normalized = country.trim().toUpperCase();
  return COUNTRY_ALIASES[normalized] ?? 'FR';
}

export function getDefaultVatRate(country: string | null | undefined): number {
  return DEFAULT_VAT_RATE_BY_COUNTRY[normalizeVatCountryCode(country)];
}
