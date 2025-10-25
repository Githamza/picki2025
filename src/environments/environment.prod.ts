export const environment = {
  production: true,
  // Temporary toggle to force a specific delivery provider in production if needed
  // Use cautiously. Recommended values: 'auto' | 'all'.
  // Can be set to 'uber' or 'stuart' for targeted testing deployments.
  deliveryProviderOverride: 'auto',
  
  // PayGreen API Configuration
  paygreen: {
    // Choose between 'production' or 'sandbox' API
    // 'production' uses https://api.paygreen.fr
    // 'sandbox' uses https://sb-api.paygreen.fr
    environment: 'production', // Use production for live payments
    apiUrl: 'https://api.paygreen.fr', // Will be set automatically based on environment
  },
};
