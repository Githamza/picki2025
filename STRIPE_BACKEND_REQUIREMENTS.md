# Stripe Connect Backend Requirements

This document outlines the minimal backend API endpoints required for Stripe Connect marketplace functionality.

## Required Environment Variables

```bash
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

## Required API Endpoints

### 1. Create Express Account

**POST** `/stripe/create-express-account`

```typescript
// Request Body
{
  email: string;
  country: string; // e.g., "FR"
  business_type?: "individual" | "company";
}

// Response
{
  id: string; // acct_xxxxx
  type: "express";
  country: string;
  email?: string;
  business_type?: string;
}
```

**Implementation Example (Node.js/Express):**

```javascript
app.post("/stripe/create-express-account", async (req, res) => {
  try {
    const { email, country, business_type = "individual" } = req.body;

    const account = await stripe.accounts.create({
      type: "express",
      country,
      email,
      business_type,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    res.json(account);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### 2. Create Account Link (Onboarding)

**POST** `/stripe/account-link`

```typescript
// Request Body
{
  account: string; // acct_xxxxx
  refresh_url: string;
  return_url: string;
  type: "account_onboarding";
}

// Response
{
  object: "account_link";
  created: number;
  expires_at: number;
  url: string;
}
```

**Implementation Example:**

```javascript
app.post("/stripe/account-link", async (req, res) => {
  try {
    const { account, refresh_url, return_url, type } = req.body;

    const accountLink = await stripe.accountLinks.create({
      account,
      refresh_url,
      return_url,
      type,
    });

    res.json(accountLink);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### 3. Create Checkout Session

**POST** `/stripe/create-checkout-session`

```typescript
// Request Body
{
  line_items: Array<{
    price_data: {
      currency: string;
      product_data: { name: string };
      unit_amount: number;
    };
    quantity: number;
  }>;
  mode: "payment";
  success_url: string;
  cancel_url: string;
  customer_email?: string;
  payment_intent_data?: {
    transfer_data?: {
      destination: string; // Connected account ID
    };
    application_fee_amount?: number;
  };
  metadata?: Record<string, string>;
}

// Response
{
  id: string;
  object: "checkout.session";
  url: string;
  payment_status: string;
  status: string;
}
```

**Implementation Example:**

```javascript
app.post("/stripe/create-checkout-session", async (req, res) => {
  try {
    const sessionData = req.body;

    const session = await stripe.checkout.sessions.create(sessionData);

    res.json(session);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### 4. Get Account Details

**GET** `/stripe/account/:accountId`

```typescript
// Response
{
  id: string;
  type: string;
  country: string;
  email: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  // ... other account fields
}
```

**Implementation Example:**

```javascript
app.get("/stripe/account/:accountId", async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await stripe.accounts.retrieve(accountId);

    res.json(account);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### 5. Webhook Handler (Essential for production)

**POST** `/stripe/webhook`

```javascript
app.post("/stripe/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object;
      console.log("Payment succeeded:", session.id);
      // Update your database, send confirmation emails, etc.
      break;
    case "account.updated":
      const account = event.data.object;
      console.log("Account updated:", account.id);
      // Update vendor status in your database
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});
```

## Minimal Backend Setup

### Option 1: Express.js Server

```bash
npm init -y
npm install express stripe cors dotenv
```

### Option 2: Serverless Functions

- **Vercel Functions**
- **Netlify Functions**
- **AWS Lambda**
- **Google Cloud Functions**

## Security Considerations

1. **Never expose secret keys** in frontend code
2. **Validate all requests** on the backend
3. **Use HTTPS** in production
4. **Verify webhook signatures** to ensure requests come from Stripe
5. **Implement rate limiting** to prevent abuse

## Testing

1. Use Stripe's test mode keys
2. Test webhook events using Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:3000/stripe/webhook
   ```

## Production Checklist

- [ ] Replace test keys with live keys
- [ ] Set up webhook endpoints in Stripe Dashboard
- [ ] Configure proper CORS settings
- [ ] Implement proper error handling
- [ ] Add logging and monitoring
- [ ] Set up SSL certificates
- [ ] Test all payment flows

## Frontend Configuration

Update your `environment.ts`:

```typescript
export const environment = {
  // ... existing config
  stripePublishableKey: "pk_live_your_live_key", // Use live key in production
  backendUrl: "https://your-api-domain.com", // Your backend URL
};
```

This minimal backend setup will enable your Angular frontend to work with Stripe Connect for marketplace payments.
