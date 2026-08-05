import { OrderItem } from '../../models/order.model';
import { getDefaultVatRate } from './vat-rates.util';

/**
 * VAT breakdown for a printed ticket.
 *
 * Ported from `supabase/functions/send-order-confirmation/index.ts`, which is
 * the existing source of truth for how Picki splits VAT across the components
 * of a multi-step product. Keep the two in sync: the email receipt and the
 * printed ticket must show identical figures for the same order.
 */
export interface TvaBreakdown {
  rate: number;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
}

interface TvaComponent {
  ttc: number;
  rate: number;
}

/**
 * Split one order line into its VAT components.
 *
 * For a multi-step product (menu / formula) the menu price is allocated across
 * the chosen options in proportion to their a-la-carte prices, so each option
 * is taxed at its own rate. Supplements are attributed to the option that
 * carries them rather than being spread.
 */
export function calculateProRataTvaComponents(
  item: OrderItem,
  country?: string | null
): TvaComponent[] {
  const itemPrice = (item.price || 0) * (item.quantity || 1);
  const fallbackRate = getDefaultVatRate(country);
  const simple: TvaComponent[] = [{ ttc: itemPrice, rate: item.tvaRate ?? fallbackRate }];

  // Multi-step selections live in options[0], not in `customisationSelections`.
  const metadata = item.options?.[0];
  const stepSelections = metadata?.stepSelections;
  if (!stepSelections?.length) {
    return simple;
  }

  const components: Array<{
    alaCartePrice: number;
    tvaRate: number;
    priceAdjustment: number;
  }> = [];

  for (const step of stepSelections) {
    for (const option of step.selectedOptions || []) {
      components.push({
        alaCartePrice: option.alaCartePrice || 0,
        tvaRate: option.tvaRate ?? item.tvaRate ?? fallbackRate,
        priceAdjustment: option.priceAdjustment || 0,
      });
    }
  }

  if (components.length === 0) {
    return simple;
  }

  const totalAlaCarte = components.reduce((sum, c) => sum + c.alaCartePrice, 0);
  if (totalAlaCarte <= 0) {
    return simple;
  }

  const totalSupplements = components.reduce((sum, c) => sum + c.priceAdjustment, 0);
  const basePrice = itemPrice - totalSupplements;

  return components.map((c) => ({
    ttc: (basePrice * c.alaCartePrice) / totalAlaCarte + c.priceAdjustment,
    rate: c.tvaRate,
  }));
}

/** Group every line's VAT components by rate, ascending. */
export function calculateTvaBreakdownByRate(
  items: OrderItem[],
  country?: string | null
): TvaBreakdown[] {
  const groups = new Map<number, { ht: number; ttc: number }>();

  for (const item of items) {
    for (const component of calculateProRataTvaComponents(item, country)) {
      const ht = component.ttc / (1 + component.rate / 100);
      const existing = groups.get(component.rate) || { ht: 0, ttc: 0 };
      groups.set(component.rate, {
        ht: existing.ht + ht,
        ttc: existing.ttc + component.ttc,
      });
    }
  }

  return Array.from(groups.entries())
    .map(([rate, { ht, ttc }]) => ({
      rate,
      totalHT: Math.round(ht * 100) / 100,
      totalTVA: Math.round((ttc - ht) * 100) / 100,
      totalTTC: Math.round(ttc * 100) / 100,
    }))
    .sort((a, b) => a.rate - b.rate);
}

export function calculateTaxFromTTC(
  amountTTC: number,
  vatRate: number
): { ht: number; tva: number; ttc: number } {
  const ht = amountTTC / (1 + vatRate / 100);
  return {
    ht: Math.round(ht * 100) / 100,
    tva: Math.round((amountTTC - ht) * 100) / 100,
    ttc: amountTTC,
  };
}
