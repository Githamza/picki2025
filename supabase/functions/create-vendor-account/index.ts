// Supabase Edge Function (Deno runtime)
// Creates a vendor + admin user + seeds a starter catalog.
//
// Required secrets:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
//
// Optional for local dev:
// - LOCALLY=true
// - LOCAL_SUPABASE_URL
// - LOCAL_SUPABASE_SERVICE_ROLE_KEY
declare const Deno: any;
// @ts-ignore - resolved by Deno at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
type SupabaseClient = ReturnType<typeof createClient>;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-version',
};

type Catalog = {
  categories: Array<{
    key: string;
    name: string;
    description?: string;
    image_url?: string;
  }>;
  products: Array<{
    name: string;
    price: number;
    categoryKey: string;
    short_description?: string;
    long_description?: string;
    image_url?: string;
    multi_step?: {
      steps: Array<{
        name: string;
        step_type: 'single-select' | 'multi-select';
        description?: string;
        is_required?: boolean;
        min_selections?: number;
        max_selections?: number;
        options: Array<{
          productName: string;
          price_adjustment?: number;
        }>;
      }>;
    };
  }>;
  banners?: Array<{
    image_url: string;
    link_url?: string | null;
    title?: string | null;
  }>;
};

type RequestBody = {
  email: string;
  password: string;
  businessName: string;
  firstName: string;
  lastName: string;
  catalog?: Catalog;
  businessHours?: Array<{
    day_of_week: number;
    open_time: string | null;
    close_time: string | null;
    is_closed: boolean;
  }>;
};

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    ...init,
  });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeError(err: unknown): {
  message: string;
  status: number;
  code?: string;
  details?: unknown;
} {
  // Default
  let message = 'Unexpected server error';
  let status = 500;
  let code: string | undefined;

  // Native Errors (incl. AuthApiError which extends Error)
  if (err instanceof Error) {
    message = err.message || message;
    // Some Supabase errors expose status/code as own props
    const anyErr = err as any;
    if (typeof anyErr?.status === 'number') status = anyErr.status;
    if (typeof anyErr?.code === 'string') code = anyErr.code;
    return { message, status, code };
  }

  // Non-Error objects (some libraries throw plain objects)
  if (isRecord(err)) {
    if (typeof err['message'] === 'string' && err['message'].trim()) {
      message = err['message'];
    }
    // Common alternative field names
    if (
      message === 'Unexpected server error' &&
      typeof err['error'] === 'string' &&
      err['error'].trim()
    ) {
      message = err['error'];
    }
    if (
      message === 'Unexpected server error' &&
      typeof (err as any).msg === 'string' &&
      (err as any).msg.trim()
    ) {
      message = (err as any).msg;
    }
    if (typeof err['status'] === 'number') status = err['status'];
    if (typeof err['code'] === 'string') code = err['code'];

    // If it looks like a PostgREST error, surface details
    const details =
      err['details'] ??
      err['hint'] ??
      err['error_description'] ??
      err['error'] ??
      undefined;

    return { message, status, code, details };
  }

  // Strings / numbers
  if (typeof err === 'string' && err.trim()) {
    return { message: err, status: 500 };
  }

  return { message, status: 500 };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseBody(input: unknown): RequestBody {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Invalid JSON body');
  }

  const body = input as Partial<RequestBody>;

  if (!isNonEmptyString(body.email)) throw new Error('email is required');
  if (!isNonEmptyString(body.password)) throw new Error('password is required');
  if (!isNonEmptyString(body.businessName))
    throw new Error('businessName is required');
  if (!isNonEmptyString(body.firstName))
    throw new Error('firstName is required');
  if (!isNonEmptyString(body.lastName)) throw new Error('lastName is required');

  if (body.catalog) {
    const catalog = body.catalog as Partial<Catalog>;
    if (
      !Array.isArray(catalog.categories) ||
      !Array.isArray(catalog.products)
    ) {
      throw new Error('catalog must include categories[] and products[]');
    }
    for (const c of catalog.categories) {
      if (
        !isNonEmptyString((c as any).key) ||
        !isNonEmptyString((c as any).name)
      ) {
        throw new Error('catalog.categories entries require key and name');
      }
    }
    for (const p of catalog.products) {
      if (
        !isNonEmptyString((p as any).name) ||
        !isNonEmptyString((p as any).categoryKey) ||
        !isFiniteNumber((p as any).price)
      ) {
        throw new Error(
          'catalog.products entries require name, categoryKey and price'
        );
      }
    }

    if (catalog.banners) {
      if (!Array.isArray(catalog.banners)) {
        throw new Error('catalog.banners must be an array');
      }
      for (const b of catalog.banners) {
        if (!isNonEmptyString((b as any).image_url)) {
          throw new Error('catalog.banners entries require image_url');
        }
      }
    }
  }

  if (body.businessHours !== undefined) {
    if (!Array.isArray(body.businessHours)) {
      throw new Error('businessHours must be an array');
    }
    for (const h of body.businessHours) {
      const day = (h as any)?.day_of_week;
      const isClosed = (h as any)?.is_closed;
      const open = (h as any)?.open_time;
      const close = (h as any)?.close_time;

      if (!Number.isInteger(day) || day < 0 || day > 6) {
        throw new Error('businessHours.day_of_week must be an integer 0..6');
      }
      if (typeof isClosed !== 'boolean') {
        throw new Error('businessHours.is_closed must be a boolean');
      }
      if (open !== null && typeof open !== 'string') {
        throw new Error('businessHours.open_time must be a string or null');
      }
      if (close !== null && typeof close !== 'string') {
        throw new Error('businessHours.close_time must be a string or null');
      }
    }
  }

  return {
    email: body.email.trim().toLowerCase(),
    password: body.password,
    businessName: body.businessName.trim(),
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
    catalog: body.catalog,
    businessHours: body.businessHours,
  };
}

