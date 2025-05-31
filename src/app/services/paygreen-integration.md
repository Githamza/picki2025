# PayGreen Payment Integration

This document describes the PayGreen hosted payment integration implemented in this Angular application.

## Overview

The application uses PayGreen's hosted payment solution, which redirects users to PayGreen's secure payment page. This approach ensures PCI compliance since card details are never handled by our application.

## Configuration

PayGreen credentials are stored in `src/environments/environment.ts`:

- `PayGreenShopId`: Your shop identifier
- `PayGreenApiKey`: Public API key
- `PayGreenPrivateKey`: Private key for server-side operations
- `PayGreenUrl`: PayGreen API base URL

## Implementation Details

### 1. PayGreen Service (`services/paygreen.service.ts`)

- Handles communication with PayGreen API
- Creates hosted payment sessions
- Generates unique order IDs
- Converts amounts from euros to cents

### 2. Payment Flow

1. User adds items to cart
2. User clicks "Valider et payer" (Validate and pay)
3. Application creates a payment request with:
   - Order ID
   - Amount in cents
   - Fake buyer information (as requested)
   - Return URLs for success/failure
4. User is redirected to PayGreen's hosted payment page
5. After payment, user is redirected back to:
   - `/successPayment` - Payment successful
   - `/failedPayment` - Payment failed or cancelled

### 3. Components

- **PaymentSuccessComponent**: Displays success message and clears cart
- **PaymentFailedComponent**: Shows error message with retry option
- **Cart Components**: Updated with PayGreen checkout integration

## Testing

For testing the integration:

1. Ensure PayGreen test/sandbox credentials are in environment.ts
2. Use PayGreen's test card numbers
3. Monitor browser console for any API errors

## Security Considerations

- Private key should never be exposed in frontend code
- In production, payment creation should be handled by backend
- Always validate payment status on backend before fulfilling orders

## Future Improvements

1. Move payment creation to backend API
2. Implement webhook handling for payment status updates
3. Add real customer information collection
4. Implement order tracking and history
5. Add support for multiple payment methods
