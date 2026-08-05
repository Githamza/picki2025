// confirm-payment: server-side payment confirmation + customer order reads.
//
// The payment-success page used to verify the payment client-side and then,
// as the anonymous role, flip orders.status to 'paid', insert the payments
// row and update order_deliveries. That required world-open RLS policies on
// those tables (any anon key holder could mark any order paid). This function
// moves the whole flow server-side:
//
//   action "confirm": verify the payment with Stripe/PayGreen using server
//     credentials, then (service role) set the order to 'paid', record the
//     payment, advance the delivery status and claim the confirmation email.
//   action "status": return order + items + delivery for the success page's
//     polling and for tracking links. Orders are addressed by their UUID,
//     which only the customer's browser (and the vendor) holds.
//
// This function runs with the service-role key and bypasses RLS; the order
// tables have no anon policies at all once the phase-2 migration is applied.
declare const Deno: any;
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPayGreenAuth } from '../_shared/paygreen-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-version',
};

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    ...init,
  });

const ORDER_SELECT = `
  *,
  order_items (
    *,
    products (
      id,
      name,
      price,
      image_url,
      is_multi_step
    )
  )
`;

// Delivery statuses that must never be regressed by a payment-status write.
const ADVANCED_DELIVERY_STAGES = [
  'assigned',
  'en_route_to_pickup',
  'arrived_at_pickup',
  'in_transit',
  'en_route_to_dropoff',
  'delivering',
  'picking',
  'picked',
  'delivered',
  'cancelled',
  'returned',
  'split',
  'reassigning',
];

function createServiceClient() {
  const url =
    Deno.env.get('LOCAL_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
  const key =
    Deno.env.get('LOCAL_SUPABASE_SERVICE_ROLE_KEY') ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Supabase service credentials are not configured');
  }
  return createClient(url, key);
}

type VerifiedPayment = {
  orderId: string;
  providerPaymentId: string;
  amount: number; // major currency units
  currency: string;
  deliveryStatus: string;
  details: Record<string, unknown>; // safe subset for the success page UI
};

