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
    desserts: 'Desserts',
  },
  products: {
    /** Simple product, in stock, no customization steps. Contained in the
     *  multi-step menu via the 'Burger maison' option (upsell convert tier). */
    simple: { name: 'Burger Classique', price: 8.5 },
    /** stock_quantity = 0 — exercises out-of-stock presentation. */
    outOfStock: { name: 'Limonade artisanale' },
    /** Multi-step menu (required single, constrained multi, optional). */
    multiStep: { name: 'Menu Burger', price: 12.0 },
    /** Upsell pool members (boisson/dessert categories). */
    drink: { name: 'Coca-Cola', price: 2.5 },
    dessert: { name: 'Tiramisu', price: 4.5 },
  },
  /** Option inside Menu Burger that references the simple product. */
  menuContainedOption: 'Burger maison',
  customer: {
    nom: 'Testeur',
    prenom: 'E2E',
    email: 'e2e@picki.test',
    phone: '+33612345678',
  },
} as const;
