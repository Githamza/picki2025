/**
 * E2E environment — used only by `ng serve --configuration e2e`
 * (Playwright webServer, see playwright.config.ts).
 *
 * Points EXCLUSIVELY at the local Supabase stack (`supabase start`).
 * No production URL or live credential may appear in this file:
 * e2e must never touch production services (SPEC.md, Never-do).
 *
 * Third-party keys are intentionally empty — the e2e journeys use
 * take-away with pay-at-counter (the seeded vendor has
 * online_payments_enabled = false), so payment and delivery providers
 * are never exercised. Playwright additionally blocks their origins.
 */
export const environment = {
  production: false,
  pikiappDomains: ['localhost', 'piki-app.com'],

  stripePublishableKey: '',
  // Local Supabase API gateway (`npx supabase start`).
  backendUrl: 'http://127.0.0.1:54321',

  supabase: {
    url: 'http://127.0.0.1:54321',
    // Legacy local anon JWT (the well-known supabase-demo key, not a
    // secret): this CLI's edge runtime rejects sb_publishable_* keys for
    // functions.invoke ("Invalid JWT"), and the success page loads orders
    // through the confirm-payment edge function.
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  },
  deliveryProvidersKeys: [
    {
      providerName: 'Uber',
      providerClientKey: '',
      providerSecretKey: '',
    },
    {
      providerName: 'Stuart',
      providerClientKey: '',
      providerSecretKey: '',
    },
    {
      providerName: 'JustEat',
      providerClientKey: '',
      providerSecretKey: '',
    },
  ],
  googleMapsApiKey: '',
  deliveryProviderOverride: 'auto' as 'uber' | 'stuart' | 'just-eat' | 'all' | 'auto',
  paygreenSandboxEnv: true,
  pexelsApiKey: '',
  uberEatAppId: '',
  uberEatAppSecret: '',
};
