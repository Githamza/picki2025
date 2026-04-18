export type SupportedVatCountryCode = 'FR' | 'BE';

interface VatCountryConfig {
  allowedRates: readonly number[];
  defaultRate: number;
}

const VAT_CONFIG_BY_COUNTRY: Record<SupportedVatCountryCode, VatCountryConfig> = {
  FR: {
    allowedRates: [5.5, 10, 20],
    defaultRate: 10,
  },
  BE: {
    allowedRates: [12],
    defaultRate: 12,
  },
};

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

export function normalizeVatCountryCode(
  country: string | null | undefined
): SupportedVatCountryCode {
  if (!country) {
    return 'FR';
  }

  const normalized = country.trim().toUpperCase();
  return COUNTRY_ALIASES[normalized] ?? 'FR';
}

export function getAllowedVatRates(
  country: string | null | undefined
): readonly number[] {
  return VAT_CONFIG_BY_COUNTRY[normalizeVatCountryCode(country)].allowedRates;
}

export function getDefaultVatRate(country: string | null | undefined): number {
  return VAT_CONFIG_BY_COUNTRY[normalizeVatCountryCode(country)].defaultRate;
}

export function formatVatRateLabel(rate: number): string {
  return `${rate.toString().replace('.', ',')}%`;
}
