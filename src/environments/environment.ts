export const environment = {
  production: false,
  // Hosts that should be treated as "pikiapp" (non-custom) domains.
  // If the app is loaded on a host NOT in this list (or its subdomains),
  // we treat it as a vendor custom domain and resolve the vendor by domain.
  //
  // Start with localhost for local development.
  pikiappDomains: ['localhost'],

  // Stripe configuration
  stripePublishableKey: 'pk_test_your_stripe_publishable_key_here', // Replace with your actual key
  backendUrl: 'https://ajblxmolmmvvnobpzzhr.supabase.co', // Your backend API URL
  supabase: {
    url: 'https://ajblxmolmmvvnobpzzhr.supabase.co',
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqYmx4bW9sbW12dm5vYnB6emhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzMjA0OTgsImV4cCI6MjA2Mzg5NjQ5OH0.UFjEo9qpZEChFedWxJEw1vgYrHrd4sFfBi_ZSKiiO9E',
  },
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
  googleMapsApiKey: 'AIzaSyA8QsSphYIuzHefgxTLJRvBC7UQJPp2it4',
  // Temporary toggle to force a specific delivery provider during development/testing.
  // Accepted values: 'uber' | 'stuart' | 'all' | 'auto'
  // - 'uber' or 'stuart': only that provider will be registered
  // - 'all' | 'auto' (default): both providers will be available and the app selects the best
  deliveryProviderOverride: 'uber',
  
  // PayGreen API Configuration
  paygreen: {
    // Choose between 'production' or 'sandbox' API
    // 'production' uses https://api.paygreen.fr
    // 'sandbox' uses https://sb-api.paygreen.fr
    environment: 'sandbox', // Change to 'production' for live payments
    apiUrl: 'https://sb-api.paygreen.fr', // Will be set automatically based on environment
  },
};
