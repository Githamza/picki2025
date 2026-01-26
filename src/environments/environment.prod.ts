export const environment = {
  production: true,
  // Hosts that should be treated as "pikiapp" (non-custom) domains.
  // If the app is loaded on a host NOT in this list (or its subdomains),
  // we treat it as a vendor custom domain and resolve the vendor by domain.
  //
  // Start with localhost for consistency (some prod-like previews use it).
  pikiappDomains: ['localhost', 'pikiapp.z6.web.core.windows.net','piki-app.com','hkuysvx.cluster121.hosting.ovh.net'],
  // Temporary toggle to force a specific delivery provider in production if needed
  // Use cautiously. Recommended values: 'auto' | 'all'.
  // Can be set to 'uber' or 'stuart' for targeted testing deployments.
  stripePublishableKey: 'pk_test_your_stripe_publishable_key_here', // Replace with your actual key
  deliveryProviderOverride: 'auto',
  backendUrl: 'https://ajblxmolmmvvnobpzzhr.supabase.co', // Your backend API URL
  supabase: {
    url: 'https://ajblxmolmmvvnobpzzhr.supabase.co',
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqYmx4bW9sbW12dm5vYnB6emhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzMjA0OTgsImV4cCI6MjA2Mzg5NjQ5OH0.UFjEo9qpZEChFedWxJEw1vgYrHrd4sFfBi_ZSKiiO9E',
  },
  googleMapsApiKey: 'AIzaSyA8QsSphYIuzHefgxTLJRvBC7UQJPp2it4',
  deliveryProvidersKeys: [
    {
      providerName: 'Uber',
      providerClientKey: 'urtiG42j-nG4O_GNKEQd3JL2Gv0nE86J',
      providerSecretKey: '8Q0O8R210V6rs4PUZtrA0HkgG_jRPcoBRUsEA9tB',
    },
    {
      providerName: 'Stuart',
      providerClientKey: '6TmZGBm3tkAoZGgd90njFzO2pJqvsgLdpiFdgHR6SmE',
      providerSecretKey: 'Kw6gRkrfU8hz7bUfQ3gwGmzVUEFgkoQLh3vaPr2fj9o',
    },
  ],
  // PayGreen Sandbox Mode
  // When true:
  //   - Uses sandbox API URL: https://sb-api.paygreen.fr
  //   - Uses sandbox credentials (sandbox_shop_id, sandbox_public_key, sandbox_secret_key)
  //     from vendor_paygreen_credentials table
  // When false:
  //   - Uses production API URL: https://api.paygreen.fr
  //   - Uses production credentials (shop_id, public_key, secret_key)
  paygreenSandboxEnv: false,

  // Pexels API configuration (NOTE: using this key in a frontend app will expose it to users).
  // Consider proxying requests via your backend for production.
  pexelsApiKey: '1YNGfjtV9g5hvT0fKBwgox5YhsMwgjfN8rkRzgYWbPcIX1pBupeEDQsW',
};
