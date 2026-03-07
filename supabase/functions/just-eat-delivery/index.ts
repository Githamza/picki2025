// Supabase Edge Function: Just Eat DaaS delivery proxy
// Handles quote (estimate), create, status, and cancel actions.
//
// Just Eat DaaS differs from Stuart/Uber:
//   - Uses Keycloak client_credentials → short-lived JWT (expires_in: 300s)
//   - Vendor must be pre-registered as a "collect point" (pickup location)
//     identified by a UUID stored in vendor_just_eat_daas_settings
//   - Two-step flow: POST /daas/v3/request/estimate → requestId, then
//     POST /daas/v3/request/delivery using that requestId
//
// Required env vars:
//   JUST_EAT_DAAS_CLIENT_ID       — Keycloak client ID
//   JUST_EAT_DAAS_CLIENT_SECRET   — Keycloak client secret
//   JUST_EAT_DAAS_BASE_URL        — API base (default: https://uk.api.just-eat.io)
//   SUPABASE_URL / LOCAL_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY / LOCAL_SUPABASE_SERVICE_ROLE_KEY

// deno-lint-ignore-file no-explicit-any
declare const Deno: any;

// @ts-ignore - remote import resolved by Deno at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface Address {
  line1: string;
  postalCode: string;
  city: string;
  countryCode: string;
}

interface Coordinates {
  lat: number;
  lng: number;
}

interface ContactInfo {
  name: string;
  phone: string;
  email?: string;
}

interface DropoffInfo {
  address: Address;
  contact?: ContactInfo;
  coordinates?: Coordinates;
}

interface RequestBody {
  action: 'quote' | 'create' | 'status' | 'cancel';
  // For quote
  vendorId?: string;
  dropoff?: DropoffInfo;
  // For create
  requestId?: string;
  vendorOrderId?: string;
  orderValue?: number; // total order value in cents
  targetCollectTime?: string; // ISO 8601 UTC
  specialInstructions?: string;
  tip?: number; // in cents
  // For status / cancel
  deliveryId?: string; // alias for requestId in status/cancel context
}

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

