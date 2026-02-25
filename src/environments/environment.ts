export const environment = {
  production: false,
  // Hosts that should be treated as "pikiapp" (non-custom) domains.
  // If the app is loaded on a host NOT in this list (or its subdomains),
  // we treat it as a vendor custom domain and resolve the vendor by domain.
  //
  // Start with localhost for local development.
  pikiappDomains: ['localhost','piki-app.com'],

  // Stripe configuration
  stripePublishableKey: 'pk_live_51Q0N90DfSHeivE3NHDafxiGPIWzJgRlz8CkLUua9WLayQZHpfl50Wo3trN1jtQHZ4DmTgHHNdLKabI9vFb7KggMY00WIrCcPTX', // Replace with your actual key
  // Local Supabase (started via `npx supabase start`) runs the API gateway on 54321.
  // This makes the frontend call local Edge Functions during development:
  //   http://127.0.0.1:54321/functions/v1/<function-name>
  backendUrl: 'http://127.0.0.1:54321',
  // backendUrl: 'https://ajblxmolmmvvnobpzzhr.supabase.co', // Your backend API URL

  supabase: {
    // url: 'http://127.0.0.1:54321',
    url: 'https://ajblxmolmmvvnobpzzhr.supabase.co',
    anonKey:
      // Local anon key printed by `npx supabase start`.
      // 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqYmx4bW9sbW12dm5vYnB6emhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzMjA0OTgsImV4cCI6MjA2Mzg5NjQ5OH0.UFjEo9qpZEChFedWxJEw1vgYrHrd4sFfBi_ZSKiiO9E',
  },
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
  googleMapsApiKey: 'AIzaSyA8QsSphYIuzHefgxTLJRvBC7UQJPp2it4',
  // Temporary toggle to force a specific delivery provider during development/testing.
  // Accepted values: 'uber' | 'stuart' | 'all' | 'auto'
  // - 'uber' or 'stuart': only that provider will be registered
  // - 'all' | 'auto' (default): both providers will be available and the app selects the best
  deliveryProviderOverride: 'uber',
  
  // PayGreen Sandbox Mode
  // When true:
  //   - Uses sandbox API URL: https://sb-api.paygreen.fr
  //   - Uses sandbox credentials (sandbox_shop_id, sandbox_public_key, sandbox_secret_key)
  //     from vendor_paygreen_credentials table
  // When false:
  //   - Uses production API URL: https://api.paygreen.fr
  //   - Uses production credentials (shop_id, public_key, secret_key)
  paygreenSandboxEnv: true,

  // Pexels API configuration (NOTE: using this key in a frontend app will expose it to users).
  // Consider proxying requests via your backend for production.
  pexelsApiKey: '1YNGfjtV9g5hvT0fKBwgox5YhsMwgjfN8rkRzgYWbPcIX1pBupeEDQsW',
  uberEatAppId: '5pSEv5fiKM2ecVWdhJUc0IWXcmfD1HNL',
  uberEatAppSecret: 'Qes_UVTrL4srL0Fro5Toa4N2nd5Lv9pSkC2hivXv',
};
