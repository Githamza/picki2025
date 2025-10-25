# PayGreen Per-Vendor Credentials Implementation

## Overview

This implementation allows each vendor in the marketplace to use their own PayGreen credentials for payment processing, ensuring proper isolation and security.

## Architecture Changes

### 1. Database Schema

- **New table**: `vendor_paygreen_credentials`
  - `vendor_id`: UUID reference to vendors table
  - `shop_id`: PayGreen shop identifier
  - `public_key`: PayGreen public key
  - `secret_key`: PayGreen secret key (plain text, protected by RLS)
  - `active`: Boolean flag for enabling/disabling credentials

### 2. Security Model

- **Row-Level Security (RLS)**: Only `service_role` can read credentials
- **No browser exposure**: PayGreen credentials never reach the client
- **Vendor isolation**: Each vendor's credentials are completely separate

### 3. Edge Functions

#### `create-paygreen-order`

- **Purpose**: Create hosted payment orders using vendor-specific credentials
- **Input**: `{ vendorId, paymentOrder }`
- **Process**:
  1. Fetch vendor credentials from database
  2. Authenticate with PayGreen using vendor's secret key
  3. Create payment order with PayGreen API
  4. Return hosted payment URL

#### `get-paygreen-order`

- **Purpose**: Retrieve payment order details
- **Input**: `?vendorId=uuid&paymentId=po_xxx`
- **Process**: Same auth flow, then fetch payment details

#### `capture-paygreen-order`

- **Purpose**: Capture authorized payments
- **Input**: `{ vendorId, paymentId }`
- **Process**: Same auth flow, then capture payment

### 4. Frontend Changes

#### Payment Services

- **Removed**: `paygreen.service.ts` (contained hardcoded credentials)
- **Added**: `paygreen-backend.service.ts` (calls Edge functions)
- **Updated**: `PaygreenPaymentStrategy` now requires `vendorId`

#### Components Updated

- `CartDetailsPageComponent`: Now passes current vendor ID to payment requests
- `CartDetailsSheetComponent`: Same vendor ID integration
- `PaymentSuccessComponent`: Uses vendor ID for payment detail retrieval
- `OrdersManagerComponent`: Uses vendor ID for payment capture

#### Payment Flow

1. User initiates checkout
2. Component gets current vendor from `VendorService`
3. Payment request includes `vendorId`
4. Backend Edge function uses vendor's PayGreen credentials
5. User redirected to vendor-specific PayGreen hosted page

## Configuration Steps

### 1. Database Setup

```sql
-- Migration already applied
-- Creates vendor_paygreen_credentials table with RLS
```

### 2. Add Vendor Credentials

```sql
-- Example: Add credentials for a vendor
insert into vendor_paygreen_credentials
  (vendor_id, shop_id, public_key, secret_key, active)
values
  ('vendor-uuid-here', 'sh_live_xxx', 'pk_live_xxx', 'sk_live_xxx', true);
```

### 3. Environment Setup

- Remove PayGreen credentials from `environment.ts` ✅
- Ensure Edge functions have access to `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

## API Endpoints

### Create Payment Order

```
POST /functions/v1/create-paygreen-order
{
  "vendorId": "uuid",
  "paymentOrder": {
    "amount": 2500,
    "currency": "eur",
    "buyer": { ... },
    // ... other PayGreen payment order fields
  }
}
```

### Get Payment Details

```
GET /functions/v1/get-paygreen-order?vendorId=uuid&paymentId=po_xxx
```

### Capture Payment

```
POST /functions/v1/capture-paygreen-order
{
  "vendorId": "uuid",
  "paymentId": "po_xxx"
}
```

## Security Benefits

1. **Credential Isolation**: Each vendor's keys are separate and secure
2. **Zero Client Exposure**: No payment credentials in browser
3. **Audit Trail**: All payment operations are server-side logged
4. **Flexible Management**: Can activate/deactivate vendor payment processing
5. **Compliance**: Meets PCI DSS requirements for credential handling

## Usage Example

```typescript
// Frontend payment creation
const paymentRequest: PaymentRequest = {
  amount: 25.50,
  currency: 'EUR',
  vendorId: currentVendor.id, // ← Key addition
  buyer: { email: '...', firstName: '...', lastName: '...' },
  items: [...],
  returnUrl: '...',
  cancelUrl: '...'
};

// This now uses vendor-specific PayGreen credentials automatically
this.paymentService.createPayment(paymentRequest).subscribe(response => {
  window.location.href = response.url; // Redirect to vendor's PayGreen page
});
```

## Deployment Status

✅ Database migrations applied
✅ Edge functions deployed (versions 2)
✅ Frontend updated and tested
✅ RLS policies active
✅ Environment variables cleaned

## Next Steps

1. **Add vendor credentials** to the `vendor_paygreen_credentials` table
2. **Test payment flow** with real vendor credentials
3. **Monitor Edge function logs** for any issues
4. **Set up vendor onboarding process** for PayGreen credential collection

## Troubleshooting

- **"Credentials not found for vendor"**: Check that vendor has active row in `vendor_paygreen_credentials`
- **"No vendor selected for payment"**: Ensure `VendorService.getCurrentVendor()` returns valid vendor
- **Auth failures**: Verify PayGreen credentials are correct and active
- **Edge function errors**: Check Supabase function logs via dashboard
