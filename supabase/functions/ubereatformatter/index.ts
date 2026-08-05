/// <reference path="../edge-url-modules.d.ts" />
import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';
import {
  corsHeaders,
  extractUberEatsMenuCategoryLisFromStoreContainerHtml,
  extractUberEatsStoreContainerHtmlFromPageHtml,
  firecrawlScrapeUberEatsMenuCategoryLis,
  getMenuCategoryExtractorFromEnv,
  getRestaurantInfoExtractorFromEnv,
  json,
  sanitizeSlug,
  stripUberEatsMenuFromStoreContainerHtml,
  uploadJsonToStorage,
} from 'ubereats';

interface FormatterRequestBody {
  url?: string;
  markdownContent?: string;
  htmlContent?: string;
  menuCategoryLis?: string[];
  categoryLiHtml?: string;
  partialRestaurantInfo?: unknown;
  totalCategories?: number;
  categoryIndex?: number;
  saveToStorage?: boolean;
  bucket?: string;
}

class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

function isHttpError(e: unknown): e is HttpError {
  return (
    e instanceof Error &&
    e.name === 'HttpError' &&
    'status' in e &&
    typeof (e as { status: unknown }).status === 'number'
  );
}

function requireNonEmptyString(
  value: unknown,
  message: string,
  status = 400
): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(status, message);
  }
  return value;
}

function optionalString(value: unknown, fieldName: string): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new HttpError(400, `Field '${fieldName}' must be a string`);
  }
  return value;
}

function toErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function isTruthyEnv(value: string | undefined | null): boolean {
  const v = (value ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function optionalStringArray(value: unknown, fieldName: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new HttpError(400, `Field '${fieldName}' must be an array of strings`);
  }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      throw new HttpError(400, `Field '${fieldName}' must be an array of strings`);
    }
    const s = item.trim();
    if (s) out.push(s);
  }
  return out;
}

function optionalNumber(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new HttpError(400, `Field '${fieldName}' must be a number`);
  }
  return value;
}

function clampNonNegativeInt(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value)) return undefined;
  return Math.max(0, Math.floor(value));
}

function ensureObject(value: unknown, message: string): Record<string, unknown> {
  const rec = asRecord(value);
  if (!rec) throw new HttpError(400, message);
  return rec;
}

function ensureMenuArray(data: Record<string, unknown>): unknown[] {
  const menuRaw = data['menu'];
  if (menuRaw === undefined || menuRaw === null) {
    data['menu'] = [];
    return data['menu'] as unknown[];
  }
  if (!Array.isArray(menuRaw)) {
    // Normalize to array if it was wrong type.
    data['menu'] = [];
    return data['menu'] as unknown[];
  }
  return menuRaw;
}