function getAdminClient(): SupabaseClient {
  const isLocal = Deno.env.get('LOCALLY') === 'true';
  const supabaseUrl = isLocal
    ? Deno.env.get('LOCAL_SUPABASE_URL')
    : Deno.env.get('SUPABASE_URL');
  const serviceKey = isLocal
    ? Deno.env.get('LOCAL_SUPABASE_SERVICE_ROLE_KEY')
    : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'Server not configured (missing Supabase URL or service key)'
    );
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function seedCatalog(
  supabase: SupabaseClient,
  vendorId: string,
  catalog: Catalog
): Promise<void> {
  if (!catalog.categories.length || !catalog.products.length) return;

  const categoryIdByKey = new Map<string, number>();
  const productIdByName = new Map<string, number>();

  // Create categories in order so we can assign display_order.
  for (const [index, category] of catalog.categories.entries()) {
    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: category.name,
        description: category.description ?? null,
        image_url: category.image_url ?? null,
        is_active: true,
        display_order: index,
        vendorId,
      })
      .select('id')
      .single();

    if (error) throw error;
    categoryIdByKey.set(category.key, data.id as number);
  }

  // Insert products (small dataset => keep it simple/robust and collect IDs)
  for (const [index, product] of catalog.products.entries()) {
    const categoryId = categoryIdByKey.get(product.categoryKey);
    if (!categoryId) continue;

    const { data, error } = await supabase
      .from('products')
      .insert({
        vendor_id: vendorId,
        category_id: categoryId,
        name: product.name,
        price: product.price,
        short_description: product.short_description ?? null,
        long_description: product.long_description ?? null,
        image_url: product.image_url ?? null,
        is_available: true,
        is_multi_step: !!product.multi_step,
        display_order: index,
      })
      .select('id, name')
      .single();

    if (error) throw error;
    productIdByName.set(data.name as string, data.id as number);
  }

  // Create multi-step steps/options if provided
  for (const product of catalog.products) {
    if (!product.multi_step?.steps?.length) continue;
    const menuId = productIdByName.get(product.name);
    if (!menuId) continue;

    for (const [stepIndex, step] of product.multi_step.steps.entries()) {
      const { data: stepRow, error: stepError } = await supabase
        .from('product_steps')
        .insert({
          product_id: menuId,
          name: step.name,
          display_order: stepIndex,
          step_type: step.step_type,
          description: step.description ?? null,
          is_required: step.is_required ?? true,
          min_selections: step.min_selections ?? 1,
          max_selections: step.max_selections ?? 1,
        })
        .select('id')
        .single();

      if (stepError) throw stepError;
      const stepId = stepRow.id as number;

      for (const [optIndex, opt] of step.options.entries()) {
        const optProductId = productIdByName.get(opt.productName);
        if (!optProductId) continue;

        // Store option as a "product" option (matches your existing schema usage)
        const { error: optError } = await supabase
          .from('product_step_options')
          .insert({
            product_id: optProductId,
            name: opt.productName,
            price_adjustment: opt.price_adjustment ?? 0,
            display_order: optIndex,
            image_url: null,
            option_type: 'product',
            description: null,
            step_ids: [stepId],
            vendor_id: vendorId,
          });

        if (optError) throw optError;
      }
    }
  }

  // Seed banners (optional)
  if (catalog.banners?.length) {
    const bannersToInsert = catalog.banners.map((b, index) => ({
      image_url: b.image_url,
      link_url: b.link_url ?? null,
      title: b.title ?? null,
      display_order: index,
      is_active: true,
      vendor_id: vendorId,
    }));

    const { error: bannerError } = await supabase
      .from('banners')
      .insert(bannersToInsert);
    if (bannerError) throw bannerError;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeaders } });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  let stage = 'request';
  try {
    stage = 'parse_json';
    const raw = await req.json();
    stage = 'validate_body';
    const body = parseBody(raw);

    stage = 'init_admin_client';
    const supabase = getAdminClient();

    // Sanity check: ensure core tables exist (local dev can start with an empty DB
    // if the baseline schema wasn't pulled/applied).
    stage = 'db_check_vendors_table';
    const { error: vendorsTableError } = await supabase
      .from('vendors')
      .select('id')
      .limit(1);
    if (vendorsTableError) throw vendorsTableError;

    // 1) Create auth user (auto-confirm email to remove friction)
    stage = 'auth_admin_create_user';
    const { data: createdUser, error: createUserError } =
      await supabase.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: {
          first_name: body.firstName,
          last_name: body.lastName,
          business_name: body.businessName,
        },
      });

    if (createUserError) throw createUserError;
    const authUserId = createdUser.user?.id;
    if (!authUserId) throw new Error('Failed to create auth user');

    // 2) Create vendor
    stage = 'db_insert_vendor';
    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .insert({
        business_name: body.businessName,
        auth_user_id: authUserId,
        country: 'FR',
        currency: 'EUR',
      })
      .select('id, business_name')
      .single();

    if (vendorError) throw vendorError;
    const vendorId = vendor.id as string;

    // 2.5) Seed business hours (optional)
    if (body.businessHours?.length) {
      stage = 'db_upsert_business_hours';
      const hoursToUpsert = body.businessHours.map((h) => ({
        vendor_id: vendorId,
        day_of_week: h.day_of_week,
        open_time: h.is_closed ? null : h.open_time,
        close_time: h.is_closed ? null : h.close_time,
        is_closed: h.is_closed,
        updated_at: new Date().toISOString(),
      }));

      const { error: hoursError } = await supabase
        .from('business_hours')
        .upsert(hoursToUpsert, { onConflict: 'vendor_id,day_of_week' });
      if (hoursError) throw hoursError;
    }

    // 3) Create vendor admin user row
    stage = 'db_insert_vendor_admin_user';
    const { error: adminError } = await supabase
      .from('vendor_admin_users')
      .insert({
        vendor_id: vendorId,
        email: body.email,
        first_name: body.firstName,
        last_name: body.lastName,
        role: 'admin',
        is_active: true,
        user_id: authUserId,
      });

    if (adminError) throw adminError;

    // 4) Seed starter catalog (optional)
    if (body.catalog) {
      stage = 'seed_catalog';
      await seedCatalog(supabase, vendorId, body.catalog);
    }

    stage = 'done';
    return json(
      {
        vendorId,
        businessName: vendor.business_name,
        email: body.email,
      },
      { status: 201 }
    );
  } catch (error) {
    const normalized = normalizeError(error);
    console.error('create-vendor-account error (raw):', error);
    console.error('create-vendor-account error (normalized):', normalized);
    console.error('create-vendor-account error (stage):', stage);

    // Validation errors should stay 400
    const status =
      normalized.status >= 400 && normalized.status <= 599
        ? normalized.status
        : 500;

    // For local dev, include more details to speed up debugging.
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const isLocalRuntime =
      supabaseUrl.includes('kong:8000') || supabaseUrl.includes('127.0.0.1');
    if (isLocalRuntime) {
      return json(
        {
          error: normalized.message,
          code: normalized.code,
          details: normalized.details,
          stage,
        },
        { status }
      );
    }

    return json({ error: normalized.message }, { status });
  }
});
