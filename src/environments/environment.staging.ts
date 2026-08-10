export const environment = {
  production: true,
  // Hosts that should be treated as "pikiapp" (non-custom) domains.
  // If the app is loaded on a host NOT in this list (or its subdomains),
  // we treat it as a vendor custom domain and resolve the vendor by domain.
  //
  // Staging is served from the Coolify VPS via sslip.io; localhost kept for
  // local previews of the staging build.
  pikiappDomains: ['localhost', 'picki-staging.91.134.240.158.sslip.io'],
  // Stripe TEST key: staging must never take live payments. The staging
  // Supabase project's edge functions need STRIPE_SECRET_KEY set to the
  // matching sk_test_ secret before online payment can be tested.
  stripePublishableKey: 'pk_test_your_stripe_publishable_key_here',
  deliveryProviderOverride: 'auto',
  backendUrl: 'https://umoendimpofdzhazqfnv.supabase.co',
  supabase: {
    url: 'https://umoendimpofdzhazqfnv.supabase.co',
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtb2VuZGltcG9mZHpoYXpxZm52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMTM1NDAsImV4cCI6MjEwMTg4OTU0MH0.oc14vVdoDKYOXz_JXm-na9W8IiE11NFPPVSDVNSuPOg',
  },
  googleMapsApiKey: 'AIzaSyA8QsSphYIuzHefgxTLJRvBC7UQJPp2it4',
  deliveryProvidersKeys: [
    {
      providerName: 'Uber',
      providerClientKey: 'l6RLLSMayZOAWvntl5EacgrBtn_v1gw5',
      providerSecretKey: 'OG8eqdqDCl4-wBCZ7DOfsNoYHhsKP5sDPI6sWFf5',
    },
    {
      providerName: 'Stuart',
      providerClientKey: '6TmZGBm3tkAoZGgd90njFzO2pJqvsgLdpiFdgHR6SmE',
      providerSecretKey: 'Kw6gRkrfU8hz7bUfQ3gwGmzVUEFgkoQLh3vaPr2fj9o',
    },
  ],
  // PayGreen sandbox on staging: uses https://sb-api.paygreen.fr and the
  // sandbox_* credentials from vendor_paygreen_credentials.
  paygreenSandboxEnv: true,

  pexelsApiKey: '1YNGfjtV9g5hvT0fKBwgox5YhsMwgjfN8rkRzgYWbPcIX1pBupeEDQsW',
};
