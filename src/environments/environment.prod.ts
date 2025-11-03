export const environment = {
  production: true,
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
  // PayGreen API Configuration
  paygreen: {
    // Choose between 'production' or 'sandbox' API
    // 'production' uses https://api.paygreen.fr
    // 'sandbox' uses https://sb-api.paygreen.fr
    environment: 'production', // Use production for live payments
    apiUrl: 'https://api.paygreen.fr', // Will be set automatically based on environment
  },
};
