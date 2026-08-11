// Menu role of a category (categories.category_type). Values must match the
// CHECK constraint in 20260809120000_add_category_type.sql. NULL = unclassified
// and excluded from the upsell pool (SPEC-UPSELL.md).
export const CATEGORY_TYPES = [
  { value: 'entree', label: 'Entrée' },
  { value: 'plat', label: 'Plat' },
  { value: 'boisson', label: 'Boisson' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'sauce', label: 'Sauce' },
  { value: 'accompagnement', label: 'Accompagnement' },
  { value: 'autre', label: 'Autre' },
] as const;

export type CategoryType = (typeof CATEGORY_TYPES)[number]['value'];

export function categoryTypeLabel(value: string | null | undefined): string | null {
  return CATEGORY_TYPES.find((t) => t.value === value)?.label ?? null;
}

// v1 upsell pool = products in categories of these types (SPEC-UPSELL.md).
// Single definition site: swap for a per-vendor setting to make it configurable.
export const UPSELLABLE_CATEGORY_TYPES: CategoryType[] = ['boisson', 'dessert'];
