/**
 * Seeded e2e vendor — must stay in sync with supabase/seed.sql.
 */
export const E2E_VENDOR = {
  slug: 'e2e-cafe',
  businessName: 'E2E Cafe',
  storefrontPath: '/vendor/e2e-cafe',
  categories: {
    burgers: 'Burgers',
    drinks: 'Boissons',
  },
  products: {
    /** Simple product, in stock, no customization steps. */
    simple: { name: 'Burger Classique', price: 8.5 },
    /** stock_quantity = 0 — exercises out-of-stock presentation. */
    outOfStock: { name: 'Limonade artisanale' },
    /** Multi-step menu (required single, constrained multi, optional). */
    multiStep: { name: 'Menu Burger', price: 12.0 },
  },
  customer: {
    nom: 'Testeur',
    prenom: 'E2E',
    email: 'e2e@picki.test',
    phone: '+33612345678',
  },
} as const;