async function verifyStripe(sessionId: string): Promise<VerifiedPayment> {
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${stripeSecretKey}` } }
  );
  const text = await res.text();
  if (!res.ok) {
    console.error('Stripe get session failed:', text);
    throw new Error('Stripe API error while verifying the session');
  }
  const session = JSON.parse(text);

  if (String(session.payment_status).toLowerCase() !== 'paid') {
    throw new Error(`Stripe session is not paid (${session.payment_status})`);
  }

  const orderId = session.metadata?.orderId;
  if (!orderId) {
    throw new Error('Stripe session has no orderId in metadata');
  }

  return {
    orderId,
    providerPaymentId: session.id,
    amount: (session.amount_total ?? 0) / 100,
    currency: String(session.currency || 'eur').toUpperCase(),
    deliveryStatus: 'payment_succeeded',
    details: {
      id: session.id,
      status: session.payment_status,
      amount: (session.amount_total ?? 0) / 100,
      currency: String(session.currency || 'eur').toUpperCase(),
      customerEmail: session.customer_details?.email ?? null,
    },
  };
}

async function verifyPayGreen(
  poId: string,
  vendorId: string,
  apiUrl?: string,
  isSandbox?: boolean
): Promise<VerifiedPayment> {
  if (!vendorId) {
    throw new Error('vendorId is required for PayGreen verification');
  }
  const pgApiUrl =
    apiUrl || Deno.env.get('PG_API_URL') || 'https://api.paygreen.fr';
  const auth = await getPayGreenAuth(vendorId, pgApiUrl, !!isSandbox);

  const res = await fetch(
    `${pgApiUrl}/payment/payment-orders/${encodeURIComponent(poId)}`,
    {
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  );
  const text = await res.text();
  if (!res.ok) {
    console.error('PayGreen get payment order failed:', text);
    throw new Error('PayGreen API error while verifying the payment');
  }
  const body = JSON.parse(text);
  const po = body?.data ?? body;

  const status = String(po?.status || '').toLowerCase();
  const isPaid =
    status.includes('authorized') ||
    status.includes('successed') ||
    status.includes('succeeded') ||
    status.includes('completed');
  if (!isPaid) {
    throw new Error(`PayGreen payment order is not paid (${po?.status})`);
  }

  const orderId = po?.metadata?.reference || po?.reference;
  if (!orderId) {
    throw new Error('PayGreen payment order has no order reference');
  }

  return {
    orderId,
    providerPaymentId: po.id ?? poId,
    amount: (po.amount ?? 0) / 100,
    currency: String(po.currency || 'eur').toUpperCase(),
    deliveryStatus: 'payment_authorized',
    details: {
      id: po.id ?? poId,
      status: po.status,
      amount: (po.amount ?? 0) / 100,
      currency: String(po.currency || 'eur').toUpperCase(),
      platforms: po.platforms ?? null,
      customerEmail: po.buyer?.email ?? null,
    },
  };
}

async function loadOrderAndDelivery(supabase: any, orderId: string) {
  const { data: order, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;

  let delivery = null;
  if (order) {
    const { data } = await supabase
      .from('order_deliveries')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();
    delivery = data ?? null;
  }
  return { order, delivery };
}

async function handleConfirm(body: any) {
  const provider = String(body.provider || '').toLowerCase();

  let verified: VerifiedPayment;
  if (provider === 'stripe') {
    if (!body.sessionId) return json({ error: 'sessionId is required' }, { status: 400 });
    verified = await verifyStripe(String(body.sessionId));
  } else if (provider === 'paygreen') {
    if (!body.poId) return json({ error: 'poId is required' }, { status: 400 });
    verified = await verifyPayGreen(
      String(body.poId),
      String(body.vendorId || ''),
      body.apiUrl ? String(body.apiUrl) : undefined,
      body.isSandbox === true
    );
  } else {
    return json({ error: 'provider must be stripe or paygreen' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { order, delivery } = await loadOrderAndDelivery(
    supabase,
    verified.orderId
  );
  if (!order) {
    console.error('Verified payment references unknown order:', verified.orderId);
    return json(
      { error: 'Order not found for this payment', orderId: verified.orderId },
      { status: 404 }
    );
  }

  // Flip initiated -> paid. Guarded on the current status so replays and
  // already-progressed orders are untouched.
  if (order.status === 'initiated') {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .eq('status', 'initiated');
    if (error) throw error;
    order.status = 'paid';
  }

  // Record the payment once.
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id')
    .eq('order_id', order.id)
    .maybeSingle();
  if (!existingPayment) {
    const { error } = await supabase.from('payments').insert({
      provider,
      provider_payment_id: verified.providerPaymentId,
      amount: verified.amount,
      currency: verified.currency,
      status: 'completed',
      order_id: order.id,
      metadata: { orderNumber: order.order_number },
    });
    if (error) console.error('Failed to insert payment record:', error);
  }

  // Advance the delivery row's status unless a courier flow already
  // progressed it (webhooks own the row from dispatch onwards).
  if (
    delivery &&
    !ADVANCED_DELIVERY_STAGES.includes(String(delivery.status || '').toLowerCase())
  ) {
    const { error } = await supabase
      .from('order_deliveries')
      .update({
        status: verified.deliveryStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', order.id);
    if (error) console.error('Failed to update delivery status:', error);
    else delivery.status = verified.deliveryStatus;
  }

  // Claim the confirmation email: report whether it was already sent and mark
  // it sent atomically so double-loads of the success page send one email.
  const emailAlreadySent = order.confirmation_email_sent === true;
  if (!emailAlreadySent) {
    const { error } = await supabase
      .from('orders')
      .update({ confirmation_email_sent: true })
      .eq('id', order.id);
    if (error) console.error('Failed to mark confirmation email sent:', error);
    else order.confirmation_email_sent = true;
  }

  return json({
    order,
    delivery,
    payment: { provider, ...verified.details },
    emailAlreadySent,
  });
}

async function handleStatus(body: any) {
  const orderId = String(body.orderId || '').trim();
  if (!orderId) return json({ error: 'orderId is required' }, { status: 400 });

  const supabase = createServiceClient();
  const { order, delivery } = await loadOrderAndDelivery(supabase, orderId);
  if (!order) return json({ error: 'Order not found' }, { status: 404 });

  return json({ order, delivery });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const action = String(body.action || 'confirm');
    if (action === 'confirm') return await handleConfirm(body);
    if (action === 'status') return await handleStatus(body);
    return json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('confirm-payment error:', error);
    return json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});
