// Supabase Edge Function: Just Eat DaaS webhook receiver
// URL pattern: /functions/v1/just-eat-webhook/:vendorId/deliveryupdates
//
// Just Eat DaaS pushes the following event types:
//   COURIERJOBSTATUS      — delivery status change (primary status driver)
//   CANCELJOBSTATUS       — cancellation outcome
//   COURIERCOLLECTIONTIME — courier ETA to collect point
//   COURIERLOCATION       — courier GPS coordinates
//   DELIVERYCREATED       — delivery accepted confirmation
//   DELIVERYREJECTED      — delivery rejected
//
// All events share the envelope:
//   { id, type, timestamp, data: { requestId, ... } }
//
// The requestId is used as delivery_id in the order_deliveries table.

// deno-lint-ignore-file no-explicit-any
declare const Deno: any;

// @ts-ignore - remote import resolved by Deno at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type JustEatEventType =
  | 'COURIERJOBSTATUS'
  | 'CANCELJOBSTATUS'
  | 'COURIERCOLLECTIONTIME'
  | 'COURIERLOCATION'
  | 'DELIVERYCREATED'
  | 'DELIVERYREJECTED';

type JustEatDeliveryStatus =
  | 'UNASSIGNED'
  | 'ASSIGNED'
  | 'IN_TRANSIT_TO_COLLECT'
  | 'ARRIVED_TO_COLLECT'
  | 'COLLECTED'
  | 'IN_TRANSIT_TO_DELIVER'
  | 'ARRIVED_TO_DELIVER'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'CANCELLATION_FAILURE'
  | 'UNKNOWN';

// COURIERJOBSTATUS payload
interface CourierJobStatusData {
  status: JustEatDeliveryStatus;
  orderId?: string;
  requestId: string;
  orderTrackerURL?: string;
  courier?: {
    name?: string;
  };
}

// CANCELJOBSTATUS payload
interface CancelJobStatusData {
  status: boolean;
  message?: string;
  requestId: string;
}

// COURIERCOLLECTIONTIME payload
interface CourierCollectionTimeData {
  courierETA: string; // ISO 8601 UTC
  requestId: string;
}

// COURIERLOCATION payload
interface CourierLocationData {
  latitude: number;
  longitude: number;
  requestId: string;
}

// DELIVERYCREATED payload
interface DeliveryCreatedData {
  requestId: string;
  orderNumber?: number;
}

// DELIVERYREJECTED payload
interface DeliveryRejectedData {
  requestId: string;
  message?: string;
}

type JustEatEventData =
  | CourierJobStatusData
  | CancelJobStatusData
  | CourierCollectionTimeData
  | CourierLocationData
  | DeliveryCreatedData
  | DeliveryRejectedData;

interface JustEatWebhookBody {
  id: string;
  type: JustEatEventType;
  timestamp: string;
  data: JustEatEventData;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    ...init,
  });

function mapJustEatStatusToInternal(status: JustEatDeliveryStatus): string {
  switch (status) {
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
  console.log('[JustEatWebhook] Request received:', {
    method: req.method,
    url: req.url,
  });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeaders } });
  }

  if (req.method !== 'POST') {
    return json({ ok: true });
  }

  // Extract vendorId from URL path
  // URL pattern: .../functions/v1/just-eat-webhook/:vendorId/deliveryupdates
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const handlerIndex = parts.findIndex((p) => p === 'just-eat-webhook') + 1;
  const vendorId = parts[handlerIndex] || null;

  console.log('[JustEatWebhook] Extracted vendorId:', vendorId);

  if (!vendorId) {
    return json({ error: 'Missing vendorId in URL' }, { status: 400 });
  }

  let body: JustEatWebhookBody;
  try {
    body = await req.json();
    console.log('[JustEatWebhook] Event received:', {
      type: body.type,
      id: body.id,
      timestamp: body.timestamp,
    });
  } catch (err) {
    console.error('[JustEatWebhook] Failed to parse JSON:', err);
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Set up Supabase client
  const isLocal = Deno.env.get('LOCALLY') === 'true';
  const supabaseUrl = isLocal
    ? Deno.env.get('LOCAL_SUPABASE_URL')
    : Deno.env.get('SUPABASE_URL');
  const serviceKey = isLocal
    ? Deno.env.get('LOCAL_SUPABASE_SERVICE_ROLE_KEY')
    : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    console.error('[JustEatWebhook] Missing Supabase credentials');
    return json({ error: 'Supabase service credentials not set' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { type, data, id: eventId, timestamp } = body;
    const requestId = (data as any)?.requestId;

    if (!requestId) {
      console.warn('[JustEatWebhook] Event missing requestId:', body);
      return json({ ok: true, warning: 'no requestId in event data' });
    }

    console.log('[JustEatWebhook] Processing event:', {
      type,
      requestId,
      eventId,
    });

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      occurred_at: timestamp,
      event_id: eventId,
      raw: body,
    };

    switch (type) {
      case 'COURIERJOBSTATUS': {
        const d = data as CourierJobStatusData;
        updates['status'] = mapJustEatStatusToInternal(d.status);
        if (d.orderTrackerURL) {
          updates['tracking_url'] = d.orderTrackerURL;
        }
        break;
      }

      case 'CANCELJOBSTATUS': {
        updates['status'] = 'cancelled';
        break;
      }

      case 'COURIERCOLLECTIONTIME': {
        const d = data as CourierCollectionTimeData;
        if (d.courierETA) {
          try {
            const etaTime = new Date(d.courierETA);
            const now = new Date();
            const etaMinutes = Math.ceil(
              (etaTime.getTime() - now.getTime()) / (1000 * 60)
            );
            updates['eta_minutes'] = etaMinutes > 0 ? etaMinutes : null;
          } catch {
            updates['eta_minutes'] = null;
          }
        }
        break;
      }

      case 'COURIERLOCATION': {
        const d = data as CourierLocationData;
        if (d.latitude !== undefined && d.longitude !== undefined) {
          updates['last_known_location'] = {
            lat: d.latitude,
            lng: d.longitude,
          };
        }
        break;
      }

      case 'DELIVERYCREATED': {
        updates['status'] = 'created';
        break;
      }

      case 'DELIVERYREJECTED': {
        updates['status'] = 'failed';
        break;
      }

      default:
        console.log('[JustEatWebhook] Unhandled event type:', type);
        return json({ ok: true, message: 'Event type not handled' });
    }

    // Update order_deliveries by delivery_id (which is the requestId for Just Eat)
    const { data: updated, error: updErr } = await supabase
      .from('order_deliveries' as any)
      .update(updates)
      .eq('delivery_id', requestId)
      .select('id, delivery_id, status');

    if (updErr) {
      console.error('[JustEatWebhook] Database update error:', updErr);
      return json({ error: 'update_failed' }, { status: 500 });
    }

    if (!updated || updated.length === 0) {
      console.warn(
        '[JustEatWebhook] No records found with delivery_id (requestId):',
        requestId
      );
      return json({
        warning: 'no_records_updated',
        requestId,
        message: 'No matching order_deliveries record found',
      });
    }

    console.log(
      '[JustEatWebhook] Updated order_deliveries for requestId:',
      requestId,
      'records:',
      updated.length
    );

    return json({ ok: true, updated_records: updated.length });
  } catch (e) {
    console.error('[JustEatWebhook] Unexpected error:', e);
    return json({ error: 'internal_error' }, { status: 500 });
  }
});
