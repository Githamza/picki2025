// qonto-terminal: kiosk-facing terminal payment actions + admin terminal list
// (SPEC-QONTO-TERMINAL.md T3-T5).
//
// The kiosk (anonymous role) only ever sends an orderId. The charged amount is
// read from the order row with the service role — a tampered client payload
// cannot change it. Payment success is decided here too (get-payment flips the
// order initiated -> todo on AUTHORIZED); the client never self-declares an
// outcome. Same trust model as confirm-payment.
declare const Deno: any;
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getQontoEnv,
  mockCreatePayment,
  mockGetPayment,
  qontoFetch,
  type TerminalPaymentResult,
} from '../_shared/qonto.ts';

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

interface OrderContext {
  order: any;
  vendor: any;
}

/** Load order + vendor and enforce the terminal preconditions shared by all
 *  kiosk actions. Returns a Response on failure. */
async function loadTerminalOrder(
  supabase: any,
  orderId: string
): Promise<OrderContext | Response> {
  if (!orderId) {
    return json({ error: 'orderId est requis' }, { status: 400 });
  }
  const { data: order, error } = await supabase
    .from('orders')
    .select(
      'id, vendor_id, status, total_amount, order_number, terminal_payment_id'
    )
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order) {
    return json({ error: 'Commande introuvable' }, { status: 404 });
  }

  const { data: vendor, error: vendorError } = await supabase
    .from('vendors')
    .select('id, currency, kiosk_terminal_enabled, kiosk_terminal_id')
    .eq('id', order.vendor_id)
    .maybeSingle();
  if (vendorError) throw vendorError;
  if (!vendor?.kiosk_terminal_enabled || !vendor?.kiosk_terminal_id) {
    return json(
      { error: "Le terminal de paiement n'est pas activé pour ce restaurant" },
      { status: 403 }
    );
  }
  if (String(vendor.currency || '').toUpperCase() !== 'EUR') {
    return json(
      { error: 'Le terminal Qonto ne supporte que les paiements en EUR' },
      { status: 400 }
    );
  }
  return { order, vendor };
}

/** Access token for real-Qonto calls. Mock mode never needs one. Full
 *  refresh handling lands with qonto-oauth (T6). */
async function getAccessToken(supabase: any, vendorId: string): Promise<string> {
  const { data: connection, error } = await supabase
    .from('vendor_qonto_connections')
    .select('access_token, access_token_expires_at')
    .eq('vendor_id', vendorId)
    .maybeSingle();
  if (error) throw error;
  if (!connection) {
    throw Object.assign(new Error("Ce restaurant n'est pas connecté à Qonto"), {
      status: 403,
    });
  }
  return connection.access_token;
}

async function handleCreatePayment(body: any) {
  const supabase = createServiceClient();
  const context = await loadTerminalOrder(supabase, String(body.orderId || ''));
  if (context instanceof Response) return context;
  const { order, vendor } = context;

  if (order.status !== 'initiated') {
    return json(
      { error: `La commande n'est pas en attente de paiement (${order.status})` },
      { status: 409 }
    );
  }

  // The amount is ALWAYS the order row's total. body.amount is ignored.
  const amount = Number(order.total_amount).toFixed(2);
  const env = getQontoEnv();

  let paymentId: string;
  if (env.mock) {
    paymentId = mockCreatePayment(amount).id;
  } else {
    const accessToken = await getAccessToken(supabase, vendor.id);
    const response = await qontoFetch(
      env,
      accessToken,
      `/v2/terminals/${encodeURIComponent(vendor.kiosk_terminal_id)}/payment`,
      {
        method: 'POST',
        headers: { 'X-Qonto-Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          amount: { value: amount, currency: 'EUR' },
          metadata: { order_id: order.id, order_number: order.order_number },
        }),
      }
    );
    const text = await response.text();
    if (!response.ok) {
      console.error('Qonto create payment failed:', response.status, text);
      return json(
        { error: 'Le terminal de paiement est indisponible' },
        { status: 502 }
      );
    }
    paymentId = JSON.parse(text)?.terminal_payment?.id;
    if (!paymentId) {
      console.error('Qonto create payment: no id in response:', text);
      return json(
        { error: 'Réponse inattendue du terminal de paiement' },
        { status: 502 }
      );
    }
  }

  const { error } = await supabase
    .from('orders')
    .update({
      terminal_payment_id: paymentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .eq('status', 'initiated');
  if (error) throw error;

  return json({ paymentId, amount });
}

async function handleGetPayment(body: any) {
  const supabase = createServiceClient();
  const context = await loadTerminalOrder(supabase, String(body.orderId || ''));
  if (context instanceof Response) return context;
  const { order, vendor } = context;

  const paymentId = String(body.paymentId || '');
  if (!paymentId) {
    return json({ error: 'paymentId est requis' }, { status: 400 });
  }
  // The payment must be the one this order's latest attempt created —
  // a client cannot settle order A with order B's payment.
  if (order.terminal_payment_id !== paymentId) {
    return json(
      { error: 'Paiement inconnu pour cette commande' },
      { status: 409 }
    );
  }

  const env = getQontoEnv();
  let payment: TerminalPaymentResult;
  if (env.mock) {
    payment = mockGetPayment(paymentId);
  } else {
    const accessToken = await getAccessToken(supabase, vendor.id);
    const response = await qontoFetch(
      env,
      accessToken,
      `/v2/terminal_payments/${encodeURIComponent(paymentId)}`
    );
    const text = await response.text();
    if (!response.ok) {
      console.error('Qonto get payment failed:', response.status, text);
      return json(
        { error: 'Impossible de vérifier le paiement' },
        { status: 502 }
      );
    }
    const raw = JSON.parse(text)?.terminal_payment ?? {};
    payment = {
      id: raw.id ?? paymentId,
      status: raw.status,
      failure_reason: raw.failure_reason ?? null,
      payment_method: raw.payment_method ?? null,
      card_summary: raw.card_summary ?? null,
    };
  }

  // Server-side success: flip initiated -> todo exactly once. The status
  // guard makes replays no-ops, so re-polls after success are idempotent.
  if (payment.status === 'AUTHORIZED' && order.status === 'initiated') {
    const { error } = await supabase
      .from('orders')
      .update({
        status: 'todo',
        pay_at_checkout: false,
        terminal_payment_method: payment.payment_method,
        terminal_card_summary: payment.card_summary,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('status', 'initiated');
    if (error) throw error;
  }

  return json({
    status: payment.status,
    failureReason: payment.failure_reason,
  });
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
    const action = String(body.action || '');
    if (action === 'create-payment') return await handleCreatePayment(body);
    if (action === 'get-payment') return await handleGetPayment(body);
    return json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('qonto-terminal error:', error);
    const status = typeof error?.status === 'number' ? error.status : 500;
    return json(
      { error: error?.message || 'Internal error' },
      { status }
    );
  }
});