// Obtain a short-lived Keycloak JWT for Just Eat DaaS
async function getJustEatToken(
  baseUrl: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const tokenUrl = `${baseUrl}/auth/realms/daas/protocol/openid-connect/token`;
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Just Eat DaaS auth failed: ${text}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

// Map Just Eat DaaS delivery status strings to our internal DeliveryStatusCode
function mapJustEatStatus(status: string): string {
  switch (status?.toUpperCase()) {
    case 'UNASSIGNED':
      return 'created';
    case 'ASSIGNED':
      return 'assigned';
    case 'IN_TRANSIT_TO_COLLECT':
      return 'en_route_to_pickup';
    case 'ARRIVED_TO_COLLECT':
      return 'arrived_at_pickup';
    case 'COLLECTED':
      return 'picked_up';
    case 'IN_TRANSIT_TO_DELIVER':
    case 'ARRIVED_TO_DELIVER':
      return 'en_route_to_dropoff';
    case 'DELIVERED':
      return 'delivered';
    case 'CANCELLED':
    case 'CANCELLATION_FAILURE':
      return 'cancelled';
    case 'UNKNOWN':
    default:
      return 'created';
  }
}

Deno.serve(async (req: Request) => {
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

  const BASE_URL =
    Deno.env.get('JUST_EAT_DAAS_BASE_URL') ?? 'https://uk.api.just-eat.io';
  const CLIENT_ID = Deno.env.get('JUST_EAT_DAAS_CLIENT_ID');
  const CLIENT_SECRET = Deno.env.get('JUST_EAT_DAAS_CLIENT_SECRET');

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return json(
      { error: 'Missing JUST_EAT_DAAS_CLIENT_ID / JUST_EAT_DAAS_CLIENT_SECRET env vars' },
      { status: 500 }
    );
  }

  // Set up Supabase client to look up vendor settings
  const isLocal = Deno.env.get('LOCALLY') === 'true';
  const supabaseUrl = isLocal
    ? Deno.env.get('LOCAL_SUPABASE_URL')
    : Deno.env.get('SUPABASE_URL');
  const serviceKey = isLocal
    ? Deno.env.get('LOCAL_SUPABASE_SERVICE_ROLE_KEY')
    : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Missing Supabase service credentials' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action } = body;
  if (!action) {
    return json({ error: 'Missing action field' }, { status: 400 });
  }

  try {
    console.log('[JustEat] Action:', action);

    const token = await getJustEatToken(BASE_URL, CLIENT_ID, CLIENT_SECRET);
    console.log('[JustEat] JWT acquired');

    // -----------------------------------------------------------------------
    // QUOTE — POST /daas/v3/request/estimate
    // -----------------------------------------------------------------------
    if (action === 'quote') {
      if (!body.vendorId) {
        return json({ error: 'vendorId is required for quote action' }, { status: 400 });
      }
      if (!body.dropoff?.address) {
        return json({ error: 'dropoff.address is required for quote action' }, { status: 400 });
      }

      // Look up the vendor's collect point ID from DB
      const { data: settings, error: settingsErr } = await supabase
        .from('vendor_just_eat_daas_settings')
        .select('collect_point_id')
        .eq('vendor_id', body.vendorId)
        .single();

      if (settingsErr || !settings?.collect_point_id) {
        console.error('[JustEat] Vendor not registered with Just Eat DaaS:', settingsErr);
        return json(
          { error: 'Vendor has no Just Eat DaaS collect point configured' },
          { status: 400 }
        );
      }

      const { collect_point_id: collectPointId } = settings;
      const { address, contact, coordinates } = body.dropoff;

      console.log('[JustEat] Estimating delivery for collectPointId:', collectPointId);
      console.log('[JustEat] Dropoff address:', address);

      const estimatePayload: Record<string, unknown> = {
        collect: { id: collectPointId },
        delivery: {
          name: contact?.name ?? 'Customer',
          emailAddress: contact?.email ?? '',
          phoneNumber: contact?.phone ?? '',
          address: address.line1,
          city: address.city,
          postalCode: address.postalCode,
          ...(coordinates && {
            geolocation: {
              coordinates: [coordinates.lng, coordinates.lat],
              type: 'point',
            },
          }),
        },
      };

      const estimateUrl = `${BASE_URL}/daas/v3/request/estimate`;
      console.log('[JustEat] Estimate URL:', estimateUrl);

      const res = await fetch(estimateUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(estimatePayload),
      });

      const text = await res.text();
      console.log('[JustEat] Estimate status:', res.status);
      console.log('[JustEat] Estimate response:', text);

      if (!res.ok) {
        return json({ error: 'estimate_failed', details: text }, { status: 500 });
      }

      const data = JSON.parse(text);
      // dynamicDeliveryFee is already in minor currency units (cents)
      const amountMinor: number = data?.dynamicDeliveryFee ?? 0;

      // Derive ETA minutes from estimated delivery times
      let etaMinutes: number | undefined;
      const deliverTimeStr = data?.estimatedEarliestDeliverTime;
      if (deliverTimeStr) {
        try {
          const deliverTime = new Date(deliverTimeStr);
          const now = new Date();
          const diff = Math.ceil((deliverTime.getTime() - now.getTime()) / (1000 * 60));
          etaMinutes = diff > 0 ? diff : undefined;
        } catch {
          // ignore
        }
      }

      return json({
        totalAmountMinor: amountMinor,
        currency: 'GBP', // Just Eat UK uses GBP; adjust per tenant if needed
        etaMinutes,
        raw: data, // contains requestId needed for create step
      });
    }

    // -----------------------------------------------------------------------
    // CREATE — POST /daas/v3/request/delivery
    // -----------------------------------------------------------------------
    if (action === 'create') {
      const requestId = body.requestId;
      if (!requestId) {
        return json(
          { error: 'requestId is required for create action (obtain from prior quote)' },
          { status: 400 }
        );
      }

      console.log('[JustEat] Creating delivery for requestId:', requestId);

      const deliveryPayload: Record<string, unknown> = { requestId };

      if (body.vendorOrderId) {
        deliveryPayload['vendorOrderId'] = body.vendorOrderId;
      }
      if (body.orderValue !== undefined) {
        deliveryPayload['orderValue'] = body.orderValue;
      }
      if (body.targetCollectTime) {
        deliveryPayload['targetCollectTime'] = body.targetCollectTime;
      }
      if (body.specialInstructions) {
        deliveryPayload['specialInstructions'] = body.specialInstructions;
      }
      if (body.tip !== undefined) {
        deliveryPayload['tip'] = body.tip;
      }

      const deliveryUrl = `${BASE_URL}/daas/v3/request/delivery`;
      console.log('[JustEat] Delivery URL:', deliveryUrl);
      console.log('[JustEat] Delivery payload:', JSON.stringify(deliveryPayload, null, 2));

      const res = await fetch(deliveryUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deliveryPayload),
      });

      const text = await res.text();
      console.log('[JustEat] Create status:', res.status);
      console.log('[JustEat] Create response:', text);

      if (!res.ok) {
        return json({ error: 'create_failed', details: text }, { status: 500 });
      }

      // Attempt to auto-register webhook if vendorId provided
      if (body.vendorId) {
        try {
          await ensureWebhookRegistered(req, BASE_URL, token, body.vendorId);
        } catch (webhookErr) {
          console.error('[JustEat] Webhook registration error (non-blocking):', webhookErr);
        }
      }

      // requestId is the central delivery identifier for Just Eat DaaS
      // We use it as both deliveryId and the key for status/cancel
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {}

      return json({
        deliveryId: requestId, // requestId is the persistent identifier
        jobId: null,
        trackingUrl: data?.orderTrackerURL ?? null,
        raw: data,
      });
    }

    // -----------------------------------------------------------------------
    // STATUS — GET /daas/v3/request/{requestId}/status
    // -----------------------------------------------------------------------
    if (action === 'status') {
      const requestId = body.deliveryId ?? body.requestId;
      if (!requestId) {
        return json({ error: 'deliveryId (requestId) is required for status action' }, { status: 400 });
      }

      const statusUrl = `${BASE_URL}/daas/v3/request/${encodeURIComponent(requestId)}/status`;
      console.log('[JustEat] Status URL:', statusUrl);

      const res = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const text = await res.text();
      console.log('[JustEat] Status response status:', res.status);
      console.log('[JustEat] Status response:', text);

      if (!res.ok) {
        return json({ error: 'status_failed', details: text }, { status: 500 });
      }

      const data = JSON.parse(text);
      const rawStatus = data?.status ?? 'UNKNOWN';
      const mapped = mapJustEatStatus(rawStatus);

      return json({
        status: mapped,
        updatedAtIso: new Date().toISOString(),
        trackingUrl: data?.orderTrackerURL ?? null,
        raw: data,
      });
    }

    // -----------------------------------------------------------------------
    // CANCEL — POST /daas/v3/request/{requestId}/cancel
    // -----------------------------------------------------------------------
    if (action === 'cancel') {
      const requestId = body.deliveryId ?? body.requestId;
      if (!requestId) {
        return json({ error: 'deliveryId (requestId) is required for cancel action' }, { status: 400 });
      }

      const cancelUrl = `${BASE_URL}/daas/v3/request/${encodeURIComponent(requestId)}/cancel`;
      console.log('[JustEat] Cancel URL:', cancelUrl);

      const cancelPayload = { requestId };
      const res = await fetch(cancelUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cancelPayload),
      });

      const text = await res.text();
      console.log('[JustEat] Cancel status:', res.status);
      console.log('[JustEat] Cancel response:', text);

      if (!res.ok) {
        return json({ error: 'cancel_failed', details: text }, { status: 500 });
      }

      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {}

      return json({
        cancelled: true,
        message: data?.message ?? 'Cancellation requested',
        raw: data,
      });
    }

    return json({ error: 'Unsupported action' }, { status: 400 });
  } catch (e) {
    console.error('[JustEat] Error:', e);
    return json({ error: 'internal_error', details: String(e) }, { status: 500 });
  }
});

