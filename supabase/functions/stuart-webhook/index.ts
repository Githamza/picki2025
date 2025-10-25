// Supabase Edge Function: Stuart webhook receiver
// URL pattern: /functions/v1/stuart-webhook/:vendorId/deliveryupdates
// Updates public.order_deliveries based on Stuart push events

// deno-lint-ignore-file no-explicit-any
// Ensure this function is public and CORS-enabled for any origin
// Declare Deno for local tooling
declare const Deno: any;
// @ts-ignore - remote import resolved by Deno at runtime
import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';
// @ts-ignore - remote import resolved by Deno at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type StuartTopic =
  | 'package_created'
  | 'courier_assigned'
  | 'courier_arriving'
  | 'courier_waiting'
  | 'courier_moving'
  | 'package_delivering'
  | 'package_delivered'
  | 'package_canceled'
  | 'package_returning'
  | 'package_returned'
  | 'package_split'
  | 'courier_reassigning';

interface StuartAccount {
  id: number;
}

interface StuartPackage {
  id: string;
  reference?: string;
  client_tracking_url?: string;
  end_customer_tracking_url?: string;
}

interface StuartCourier {
  name?: string;
}

interface StuartProximityRadius {
  value: number;
  unit: string;
}

interface StuartCoordinates {
  latitude: number;
  longitude: number;
}

interface StuartCancelation {
  actor: string;
  reason: string;
  key: string;
  comment?: string | null;
}

interface StuartSplit {
  reason: string;
}

interface StuartNewPackage {
  id: string;
}

interface StuartWebhookDetails {
  account: StuartAccount;
  package?: StuartPackage;
  courier?: StuartCourier;
  proximity_radius?: StuartProximityRadius;
  coordinates?: StuartCoordinates;
  cancelation?: StuartCancelation;
  split?: StuartSplit;
  new_package?: StuartNewPackage;
  task?: 'pickup' | 'dropoff';
}

interface StuartWebhookBody {
  version: string;
  occurred_at: string;
  event_id: string;
  webhook_id: number;
  topic: StuartTopic;
  details: StuartWebhookDetails;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
    ...init,
  });

function mapTopicToStatus(topic: StuartTopic): string | null {
  console.log('[StuartWebhook] Mapping topic to status:', topic);
  switch (topic) {
    case 'package_created':
      return 'created';
    case 'courier_assigned':
      return 'assigned';
    case 'courier_arriving':
      return 'en_route_to_pickup';
    case 'courier_waiting':
      return 'arrived_at_pickup';
    case 'courier_moving':
      return 'in_transit';
    case 'package_delivering':
      return 'en_route_to_dropoff';
    case 'package_delivered':
      return 'delivered';
    case 'package_canceled':
      return 'cancelled';
    case 'package_returning':
      return 'returning';
    case 'package_returned':
      return 'returned';
    case 'package_split':
      return 'split';
    case 'courier_reassigning':
      return 'reassigning';
    default:
      console.log('[StuartWebhook] Unknown topic, returning null');
      return null;
  }
}

