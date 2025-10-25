import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';

interface Address {
  line1: string;
  postalCode: string;
  city: string;
  countryCode: string;
}

interface ContactInfo {
  name: string;
  phone_number: string;
}

interface ManifestItem {
  name: string;
  quantity: number;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  price?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  weight?: number;
}

interface Body {
  action: 'quote' | 'create' | 'status';
  pickup?: {
    address: Address;
    contact?: ContactInfo;
    business_name?: string;
    latitude?: number;
    longitude?: number;
    notes?: string;
  };
  dropoff?: {
    address: Address;
    contact?: ContactInfo;
    business_name?: string;
    latitude?: number;
    longitude?: number;
    notes?: string;
    seller_notes?: string;
  };
  manifest_items?: ManifestItem[];
  external_store_id?: string;
  pickup_ready_dt?: string;
  pickup_deadline_dt?: string;
  dropoff_ready_dt?: string;
  dropoff_deadline_dt?: string;
  deliverable_action?:
    | 'deliverable_action_meet_at_door'
    | 'deliverable_action_leave_at_door';
  undeliverable_action?: 'leave_at_door' | 'return' | 'discard';
  manifest_reference?: string;
  manifest_total_value?: number;
  quote_id?: string;
  tip?: number;
  idempotency_key?: string;
  external_id?: string;
  // For status action
  delivery_id?: string;
  // For testing with Robo Courier
  test_specifications?: {
    robo_courier_specification?: {
      mode: 'auto';
    };
  };
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

function full(a: Address): string {
  return `${a.line1}, ${a.postalCode} ${a.city}, ${a.countryCode}`;
}

function toUberAddressObject(a: Address): Record<string, unknown> {
  const out: Record<string, unknown> = {
    street_address: [a.line1],
    city: a.city,
    zip_code: a.postalCode,
    country: a.countryCode,
  };
  // Optional: add state if the country uses it and you have it
  // out.state = a.state;
  return out;
}

async function getUberToken(
  authBaseUrl: string,
  clientId: string,
  clientSecret: string,
  customerId: string
): Promise<string> {
  // Uber Direct uses client credentials with customer id; real implementation here
  const res = await fetch(`${authBaseUrl}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'eats.deliveries',
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.access_token as string;
}

serve(async (req: Request) => {
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
  if (req.method !== 'POST')
    return json({ error: 'Method Not Allowed' }, { status: 405 });

  const UBER_BASE =
    Deno.env.get('UBER_DIRECT_API_BASE_URL') ?? 'https://api.uber.com';
  const UBER_AUTH_BASE =
    Deno.env.get('UBER_DIRECT_AUTH_BASE_URL') ?? 'https://login.uber.com';
  const UBER_CLIENT_ID = Deno.env.get('UBER_DIRECT_CLIENT_ID');
  const UBER_CLIENT_SECRET = Deno.env.get('UBER_DIRECT_CLIENT_SECRET');
  const UBER_CUSTOMER_ID = Deno.env.get('UBER_DIRECT_CUSTOMER_ID');
  if (!UBER_CLIENT_ID || !UBER_CLIENT_SECRET || !UBER_CUSTOMER_ID) {
    return json({ error: 'Missing Uber Direct env vars' }, { status: 500 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, pickup, dropoff, manifest_items, delivery_id } = body;

  // Validate required fields based on action
  if (!action) {
    return json({ error: 'Missing action field' }, { status: 400 });
  }

  if (action === 'status') {
    if (!delivery_id) {
      return json(
        {
          error: 'Missing delivery_id',
          details: 'delivery_id is required for status action',
          example_request: {
            action: 'status',
            delivery_id: 'del_ExampleDeliveryId123',
          },
        },
        { status: 400 }
      );
    }
  } else {
    // For quote and create actions, require pickup and dropoff addresses
    if (!pickup?.address || !dropoff?.address) {
      return json(
        { error: 'Missing pickup or dropoff address' },
        { status: 400 }
      );
    }
  }

  // For create action, validate required contact info and manifest_items
  if (action === 'create') {
    if (!pickup?.contact?.name || !pickup?.contact?.phone_number) {
      return json(
        {
          error: 'Missing pickup contact info',
          details:
            'pickup.contact.name and pickup.contact.phone_number are required for create action',
          received: {
            pickup_contact_name: pickup?.contact?.name || 'undefined/missing',
            pickup_contact_phone_number:
              pickup?.contact?.phone_number || 'undefined/missing',
            has_pickup_object: !!pickup,
            has_pickup_contact_object: !!pickup?.contact,
          },
          required_format: {
            pickup: {
              contact: {
                name: 'string (required)',
                phone_number: 'string (required, format: +[0-9]+)',
              },
            },
          },
          example_request: {
            action: 'create',
            pickup: {
              address: {
                line1: '123 Restaurant Street',
                postalCode: '75001',
                city: 'Paris',
                countryCode: 'FR',
              },
              contact: {
                name: 'Restaurant Name',
                phone_number: '+33123456789',
              },
            },
            dropoff: {
              address: {
                line1: '456 Customer Street',
                postalCode: '75002',
                city: 'Paris',
                countryCode: 'FR',
              },
              contact: {
                name: 'Customer Name',
                phone_number: '+33987654321',
              },
            },
            manifest_items: [
              {
                name: 'Food Order #123',
                quantity: 1,
              },
            ],
          },
        },
        { status: 400 }
      );
    }
    if (!dropoff?.contact?.name || !dropoff?.contact?.phone_number) {
      return json(
        {
          error: 'Missing dropoff contact info',
          details:
            'dropoff.contact.name and dropoff.contact.phone_number are required for create action',
          required_format: {
            dropoff: {
              contact: {
                name: 'string (required)',
                phone_number: 'string (required, format: +[0-9]+)',
              },
            },
          },
        },
        { status: 400 }
      );
    }
    if (!manifest_items || manifest_items.length === 0) {
      console.log('[UberDirect] manifest_items validation failed');
      console.log('[UberDirect] manifest_items received:', manifest_items);
      console.log('[UberDirect] manifest_items type:', typeof manifest_items);
      console.log(
        '[UberDirect] manifest_items length:',
        manifest_items?.length
      );
      return json(
        {
          error: 'Missing manifest_items',
          details: 'At least one manifest item is required for create action',
          received: {
            manifest_items: manifest_items || 'undefined/missing',
            manifest_items_length: manifest_items?.length || 0,
            manifest_items_type: typeof manifest_items,
          },
          required_format: {
            manifest_items: [
              {
                name: 'string (required)',
                quantity: 'number (required)',
              },
            ],
          },
          example_request: {
            action: 'create',
            manifest_items: [
              {
                name: 'Food Order #123',
                quantity: 1,
                size: 'medium',
              },
            ],
          },
        },
        { status: 400 }
      );
    }
  }

  try {
    console.log('[UberDirect] Incoming action:', action);
    if (pickup?.address) {
      console.log('[UberDirect] Pickup:', full(pickup.address));
    }
    if (dropoff?.address) {
      console.log('[UberDirect] Dropoff:', full(dropoff.address));
    }

    const token = await getUberToken(
      UBER_AUTH_BASE,
      UBER_CLIENT_ID,
      UBER_CLIENT_SECRET,
      UBER_CUSTOMER_ID
    );
    console.log(
      '[UberDirect] OAuth token acquired. length=',
      token?.length ?? 0
    );

    if (action === 'quote') {
      // Uber Direct DaaS: delivery quotes
      // Endpoint example: POST /v1/customers/{customer_id}/delivery_quotes
      if (!pickup || !dropoff) {
        return json(
          { error: 'Missing pickup or dropoff for quote action' },
          { status: 400 }
        );
      }

      console.log(
        '[UberDirect] Getting quote with token length:',
        token?.length ?? 0
      );
      const url = `${UBER_BASE}/v1/customers/${UBER_CUSTOMER_ID}/delivery_quotes`;
      const payload = {
        pickup_address: JSON.stringify(toUberAddressObject(pickup.address)),
        dropoff_address: JSON.stringify(toUberAddressObject(dropoff.address)),
      } as Record<string, unknown>;

      // Add optional fields for more accurate quotes
      if (pickup.latitude && pickup.longitude) {
        payload['pickup_latitude'] = pickup.latitude;
        payload['pickup_longitude'] = pickup.longitude;
      }
      if (dropoff.latitude && dropoff.longitude) {
        payload['dropoff_latitude'] = dropoff.latitude;
        payload['dropoff_longitude'] = dropoff.longitude;
      }
      if (body.external_store_id) {
        payload['external_store_id'] = body.external_store_id;
      }

      console.log('[UberDirect] Quote URL:', url);
      console.log(
        '[UberDirect] Quote payload:',
        JSON.stringify(payload, null, 2)
      );

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      console.log('[UberDirect] Quote status:', res.status);
      console.log('[UberDirect] Quote response:', text);

      if (!res.ok)
        return json({ error: 'quote_failed', details: text }, { status: 500 });
      const data = JSON.parse(text);
      // Try common shapes
      const fee = data?.fee || data?.price || data?.estimated_fee;
      const amountMinor =
        typeof fee?.amount === 'number' ? Math.round(fee.amount) : 0;
      const currency = fee?.currency_code || fee?.currency || 'EUR';
      const etaMinutes =
        data?.eta_minutes ||
        data?.eta_in_minutes ||
        data?.estimated_time_minutes;
      // if fee is more than 1000 return error
      console.log('[UberDirect] Amount Minor:', amountMinor);
      if (data?.fee > 1000) {
        return json(
          { error: 'fee_too_high', details: 'Fee is too high' },
          { status: 500 }
        );
      }
      return json({
        totalAmountMinor: amountMinor,
        currency,
        etaMinutes,
        raw: data,
      });
    }

    if (action === 'create') {
      // Uber Direct DaaS: create delivery
      // Endpoint example: POST /v1/customers/{customer_id}/deliveries
      if (!pickup || !dropoff) {
        return json(
          { error: 'Missing pickup or dropoff for create action' },
          { status: 400 }
        );
      }

      const url = `${UBER_BASE}/v1/customers/${UBER_CUSTOMER_ID}/deliveries`;

      const payload = {
        // Required fields
        pickup_name: pickup.contact!.name,
        pickup_address: JSON.stringify(toUberAddressObject(pickup.address)),
        pickup_phone_number: pickup.contact!.phone_number,
        dropoff_name: dropoff.contact!.name,
        dropoff_address: JSON.stringify(toUberAddressObject(dropoff.address)),
        dropoff_phone_number: dropoff.contact!.phone_number,
        manifest_items: manifest_items!.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          size: item.size || 'medium',
          ...(item.price && { price: item.price }),
          ...(item.dimensions && { dimensions: item.dimensions }),
          ...(item.weight && { weight: item.weight }),
        })),
      } as Record<string, unknown>;

      // Add optional pickup fields
      if (pickup.business_name) {
        payload['pickup_business_name'] = pickup.business_name;
      }
      if (pickup.latitude) {
        payload['pickup_latitude'] = pickup.latitude;
      }
      if (pickup.longitude) {
        payload['pickup_longitude'] = pickup.longitude;
      }
      if (pickup.notes) {
        payload['pickup_notes'] = pickup.notes;
      }

      // Add optional dropoff fields
      if (dropoff.business_name) {
        payload['dropoff_business_name'] = dropoff.business_name;
      }
      if (dropoff.latitude) {
        payload['dropoff_latitude'] = dropoff.latitude;
      }
      if (dropoff.longitude) {
        payload['dropoff_longitude'] = dropoff.longitude;
      }
      if (dropoff.notes) {
        payload['dropoff_notes'] = dropoff.notes;
      }
      if (dropoff.seller_notes) {
        payload['dropoff_seller_notes'] = dropoff.seller_notes;
      }

      // Add other optional fields
      if (body.external_store_id) {
        payload['external_store_id'] = body.external_store_id;
      }
      if (body.pickup_ready_dt) {
        payload['pickup_ready_dt'] = body.pickup_ready_dt;
      }
      if (body.pickup_deadline_dt) {
        payload['pickup_deadline_dt'] = body.pickup_deadline_dt;
      }
      if (body.dropoff_ready_dt) {
        payload['dropoff_ready_dt'] = body.dropoff_ready_dt;
      }
      if (body.dropoff_deadline_dt) {
        payload['dropoff_deadline_dt'] = body.dropoff_deadline_dt;
      }
      if (body.deliverable_action) {
        payload['deliverable_action'] = body.deliverable_action;
      }
      if (body.undeliverable_action) {
        payload['undeliverable_action'] = body.undeliverable_action;
      }
      if (body.manifest_reference) {
        payload['manifest_reference'] = body.manifest_reference;
      }
      if (body.manifest_total_value) {
        payload['manifest_total_value'] = body.manifest_total_value;
      }
      if (body.quote_id) {
        payload['quote_id'] = body.quote_id;
      }
      if (body.tip) {
        payload['tip'] = body.tip;
      }
      if (body.idempotency_key) {
        payload['idempotency_key'] = body.idempotency_key;
      }
      if (body.external_id) {
        payload['external_id'] = body.external_id;
      }

      // Add test specifications for Robo Courier (automatic test delivery)
      if (body.test_specifications) {
        payload['test_specifications'] = body.test_specifications;
        console.log(
          '[UberDirect] Enabling Robo Courier for automatic test delivery'
        );
      } else if (Deno.env.get('ENVIRONMENT') !== 'production') {
        // Automatically enable Robo Courier in non-production environments
        payload['test_specifications'] = {
          robo_courier_specification: {
            mode: 'auto',
          },
        };
        console.log(
          '[UberDirect] Auto-enabling Robo Courier for non-production environment'
        );
      }

      console.log('[UberDirect] Create URL:', url);
      console.log(
        '[UberDirect] Create payload:',
        JSON.stringify(payload, null, 2)
      );

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      console.log('[UberDirect] Create status:', res.status);
      console.log('[UberDirect] Create response:', text);

      if (!res.ok) {
        console.log('[UberDirect] Create error:', res.status, res.statusText);
        return json({ error: 'create_failed', details: text }, { status: 500 });
      }
      const data = JSON.parse(text);
      const deliveryId = data?.id || data?.delivery_id || null;
      const trackingUrl = data?.tracking_url || null;
      return json({ deliveryId, trackingUrl, raw: data });
    }

    if (action === 'status') {
      // Uber Direct DaaS: get delivery status
      // Endpoint: GET /v1/customers/{customer_id}/deliveries/{delivery_id}
      const url = `${UBER_BASE}/v1/customers/${UBER_CUSTOMER_ID}/deliveries/${delivery_id}`;

      console.log('[UberDirect] Status URL:', url);
      console.log('[UberDirect] Getting status for delivery ID:', delivery_id);

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const text = await res.text();
      console.log('[UberDirect] Status response status:', res.status);
      console.log('[UberDirect] Status response:', text);

      if (!res.ok) {
        console.log('[UberDirect] Status error:', res.status, res.statusText);
        return json({ error: 'status_failed', details: text }, { status: 500 });
      }

      const data = JSON.parse(text);

      // Extract key information from response
      const status = data?.status || null;
      const trackingUrl = data?.tracking_url || null;
      const courierInfo = data?.courier || null;
      const pickupEta = data?.pickup_eta || null;
      const dropoffEta = data?.dropoff_eta || null;
      const courierImminent = data?.courier_imminent || false;
      const complete = data?.complete || false;

      return json({
        status,
        trackingUrl,
        courierInfo,
        pickupEta,
        dropoffEta,
        courierImminent,
        complete,
        raw: data,
      });
    }

    return json({ error: 'Unsupported action' }, { status: 400 });
  } catch (e) {
    console.error('[UberDirect] Error:', e);
    return json(
      { error: 'internal_error', details: String(e) },
      { status: 500 }
    );
  }
});