// Register webhook notification config with Just Eat DaaS if not already set up.
// Just Eat DaaS requires an explicit POST to /daas/v3/notification-config.
// Uses BASIC auth type with a secret derived from vendor ID for simplicity.
async function ensureWebhookRegistered(
  req: Request,
  baseUrl: string,
  token: string,
  vendorId: string
): Promise<void> {
  const functionsBase = new URL(req.url).origin;
  const webhookUrl = `${functionsBase}/functions/v1/just-eat-webhook/${vendorId}/deliveryupdates`;

  // Check if notification config already exists
  const getUrl = `${baseUrl}/daas/v3/notification-config`;
  const getRes = await fetch(getUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (getRes.ok) {
    const existing = await getRes.json();
    if (existing?.endpoint && existing.endpoint.includes(vendorId)) {
      console.log('[JustEat] Webhook already registered for vendor:', vendorId);
      return;
    }
  }

  // Register the webhook notification config
  const notifPayload = {
    email: `webhook+${vendorId}@picki.app`,
    endpoint: webhookUrl,
    secret: `picki-${vendorId}`,
    type: 'TOKEN',
    subscriptions: [
      'COURIERJOBSTATUS',
      'CANCELJOBSTATUS',
      'COURIERCOLLECTIONTIME',
      'COURIERLOCATION',
      'DELIVERYREJECTED',
    ],
  };

  const notifRes = await fetch(`${baseUrl}/daas/v3/notification-config`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(notifPayload),
  });

  const notifText = await notifRes.text();
  if (!notifRes.ok) {
    console.error('[JustEat] Webhook registration failed:', notifText);
  } else {
    console.log('[JustEat] Webhook registered for vendor:', vendorId, notifText);
  }
}