serve(async (req: Request) => {
  console.log('[StuartWebhook] Request received:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
  });

  if (req.method === 'OPTIONS') {
    console.log('[StuartWebhook] Handling OPTIONS request');
    return new Response('ok', { headers: { ...corsHeaders } });
  }

  if (req.method !== 'POST') {
    console.log('[StuartWebhook] Non-POST request, returning early');
    return json({ ok: true });
  }

  // Extract vendorId from URL path
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  console.log('[StuartWebhook] URL parts:', parts);

  // .../functions/v1/stuart-webhook/:vendorId/deliveryupdates
  const vendorIdIndex = parts.findIndex((p) => p === 'stuart-webhook') + 1;
  const vendorId = parts[vendorIdIndex] || null;

  console.log('[StuartWebhook] Extracted vendorId:', vendorId);

  if (!vendorId) {
    console.error('[StuartWebhook] Missing vendorId in URL');
    return json({ error: 'Missing vendorId in URL' }, { status: 400 });
  }

  let body: StuartWebhookBody;
  try {
    body = await req.json();
    console.log('[StuartWebhook] Request body parsed successfully:', {
      version: body.version,
      topic: body.topic,
      event_id: body.event_id,
      webhook_id: body.webhook_id,
      occurred_at: body.occurred_at,
      packageId: body.details?.package?.id,
      accountId: body.details?.account?.id,
      hasCourier: !!body.details?.courier,
      task: body.details?.task,
    });
  } catch (error) {
    console.error('[StuartWebhook] Failed to parse JSON body:', error);
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Use local Supabase URL and service key if LOCALLY is true
  const isLocal = Deno.env.get('LOCALLY') === 'true';
  const supabaseUrl = isLocal 
    ? Deno.env.get('LOCAL_SUPABASE_URL') 
    : Deno.env.get('SUPABASE_URL');
  const serviceKey = isLocal 
    ? Deno.env.get('LOCAL_SUPABASE_SERVICE_ROLE_KEY') 
    : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  console.log('[StuartWebhook] Environment check:', {
    hasSupabaseUrl: !!supabaseUrl,
    hasServiceKey: !!serviceKey,
    isLocal,
  });

  if (!supabaseUrl || !serviceKey) {
    console.error('[StuartWebhook] Missing Supabase credentials');
    return json(
      { error: 'Supabase service credentials not set' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  console.log('[StuartWebhook] Supabase client created successfully');

  try {
    const topic = body.topic;
    const status = mapTopicToStatus(topic);
    const packageId = body.details?.package?.id ?? null;

    console.log('[StuartWebhook] Processing webhook:', {
      topic,
      mappedStatus: status,
      packageId,
      vendorId,
      occurred_at: body.occurred_at,
      event_id: body.event_id,
    });

    if (!packageId) {
      console.log('[StuartWebhook] Missing package.id in details; body=', body);
      return json({ ok: true });
    }

    // Stuart package.id corresponds to deliveries.id from create job response
    const deliveryId = String(packageId);
    console.log('[StuartWebhook] Using deliveryId:', deliveryId);

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      occurred_at: body.occurred_at,
      event_id: body.event_id,
    };
    if (status) updates['status'] = status;

    // Store coordinates if available (for courier_moving events)
    if (body.details?.coordinates) {
      updates['last_known_location'] = body.details.coordinates;
    }

    // Store task information if available
    if (body.details?.task) {
      updates['current_task'] = body.details.task;
    }

    // Attach last payload for debugging
    updates['raw'] = body;

    console.log('[StuartWebhook] Database updates to apply:', updates);

    // Update order_deliveries by delivery_id; optionally scope by vendor using a join if needed
    // We assume delivery_id is unique
    console.log('[StuartWebhook] Updating order_deliveries table...');
    const {
      data,
      error: updErr,
      count,
    } = await supabase
      .from('order_deliveries' as any)
      .update(updates)
      .eq('delivery_id', deliveryId)
      .select('id, delivery_id, status');

    if (updErr) {
      console.error('[StuartWebhook] Database update error:', updErr);
      return json({ error: 'update_failed' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      console.warn(
        '[StuartWebhook] No records found with delivery_id:',
        deliveryId
      );
      console.log('[StuartWebhook] This might indicate:');
      console.log('- The delivery_id does not exist in order_deliveries table');
      console.log('- The delivery was created with a different ID');
      console.log(
        '- There is a mismatch between Stuart package ID and our delivery_id'
      );
      return json({
        warning: 'no_records_updated',
        delivery_id: deliveryId,
        message: 'No matching records found to update',
      });
    }

    console.log(
      '[StuartWebhook] Successfully updated order_deliveries for deliveryId:',
      deliveryId,
      'Updated records:',
      data.length,
      'Records:',
      data
    );
    return json({ ok: true, updated_records: data.length, records: data });
  } catch (e) {
    console.error('[StuartWebhook] Unexpected error during processing:', e);
    return json({ error: 'internal_error' }, { status: 500 });
  }
});
