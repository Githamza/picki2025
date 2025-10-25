// Supabase Edge Function: Uber Eats webhook receiver
// URL pattern: /functions/v1/uber-webhook/:vendorId/deliveryupdates
// Updates public.order_deliveries based on Uber Eats delivery status events

// deno-lint-ignore-file no-explicit-any
// Ensure this function is public and CORS-enabled for any origin
// Declare Deno for local tooling
declare const Deno: any;
// @ts-ignore - remote import resolved by Deno at runtime
import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';
// @ts-ignore - remote import resolved by Deno at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type UberEventKind =
  | 'event.delivery_status'
  | 'event.courier_status'
  | 'event.refund';

type UberDeliveryStatus =
  | 'pending'
  | 'pickup'
  | 'pickup_complete'
  | 'dropoff'
  | 'delivered'
  | 'canceled'
  | 'returned';

interface UberLocation {
  lat: number;
  lng: number;
}

interface UberDetailedAddress {
  street_address_1: string;
  street_address_2?: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
}

interface UberVerificationBarcode {
  type: 'CODE39' | 'CODE39_FULL_ASCII' | 'CODE128' | 'QR';
  value: string;
  scan_result?: {
    outcome: 'SUCCESS' | 'FAILED';
    timestamp: string;
  };
}

interface UberVerificationSignature {
  image_url: string;
  signer_name: string;
  signer_relationship: string;
}

interface UberVerificationPicture {
  image_url: string;
}

interface UberVerificationPinCode {
  entered: string;
}

interface UberVerification {
  barcodes?: UberVerificationBarcode[];
  signature?: UberVerificationSignature;
  picture?: UberVerificationPicture;
  pin_code?: UberVerificationPinCode;
}

interface UberVerificationRequirements {
  signature?: boolean;
  signatureRequirement?: {
    collect_signer_name: boolean;
    collect_signer_relationship: boolean;
    enabled: boolean;
  };
  barcodes?: Array<{
    type: string;
    value: string;
  }>;
  picture?: boolean;
  pincode?: {
    enabled: boolean;
    value: string;
  };
}

interface UberWaypoint {
  address: string;
  detailed_address: UberDetailedAddress;
  location: UberLocation;
  name: string;
  notes?: string;
  phone_number: string;
  status: 'pending' | 'completed';
  status_timestamp?: string;
  verification?: UberVerification;
  verification_requirements?: UberVerificationRequirements;
  courier_notes?: string;
}

interface UberCourier {
  img_href?: string;
  location?: UberLocation;
  name?: string;
  phone_number?: string;
  rating?: string;
  vehicle_color?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_type?:
    | 'bicycle'
    | 'car'
    | 'van'
    | 'truck'
    | 'scooter'
    | 'motorcycle'
    | 'walker';
  unmarked_location_description?: string;
  public_phone_info?: {
    formatted_phone_number: string;
    phone_number: string;
    pin_code: string;
  };
  vehicle_license_plate?: string;
}

interface UberManifestItem {
  dimensions?: {
    depth: number;
    height: number;
    length: number;
  };
  must_be_upright?: boolean;
  name: string;
  price: number;
  quantity: number;
  size: 'small' | 'medium' | 'large' | 'xlarge';
  weight?: number;
}

interface UberManifest {
  description?: string;
  total_value: number;
  reference?: string;
}

interface UberCancelationReason {
  primary_reason: string;
  secondary_reason:
    | 'CUSTOMER_CANCEL'
    | 'COURIER_CANCEL'
    | 'MERCHANT_CANCEL'
    | 'UBER_CANCEL';
}

interface UberRelatedDelivery {
  id: string;
  relationship: 'original' | 'returned';
}

interface UberDeliveryData {
  id: string;
  status: UberDeliveryStatus;
  created: string;
  updated: string;
  pickup_eta?: string;
  pickup_ready: string;
  pickup_deadline: string;
  dropoff_eta?: string;
  dropoff_ready: string;
  dropoff_deadline: string;
  quote_id?: string;
  fee: number;
  currency: string;
  deliverable_action: string;
  tip?: number;
  manifest: UberManifest;
  manifest_items: UberManifestItem[];
  pickup: UberWaypoint;
  dropoff: UberWaypoint;
  return?: UberWaypoint;
  courier?: UberCourier;
  live_mode: boolean;
  related_deliveries?: UberRelatedDelivery[];
  tracking_url: string;
  courier_imminent: boolean;
  undeliverable_reason?: string;
  undeliverable_action?: string;
  complete: boolean;
  kind: 'delivery';
  uuid: string;
  batch_id?: string;
  route_id?: string;
  cancelation_reason?: UberCancelationReason;
  pickup_action?: string;
  external_id?: string;
}