serve(async (req: Request) => {
  const requestId =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const startedAt = Date.now();
  let stage:
    | 'init'
    | 'method'
    | 'parse_body'
    | 'validate'
    | 'extract'
    | 'upload'
    | 'respond' = 'init';

  try {
    stage = 'method';
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      throw new HttpError(405, 'Method Not Allowed');
    }

    let body: FormatterRequestBody;
    try {
      stage = 'parse_body';
      body = await req.json();
    } catch {
      throw new HttpError(400, 'Invalid JSON');
    }

    stage = 'validate';
    const url = optionalString(body?.url, 'url').trim();
    const markdownContent = optionalString(body?.markdownContent, 'markdownContent').trim();
    const htmlContent = optionalString(body?.htmlContent, 'htmlContent').trim();
    const menuCategoryLisInput = optionalStringArray(body?.menuCategoryLis, 'menuCategoryLis');
    const categoryLiHtml = optionalString(body?.categoryLiHtml, 'categoryLiHtml').trim();
    const partialRestaurantInfo = body?.partialRestaurantInfo;
    const totalCategories = clampNonNegativeInt(
      optionalNumber(body?.totalCategories, 'totalCategories')
    );
    const categoryIndex = clampNonNegativeInt(
      optionalNumber(body?.categoryIndex, 'categoryIndex')
    );

    const hasIncrementalPayload =
      !!categoryLiHtml ||
      (partialRestaurantInfo !== undefined && partialRestaurantInfo !== null);

    if (
      !url &&
      !markdownContent &&
      !htmlContent &&
      menuCategoryLisInput.length === 0 &&
      !hasIncrementalPayload
    ) {
      throw new HttpError(
        400,
        "Please pass at least one of: 'url', 'markdownContent', 'htmlContent', 'menuCategoryLis', or the incremental payload ('categoryLiHtml' / 'partialRestaurantInfo')"
      );
    }

    const bucket =
      body.bucket || Deno.env.get('UBEREATS_STORAGE_BUCKET') || 'ubereats';
    const saveToStorage = body.saveToStorage ?? true;

    if (saveToStorage) {
      requireNonEmptyString(
        bucket,
        'Storage bucket is not configured (missing UBEREATS_STORAGE_BUCKET)',
        500
      );
    }

    console.log(
      JSON.stringify({
        event: 'ubereatformatter_request',
        requestId,
        method: req.method,
        url: req.url,
        contentType: req.headers.get('content-type'),
        userAgent: req.headers.get('user-agent'),
        saveToStorage,
        bucket: saveToStorage ? bucket : undefined,
        hasUrl: !!url,
        markdownLength: markdownContent.length,
        htmlLength: htmlContent.length,
        menuCategoryLisCount: menuCategoryLisInput.length,
        hasPartial: partialRestaurantInfo !== undefined && partialRestaurantInfo !== null,
        totalCategories,
        categoryIndex,
      })
    );

    stage = 'extract';
    const modeFromEnv = (Deno.env.get('UBEREATS_FORMAT_MODE') ?? '').trim().toLowerCase();
    const preferSplitMode =
      modeFromEnv === 'by_category' ||
      (modeFromEnv !== 'one_shot' &&
        isTruthyEnv(Deno.env.get('UBEREATS_FORMAT_BY_CATEGORY')));
    const incrementalRequested = hasIncrementalPayload;

    let resolvedHtml = htmlContent;
    let storeContainerHtml = '';
    let menuCategoryLis = [...menuCategoryLisInput];

    if (url && !resolvedHtml && menuCategoryLis.length === 0) {
      const scraped = await firecrawlScrapeUberEatsMenuCategoryLis(url);
      storeContainerHtml = scraped.storeContainerHtml;
      resolvedHtml = storeContainerHtml;
      menuCategoryLis = scraped.menuCategoryLis;
    } else if (resolvedHtml) {
      try {
        storeContainerHtml = extractUberEatsStoreContainerHtmlFromPageHtml(resolvedHtml);
      } catch {
        // If htmlContent is already the store container, keep it as-is.
        storeContainerHtml = resolvedHtml;
      }

      if (menuCategoryLis.length === 0) {
        menuCategoryLis = extractUberEatsMenuCategoryLisFromStoreContainerHtml(
          storeContainerHtml
        );
      }
    }

    const splitMode = preferSplitMode && menuCategoryLis.length > 0 && !!storeContainerHtml;
    const byCategoryIncremental =
      incrementalRequested && totalCategories !== undefined && totalCategories > 0;

    const restaurantExtractor = getRestaurantInfoExtractorFromEnv();
    const categoryExtractor = getMenuCategoryExtractorFromEnv();

    let finalDataRecord: Record<string, unknown>;
    let formattedCategoryCount = 0;
    let complete = false;

    if (byCategoryIncremental) {
      // Incremental mode: the frontend calls this function category-by-category.
      if (partialRestaurantInfo) {
        finalDataRecord = ensureObject(
          partialRestaurantInfo,
          "Field 'partialRestaurantInfo' must be an object"
        );
      } else {
        // First call: extract restaurant info (without menu) once.
        if (!storeContainerHtml) {
          throw new HttpError(
            400,
            "First incremental call must include 'htmlContent' (store container HTML) or 'url'"
          );
        }
        const baseHtml = stripUberEatsMenuFromStoreContainerHtml(storeContainerHtml);
        const { data: baseData } = await restaurantExtractor.extractRestaurantInfo({
          markdown: markdownContent,
          html: baseHtml,
        });
        finalDataRecord = asRecord(baseData) ?? {};
        // Force an empty menu for subsequent incremental calls. The base
        // extractor's schema always includes `menu`, and strip is best-effort,
        // so baseData.menu can arrive pre-populated. Categories are appended
        // one-by-one below, so any menu here would break the categoryIndex
        // invariant (categoryIndex must equal menu.length).
        finalDataRecord['menu'] = [];
      }

      const menu = ensureMenuArray(finalDataRecord);
      if (!categoryLiHtml) {
        throw new HttpError(400, "Incremental mode requires 'categoryLiHtml'");
      }

      // Optional safety: ensure the client isn't skipping/duplicating.
      if (categoryIndex !== undefined && categoryIndex !== menu.length) {
        throw new HttpError(
          409,
          `categoryIndex mismatch: expected ${menu.length}, got ${categoryIndex}`
        );
      }

      const { data: categoryData } = await categoryExtractor.extractMenuCategory({
        html: categoryLiHtml,
      });
      menu.push(categoryData);

      formattedCategoryCount = menu.length;
      complete = formattedCategoryCount >= totalCategories;
    } else if (splitMode) {
      // Server-side split mode (single call, formats all categories in one function execution).
      const baseHtml = stripUberEatsMenuFromStoreContainerHtml(storeContainerHtml);
      const { data: baseData } = await restaurantExtractor.extractRestaurantInfo({
        markdown: markdownContent,
        html: baseHtml,
      });
      finalDataRecord = asRecord(baseData) ?? {};

      const categories: unknown[] = [];
      for (const [idx, liHtml] of menuCategoryLis.entries()) {
        const { data: categoryData } = await categoryExtractor.extractMenuCategory({
          html: liHtml,
        });
        categories.push(categoryData);
        formattedCategoryCount = idx + 1;
      }
      finalDataRecord['menu'] = categories;
      complete = true;
    } else {
      // One-shot mode (legacy).
      const { data: baseData } = await restaurantExtractor.extractRestaurantInfo({
        markdown: markdownContent,
        html: resolvedHtml,
      });
      finalDataRecord = asRecord(baseData) ?? {};
      complete = true;
    }

    const jsonString = JSON.stringify(finalDataRecord);
    const data = finalDataRecord;

    const dataRecord = asRecord(data);
    const restaurantName = requireNonEmptyString(
      dataRecord?.['name'],
      'Extracted JSON is missing restaurant name',
      500
    );
    const restaurantSlug = sanitizeSlug(restaurantName);
    if (!restaurantSlug) {
      throw new HttpError(
        422,
        `Unable to generate a slug for restaurant name: ${restaurantName}`
      );
    }

    const objectPath = `restaurants/${restaurantSlug}/restaurant_info.json`;

    if (saveToStorage && complete) {
      try {
        stage = 'upload';
        await uploadJsonToStorage({
          bucket,
          path: objectPath,
          jsonString,
        });
        console.log(
          JSON.stringify({
            event: 'ubereatformatter_upload_success',
            requestId,
            bucket,
            path: objectPath,
            elapsedMs: Date.now() - startedAt,
          })
        );
      } catch (e) {
        throw new Error(
          `Failed to upload JSON to storage: ${toErrorMessage(e)}`
        );
      }
    }

    stage = 'respond';
    return json({
      message: saveToStorage && complete
        ? `Successfully processed and saved data for ${restaurantName} to Supabase Storage.`
        : `Successfully processed data for ${restaurantName}.`,
      mode: byCategoryIncremental
        ? 'by_category_incremental'
        : splitMode
          ? 'by_category'
          : 'one_shot',
      complete,
      formattedCategoryCount: byCategoryIncremental || splitMode ? formattedCategoryCount : undefined,
      totalCategories: byCategoryIncremental
        ? totalCategories
        : splitMode
          ? menuCategoryLis.length
          : undefined,
      bucket: saveToStorage && complete ? bucket : undefined,
      path: saveToStorage && complete ? objectPath : undefined,
      data,
    });
  } catch (e) {
    const status = isHttpError(e) ? e.status : 500;
    const elapsedMs = Date.now() - startedAt;

    const payload = {
      event: 'ubereatformatter_error',
      requestId,
      stage,
      status,
      elapsedMs,
      message: toErrorMessage(e),
      ...(e instanceof Error
        ? { name: e.name, stack: e.stack ?? undefined }
        : {}),
    };

    if (status >= 500) console.error(JSON.stringify(payload));
    else console.warn(JSON.stringify(payload));

    const isLocal = Deno.env.get('LOCALLY') === 'true';
    return json(
      {
        requestId,
        error: toErrorMessage(e),
        ...(isLocal && status >= 500 && e instanceof Error && e.stack
          ? { stack: e.stack }
          : {}),
      },
      { status }
    );
  }
});
