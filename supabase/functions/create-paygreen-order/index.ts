import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';
import { getPayGreenAuth } from '../_shared/paygreen-auth.ts';

interface CreateOrderRequest {
  vendorId: string;
  paymentOrder: any;
  apiUrl?: string;
  isSandbox?: boolean;
  deliveryAmountMinor?: number; // delivery cost in cents for marketplace split
}

// Helper to build JSON responses with CORS headers
const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
    },
    ...init,
  });

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  let body: CreateOrderRequest;
  try {
    body = await req.json();
  } catch (_) {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { vendorId, paymentOrder, apiUrl: frontendApiUrl, isSandbox = false, deliveryAmountMinor } = body;
  if (!vendorId || !paymentOrder) {
    return json(
      { error: 'vendorId and paymentOrder are required' },
      { status: 400 }
    );
  }

  console.log('Sandbox mode:', isSandbox);

  // Use API URL from frontend if provided, otherwise fall back to environment variable or default
  const apiUrl = frontendApiUrl || Deno.env.get('PG_API_URL') || 'https://api.paygreen.fr';
  console.log('Using PayGreen API URL:', apiUrl);

  try {
    // Authenticate using the shared helper (handles independent vs marketplace)
    const auth = await getPayGreenAuth(vendorId, apiUrl, isSandbox);

    console.log('PayGreen mode:', auth.paygreenMode);

    // Build the payment order body
    let orderBody = { ...paymentOrder };

    // In marketplace mode, add eligible_amounts for vendor split
    if (auth.paygreenMode === 'marketplace' && auth.vendorShopId) {
      const totalAmount = paymentOrder.amount; // already in cents

      let vendorAmount: number;
      if (auth.deliverySystem === 'picki' && deliveryAmountMinor && deliveryAmountMinor > 0) {
        // Picki keeps the delivery fee, vendor gets the rest
        vendorAmount = totalAmount - deliveryAmountMinor;
      } else {
        // Vendor gets 100% (eat-in, take-away, or own delivery)
        vendorAmount = totalAmount;
      }

      console.log('Marketplace split - total:', totalAmount, 'vendor:', vendorAmount, 'delivery:', deliveryAmountMinor || 0);

      orderBody = {
        ...orderBody,
        eligible_amounts: [
          {
            shop_id: auth.vendorShopId,
            amount: vendorAmount,
          },
        ],
      };
    }

    // Create payment order
    const orderRes = await fetch(`${apiUrl}/payment/payment-orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(orderBody),
    });

    if (!orderRes.ok) {
      const errBody = await orderRes.text();
      console.error('PayGreen order creation failed:', errBody);
      return json(
        { error: 'Create order failed', details: errBody },
        { status: 500 }
      );
    }

    const orderJson = await orderRes.json();
    console.log('PayGreen order created successfully');
    return json(orderJson);
  } catch (error) {
    console.error('Function error:', error);
    return json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
});