interface UberWebhookBody {
  account_id: string;
  batch_id?: string;
  created: string;
  customer_id: string;
  data: UberDeliveryData;
  delivery_id: string;
  developer_id: string;
  id: string;
  kind: UberEventKind;
  live_mode: boolean;
  route_id?: string;
  status: UberDeliveryStatus;
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

function mapUberStatusToInternal(
  status: UberDeliveryStatus,
  courierImminent?: boolean
): string | null {
  console.log('[UberWebhook] Mapping status to internal:', {
    status,
    courierImminent,
  });

  switch (status) {
    case 'pending':
      return 'created';
    case 'pickup':
      if (courierImminent) {
        return 'arrived_at_pickup';
      }
      return 'en_route_to_pickup';
    case 'pickup_complete':
      return 'in_transit';
    case 'dropoff':
      if (courierImminent) {
        return 'arrived_at_dropoff';
      }
      return 'en_route_to_dropoff';
    case 'delivered':
      return 'delivered';
    case 'canceled':
      return 'cancelled';
    case 'returned':
      return 'returned';
    default:
      console.log('[UberWebhook] Unknown status, returning null');
      return null;
  }
}

serve(async (req: Request) => {
  console.log('[UberWebhook] Request received:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
  });

  if (req.method === 'OPTIONS') {
    console.log('[UberWebhook] Handling OPTIONS request');
    return new Response('ok', { headers: { ...corsHeaders } });
  }

  if (req.method !== 'POST') {
    console.log('[UberWebhook] Non-POST request, returning early');
    return json({ ok: true });
  }

  // Extract vendorId from URL path
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  console.log('[UberWebhook] URL parts:', parts);

  // .../functions/v1/uber-webhook/:vendorId/deliveryupdates
  const vendorIdIndex = parts.findIndex((p) => p === 'uber-webhook') + 1;
  const vendorId = parts[vendorIdIndex] || null;

  console.log('[UberWebhook] Extracted vendorId:', vendorId);

  if (!vendorId) {
    console.error('[UberWebhook] Missing vendorId in URL');
    return json({ error: 'Missing vendorId in URL' }, { status: 400 });
  }

  let body: UberWebhookBody;
  try {
    body = await req.json();
    console.log('[UberWebhook] Request body parsed successfully:', {
      kind: body.kind,
      status: body.status,
      delivery_id: body.delivery_id,
      event_id: body.id,
      created: body.created,
      courier_imminent: body.data?.courier_imminent,
      complete: body.data?.complete,
      live_mode: body.live_mode,
    });
  } catch (error) {
    console.error('[UberWebhook] Failed to parse JSON body:', error);
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Handle only delivery status events for now
  if (body.kind !== 'event.delivery_status') {
    console.log(
      '[UberWebhook] Non-delivery status event, ignoring:',
      body.kind
    );
    return json({
      ok: true,
      message: 'Event type not handled in this implementation',
    });
  }

  // Use local Supabase URL and service key if LOCALLY is true
  const isLocal = Deno.env.get('LOCALLY') === 'true';
  const supabaseUrl = isLocal 
    ? Deno.env.get('LOCAL_SUPABASE_URL') 
    : Deno.env.get('SUPABASE_URL');
  const serviceKey = isLocal 
    ? Deno.env.get('LOCAL_SUPABASE_SERVICE_ROLE_KEY') 
    : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  console.log('[UberWebhook] Environment check:', {
    hasSupabaseUrl: !!supabaseUrl,
    hasServiceKey: !!serviceKey,
    isLocal,
  });

  if (!supabaseUrl || !serviceKey) {
    console.error('[UberWebhook] Missing Supabase credentials');
    return json(
      { error: 'Supabase service credentials not set' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  console.log('[UberWebhook] Supabase client created successfully');

  try {
    const status = mapUberStatusToInternal(
      body.status,
      body.data?.courier_imminent
    );
    const deliveryId = body.delivery_id;

    console.log('[UberWebhook] Processing webhook:', {
      originalStatus: body.status,
      mappedStatus: status,
      deliveryId,
      vendorId,
      created: body.created,
      event_id: body.id,
      courier_imminent: body.data?.courier_imminent,
    });

    if (!deliveryId) {
      console.log('[UberWebhook] Missing delivery_id in webhook; body=', body);
      return json({ ok: true });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      occurred_at: body.created,
      event_id: body.id,
    };

    if (status) {
      updates['status'] = status;
    }

    // Store courier location if available
    if (body.data?.courier?.location) {
      updates['last_known_location'] = body.data.courier.location;
    }

    // Store tracking URL
    if (body.data?.tracking_url) {
      updates['tracking_url'] = body.data.tracking_url;
    }

    // Store ETA information
    if (body.data?.dropoff_eta) {
      try {
        // Parse ETA timestamp and calculate minutes from now
        const etaTime = new Date(body.data.dropoff_eta);
        const nowTime = new Date();
        const etaMinutes = Math.round(
          (etaTime.getTime() - nowTime.getTime()) / (1000 * 60)
        );
        updates['eta_minutes'] = etaMinutes > 0 ? etaMinutes : null;
      } catch (etaError) {
        console.log(
          '[UberWebhook] Failed to parse ETA timestamp:',
          body.data.dropoff_eta,
          etaError
        );
        updates['eta_minutes'] = null;
      }
    }

    // Attach complete payload for debugging and future reference
    updates['raw'] = body;

    console.log('[UberWebhook] Database updates to apply:', updates);

    // Update order_deliveries by delivery_id
    console.log('[UberWebhook] Updating order_deliveries table...');
    const { data, error: updErr } = await supabase
      .from('order_deliveries' as any)
      .update(updates)
      .eq('delivery_id', deliveryId)
      .select('id, delivery_id, status');

    if (updErr) {
      console.error('[UberWebhook] Database update error:', updErr);
      return json({ error: 'update_failed' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      console.warn(
        '[UberWebhook] No records found with delivery_id:',
        deliveryId
      );
      console.log('[UberWebhook] This might indicate:');
      console.log('- The delivery_id does not exist in order_deliveries table');
      console.log('- The delivery was created with a different ID');
      console.log(
        '- There is a mismatch between Uber delivery ID and our delivery_id'
      );
      return json({
        warning: 'no_records_updated',
        delivery_id: deliveryId,
        message: 'No matching records found to update',
      });
    }

    console.log(
      '[UberWebhook] Successfully updated order_deliveries for deliveryId:',
      deliveryId,
      'Updated records:',
      data.length,
      'Records:',
      data
    );
    return json({ ok: true, updated_records: data.length, records: data });
  } catch (e) {
    console.error('[UberWebhook] Unexpected error during processing:', e);
    return json({ error: 'internal_error' }, { status: 500 });
  }
});
