// This file runs on Supabase Edge Functions (Deno runtime)
// Declare Deno for TypeScript tooling in Node projects scanning this file
declare const Deno: any;

type CurrencyCode = 'EUR' | 'USD' | 'GBP';

interface Coordinates {
  lat: number;
  lng: number;
}
interface Address {
  line1: string;
  postalCode: string;
  city: string;
  countryCode: string;
  coordinates?: Coordinates;
}

interface DeliveryRequestBody {
  action: 'quote' | 'create' | 'status' | 'cancel';
  pickup: { address: Address };
  dropoff: { address: Address };
  externalOrderId?: string;
  deliveryId?: string;
  vendorId?: string; // for webhook provisioning per vendor
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

async function getStuartToken(
  baseUrl: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const res = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'api',
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stuart auth failed: ${text}`);
  }
  const data = await res.json();
  console.log('[Stuart] Auth response:', data.access_token);
  return data.access_token as string;
}

function formatFullAddress(a: Address): string {
  return `${a.line1}, ${a.postalCode} ${a.city}, ${a.countryCode}`;
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
  if (req.method !== 'POST')
    return json({ error: 'Method Not Allowed' }, { status: 405 });

  const STUART_BASE =
    Deno.env.get('STUART_API_BASE_URL') ?? 'https://api.sandbox.stuart.com';
  const STUART_CLIENT_ID = Deno.env.get('STUART_CLIENT_ID');
  const STUART_CLIENT_SECRET = Deno.env.get('STUART_CLIENT_SECRET');
  const DEFAULT_CONTACT_PHONE =
    Deno.env.get('STUART_DEFAULT_CONTACT_PHONE') ?? '+33637611911';
  if (!STUART_CLIENT_ID || !STUART_CLIENT_SECRET) {
    return json(
      { error: 'Missing STUART_CLIENT_ID/SECRET in env' },
      { status: 500 }
    );
  }

  let body: DeliveryRequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { action, pickup, dropoff, externalOrderId } = body;
  if (!action || !pickup?.address || !dropoff?.address) {
    return json(
      { error: 'action, pickup.address, dropoff.address are required' },
      { status: 400 }
    );
  }

  try {
    console.log('[Stuart] Action:', action);
    console.log('[Stuart] Pickup:', formatFullAddress(pickup.address));
    console.log('[Stuart] Dropoff:', formatFullAddress(dropoff.address));
    const token = await getStuartToken(
      STUART_BASE,
      STUART_CLIENT_ID,
      STUART_CLIENT_SECRET
    );
    console.log('[Stuart] OAuth token acquired.');

    if (action === 'quote') {
      // Per docs: use pricing/eta/cpt endpoints with the same create payload
      const jobPayload = {
        job: {
          pickups: [
            {
              address: formatFullAddress(pickup.address),
              contact: {
                company: 'Picki',
                phone: DEFAULT_CONTACT_PHONE,
              },
            },
          ],
          dropoffs: [
            {
              address: formatFullAddress(dropoff.address),
              package_type: 'small',
              contact: {
                company: 'Customer',
                phone: DEFAULT_CONTACT_PHONE,
              },
            },
          ],
        },
      } as Record<string, unknown>;

      const pricingUrl = `${STUART_BASE}/v2/jobs/pricing`;
      const etaUrl = `${STUART_BASE}/v2/jobs/eta`;
      const cptUrl = `${STUART_BASE}/v2/jobs/cpt`;
      console.log('[Stuart] Quote via Pricing/ETA/CPT:', {
        pricingUrl,
        etaUrl,
        cptUrl,
      });

      const commonReqInit: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(jobPayload),
      };

      const [pricingRes, etaRes, cptRes] = await Promise.all([
        fetch(pricingUrl, commonReqInit),
        fetch(etaUrl, commonReqInit),
        fetch(cptUrl, commonReqInit),
      ]);

      const [pricingText, etaText, cptText] = await Promise.all([
        pricingRes.text(),
        etaRes.text(),
        cptRes.text(),
      ]);

      console.log('[Stuart] Pricing status:', pricingRes.status);
      console.log('[Stuart] ETA status:', etaRes.status);
      console.log('[Stuart] CPT status:', cptRes.status);

      if (!pricingRes.ok) {
        return json(
          { error: 'quote_pricing_failed', details: pricingText },
          { status: 500 }
        );
      }

      let pricingData: any = {};
      let etaData: any = {};
      let cptData: any = {};
      try {
        pricingData = pricingText ? JSON.parse(pricingText) : {};
      } catch {}
      try {
        etaData = etaText ? JSON.parse(etaText) : {};
      } catch {}
      try {
        cptData = cptText ? JSON.parse(cptText) : {};
      } catch {}

      // Normalize pricing fields (handle multiple possible shapes)
      const extractNumber = (...values: unknown[]): number | undefined => {
        for (const value of values) {
          const numeric = Number((value as unknown) ?? undefined);
          if (Number.isFinite(numeric) && numeric > 0) return numeric;
        }
        return undefined;
      };

      // Prefer tax-included amounts; fall back to base amount if needed
      const priceIncTax =
        extractNumber(
          pricingData?.pricing?.price_tax_included,
          pricingData?.price_tax_included,
          pricingData?.pricing?.amount_with_tax,
          pricingData?.amount_with_tax,
          pricingData?.pricing?.total_with_tax,
          pricingData?.total_with_tax
        ) ??
        extractNumber(
          pricingData?.pricing?.amount,
          pricingData?.amount,
          pricingData?.pricing?.price,
          pricingData?.price
        ) ??
        0;

      const amountMinor = Math.round(priceIncTax * 100);
      const currency: CurrencyCode =
        (pricingData?.pricing?.currency as CurrencyCode) ||
        (pricingData?.currency as CurrencyCode) ||
        'EUR';

      // Extract ETA seconds to pickup
      const extractSeconds = (o: any): number | undefined => {
        if (!o || typeof o !== 'object') return undefined;
        const candidates = [
          o.eta,
          o.seconds,
          o.duration,
          o.estimated_time_seconds,
        ];
        for (const v of candidates) {
          const n = Number(v);
          if (Number.isFinite(n) && n > 0) return n;
        }
        return undefined;
      };

      const etaSeconds = extractSeconds(etaData);
      const cptSeconds = extractSeconds(cptData);
      const totalSeconds =
        (etaSeconds ?? 0) + (cptSeconds ?? 0) > 0
          ? (etaSeconds ?? 0) + (cptSeconds ?? 0)
          : etaSeconds ?? cptSeconds;
      const etaMinutes =
        totalSeconds && totalSeconds > 0
          ? Math.ceil(totalSeconds / 60)
          : undefined;

      return json({
        totalAmountMinor: amountMinor,
        currency,
        etaMinutes,
        raw: { pricing: pricingData, eta: etaData, cpt: cptData },
      });
    }

    if (action === 'create') {
      // Ensure vendor webhook exists (if vendorId provided)
      const vendorId = body.vendorId;
      try {
        if (vendorId) {
          const topics = [
            'package_created',
            'courier_assigned',
            'courier_arriving',
            'courier_waiting',
            'package_delivering',
            'package_delivered',
            'package_canceled',
            'package_returning',
            'package_returned',
            'courier_reassigning',
          ];

          // Build webhook URL for this vendor pointing to our Edge Function
          // Path format: https://<project>.functions.supabase.co/stuart-webhook/:vendorId/deliveryupdates
          const functionsBase = new URL(req.url).origin;
          const webhookUrl = `${functionsBase}/functions/v1/stuart-webhook/${vendorId}/deliveryupdates`;

          // 1) List existing webhooks from Stuart and check for one matching our deliveryupdates URL
          const listUrl = `${STUART_BASE}/v2/webhooks`;
          const listRes = await fetch(listUrl, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          });
          let shouldCreate = true;
          if (listRes.ok) {
            const listData = await listRes.json();
            // Expecting an array; be defensive if API changes
            if (Array.isArray(listData)) {
              const found = listData.find((w: any) => {
                const url: string | undefined =
                  w?.url ?? w?.link ?? w?.links?.self;
                return (
                  typeof url === 'string' &&
                  url.includes('/deliveryupdates') &&
                  url.includes(`/stuart-webhook/${vendorId}/`)
                );
              });
              shouldCreate = !found;
            }
          } else {
            console.warn(
              '[Stuart] Failed to list webhooks; proceeding to attempt creation'
            );
          }

          // 2) Create webhook if not found
          if (shouldCreate) {
            const createWebhookUrl = `${STUART_BASE}/v2/webhooks`;
            const payload = {
              url: webhookUrl,
              version: 'v3',
              topics,
              enabled: true,
            };
            const wRes = await fetch(createWebhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(payload),
            });
            const wText = await wRes.text();
            if (!wRes.ok) {
              console.error('[Stuart] Webhook creation failed:', wText);
            } else {
              console.log('[Stuart] Webhook created or ensured:', wText);
            }
          } else {
            console.log(
              '[Stuart] Matching webhook already exists; no action taken'
            );
          }
        }
      } catch (hookErr) {
        console.error('[Stuart] Webhook ensure error:', hookErr);
        // Proceed without blocking job creation
      }

      const createUrl = `${STUART_BASE}/v2/jobs`;
      console.log('[Stuart] Create URL:', createUrl);
      const jobPayload = {
        job: {
          pickups: [
            {
              address: formatFullAddress(pickup.address),
              contact: {
                company: 'Picki',
                phone: DEFAULT_CONTACT_PHONE,
              },
            },
          ],
          dropoffs: [
            {
              address: formatFullAddress(dropoff.address),
              package_type: 'small',
              contact: {
                company: 'Customer',
                phone: DEFAULT_CONTACT_PHONE,
              },
            },
          ],
        },
      } as Record<string, unknown>;
      const res = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(jobPayload),
      });
      const text = await res.text();
      console.log('[Stuart] Create status:', res.status);
      if (!res.ok)
        return json({ error: 'create_failed', details: text }, { status: 500 });
      const data = JSON.parse(text);

      // Stuart create job response example contains:
      // - job id at root (data.id)
      // - first delivery id at data.deliveries[0].id
      // - tracking url at data.deliveries[0].tracking_url
      const jobId = data?.id ?? null;
      const firstDelivery = Array.isArray(data?.deliveries)
        ? data.deliveries[0]
        : undefined;
      const deliveryId = firstDelivery?.id ?? null;
      const trackingUrl = firstDelivery?.tracking_url ?? null;

      return json({
        jobId,
        deliveryId,
        trackingUrl,
        raw: data,
      });
    }

    if (action === 'status') {
      // Backward-compatible: previously the client sent deliveryId but it actually contained the job id
      const jobId = (body as any).jobId ?? (body as any).deliveryId;
      if (!jobId) return json({ error: 'jobId is required' }, { status: 400 });
      const statusUrl = `${STUART_BASE}/v2/jobs/${jobId}`;
      console.log('[Stuart] Status URL:', statusUrl);
      const res = await fetch(statusUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      console.log('[Stuart] Status fetch:', res.status);
      if (!res.ok)
        return json({ error: 'status_failed', details: text }, { status: 500 });
      const data = JSON.parse(text);
      // Map Stuart status to our status codes (basic mapping)
      const st = (data?.status || '').toString().toLowerCase();
      let mapped: string = 'created';
      if (st.includes('assigned')) mapped = 'assigned';
      else if (st.includes('picking') || st.includes('to_pickup'))
        mapped = 'en_route_to_pickup';
      else if (st.includes('waiting_at_pickup')) mapped = 'arrived_at_pickup';
      else if (st.includes('picked')) mapped = 'picked_up';
      else if (st.includes('delivering') || st.includes('to_dropoff'))
        mapped = 'en_route_to_dropoff';
      else if (st.includes('delivered')) mapped = 'delivered';
      else if (st.includes('cancel')) mapped = 'cancelled';
      else if (st.includes('failed')) mapped = 'failed';
      return json({
        status: mapped,
        updatedAtIso: new Date().toISOString(),
        raw: data,
      });
    }

    return json({ error: 'Unsupported action' }, { status: 400 });
  } catch (e) {
    console.error('[Stuart] Error:', e);
    return json(
      { error: 'internal_error', details: String(e) },
      { status: 500 }
    );
  }
});
