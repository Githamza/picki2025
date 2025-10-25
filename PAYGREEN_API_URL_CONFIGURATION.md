# PayGreen API URL Configuration

This document explains how to programmatically choose between PayGreen's production and sandbox API URLs from the frontend environment configuration.

## Overview

The application now supports dynamic selection of PayGreen API URLs through environment configuration, eliminating the need to hardcode URLs in Supabase Edge Functions.

## Configuration

### Environment Files

#### Development Environment (`src/environments/environment.ts`)
```typescript
export const environment = {
  // ... other config
  paygreen: {
    environment: 'sandbox', // 'production' or 'sandbox'
    apiUrl: 'https://sb-api.paygreen.fr', // Will be set automatically
  },
};
```

#### Production Environment (`src/environments/environment.prod.ts`)
```typescript
export const environment = {
  // ... other config
  paygreen: {
    environment: 'production', // 'production' or 'sandbox'
    apiUrl: 'https://api.paygreen.fr', // Will be set automatically
  },
};
```

### API URLs

- **Production**: `https://api.paygreen.fr`
- **Sandbox**: `https://sb-api.paygreen.fr`

## Usage

### 1. PayGreen Config Service

The `PaygreenConfigService` provides methods to access the current configuration:

```typescript
import { PaygreenConfigService } from './services/paygreen-config.service';

constructor(private paygreenConfig: PaygreenConfigService) {}

// Get the current API URL
const apiUrl = this.paygreenConfig.getApiUrl();

// Get the current environment
const environment = this.paygreenConfig.getEnvironment();

// Check if using production
const isProduction = this.paygreenConfig.isProduction();

// Check if using sandbox
const isSandbox = this.paygreenConfig.isSandbox();
```

### 2. Utility Functions

The `PaygreenEnvironmentUtil` provides static utility functions:

```typescript
import { PaygreenEnvironmentUtil } from './shared/utils/paygreen-environment.util';

// Get API URL for current environment
const apiUrl = PaygreenEnvironmentUtil.getApiUrl();

// Get API URL for specific environment
const prodUrl = PaygreenEnvironmentUtil.getApiUrlForEnvironment('production');
const sandboxUrl = PaygreenEnvironmentUtil.getApiUrlForEnvironment('sandbox');

// Check current environment
const isProduction = PaygreenEnvironmentUtil.isProduction();
const isSandbox = PaygreenEnvironmentUtil.isSandbox();

// Log configuration for debugging
PaygreenEnvironmentUtil.logConfiguration();
```

### 3. Backend Service Integration

The `PaygreenBackendService` automatically uses the configured API URL when making requests to Supabase Edge Functions:

```typescript
// The service automatically includes the API URL in requests
this.paygreenBackend.createPaymentOrder(vendorId, paymentOrder);
this.paygreenBackend.getPaymentOrder(vendorId, paymentId);
this.paygreenBackend.capturePayment(vendorId, paymentId);
```

## How It Works

1. **Frontend Configuration**: The environment files define the PayGreen configuration
2. **Service Layer**: The `PaygreenConfigService` reads the configuration and provides it to other services
3. **Backend Communication**: The `PaygreenBackendService` includes the API URL in all requests to Supabase Edge Functions
4. **Edge Function Processing**: The Supabase Edge Functions use the provided API URL instead of hardcoded values

## Edge Function Changes

All PayGreen-related Edge Functions now accept an `apiUrl` parameter:

### Create Order Function
```typescript
// Frontend sends:
{
  vendorId: "vendor123",
  paymentOrder: { /* payment data */ },
  apiUrl: "https://sb-api.paygreen.fr" // From environment config
}

// Edge function uses:
const apiUrl = frontendApiUrl || Deno.env.get('PG_API_URL') || 'https://api.paygreen.fr';
```

### Get Order Function
```typescript
// Frontend sends:
GET /functions/v1/get-paygreen-order?vendorId=vendor123&paymentId=payment456&apiUrl=https://sb-api.paygreen.fr

// Edge function uses:
const frontendApiUrl = url.searchParams.get('apiUrl');
const apiUrl = frontendApiUrl || Deno.env.get('PG_API_URL') || 'https://api.paygreen.fr';
```

### Capture Order Function
```typescript
// Frontend sends:
{
  vendorId: "vendor123",
  paymentId: "payment456",
  apiUrl: "https://sb-api.paygreen.fr" // From environment config
}

// Edge function uses:
const apiUrl = frontendApiUrl || Deno.env.get('PG_API_URL') || 'https://api.paygreen.fr';
```

## Switching Environments

To switch between production and sandbox:

1. **Development**: Update `src/environments/environment.ts`
2. **Production**: Update `src/environments/environment.prod.ts`
3. **Build and Deploy**: The changes will take effect after rebuilding

### Example: Switch to Production
```typescript
// In environment.ts or environment.prod.ts
paygreen: {
  environment: 'production',
  apiUrl: 'https://api.paygreen.fr',
},
```

## Fallback Behavior

The system includes multiple fallback levels:

1. **Frontend API URL**: From environment configuration (highest priority)
2. **Environment Variable**: `PG_API_URL` in Supabase Edge Functions
3. **Default URL**: `https://api.paygreen.fr` (lowest priority)

## Testing

Use the `PaygreenConfigDemoComponent` to test the configuration:

```typescript
// Add to your component template
<app-paygreen-config-demo></app-paygreen-config-demo>
```

This component displays the current configuration and provides a button to log details to the console.

## Security Considerations

- The API URL configuration is not sensitive information
- Both production and sandbox URLs are publicly accessible
- The actual API keys are still stored securely in the database
- Environment switching only affects which PayGreen endpoint is used

## Migration from Hardcoded URLs

If you have existing code using hardcoded PayGreen URLs:

1. Replace direct URL usage with `PaygreenConfigService.getApiUrl()`
2. Update any manual API URL construction
3. Test both production and sandbox environments

## Troubleshooting

### Common Issues

1. **API URL not updating**: Ensure you've rebuilt the application after changing environment files
2. **Wrong environment**: Check that the correct environment file is being used
3. **Edge function errors**: Verify that the API URL is being passed correctly from the frontend

### Debug Steps

1. Use `PaygreenEnvironmentUtil.logConfiguration()` to see current settings
2. Check browser network tab to see which API URL is being used
3. Check Supabase Edge Function logs for the received API URL
4. Verify environment file is being loaded correctly

## Future Enhancements

- Add runtime environment switching (for testing)
- Add validation for API URL format
- Add configuration validation on startup
- Add metrics for API URL usage
