import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  createAzureOpenAILanguageModel,
  createJsonTranslator,
  createOpenAILanguageModel,
} from 'npm:typechat';
import { createTypeScriptJsonValidator } from 'npm:typechat/ts';
import { parse } from 'npm:node-html-parser@6.1.13';
// TypeChat's TS validator relies on the `typescript` package (peer dep). In the Edge runtime,
// we must make it available explicitly so TypeChat can resolve it.
import 'npm:typescript@^5.0.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
};

export const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
    ...init,
  });

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value || !value.trim()) {
    throw new Error(`${name} not set`);
  }
  return value;
}

function safeJsonParse(raw: string, errorMessage: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(errorMessage);
  }
}

function extractOuterHtmlByDataTestId(html: string, testId: string): string {
  const input = html.trim();
  if (!input) return '';

  const root = parse(input);
  const element = root.querySelector(`[data-testid="${testId}"]`);
  if (!element) {
    throw new Error(
      `Expected element [data-testid="${testId}"] was not found in scraped HTML`
    );
  }

  return element.outerHTML;
}

function extractOuterHtmlByAnyDataTestId(
  html: string,
  testIds: readonly string[]
): { matchedTestId: string; outerHTML: string } {
  const input = html.trim();
  if (!input) return { matchedTestId: '', outerHTML: '' };
  const root = parse(input);

  for (const testId of testIds) {
    const element = root.querySelector(`[data-testid="${testId}"]`);
    if (element) return { matchedTestId: testId, outerHTML: element.outerHTML };
  }

  throw new Error(
    `Expected one of these elements was not found in scraped HTML: ${testIds
      .map((t) => `[data-testid="${t}"]`)
      .join(', ')}`
  );
}

function isTagNode(value: unknown): value is { tagName?: string } {
  return value !== null && typeof value === 'object' && 'tagName' in value;
}

function hasLiAncestor(node: { parentNode?: unknown }): boolean {
  let parent: unknown = node.parentNode;
  while (parent && isTagNode(parent)) {
    if ((parent.tagName ?? '').toUpperCase() === 'LI') return true;
    parent = (parent as { parentNode?: unknown }).parentNode;
  }
  return false;
}

export function extractUberEatsMenuCategoryLisFromStoreContainerHtml(
  storeContainerHtml: string
): string[] {
  const input = storeContainerHtml.trim();
  if (!input) return [];

  const root = parse(input);
  const lis = (root.querySelectorAll('li') ?? []) as unknown[];

  // Heuristic: A "category" <li> is usually a top-level <li> (not nested in another <li>)
  // that contains product nodes like [data-testid="item-thumbnail-label"].
  const categoryLis = lis.filter((li: unknown) => {
    const node = li as {
      parentNode?: unknown;
      querySelector?: (selector: string) => unknown;
    };
    if (hasLiAncestor(node)) return false;
    const hasProductThumbnail = !!node.querySelector?.(
      '[data-testid="item-thumbnail-label"]'
    );
    const hasNestedList = !!node.querySelector?.('ul');
    return hasProductThumbnail || hasNestedList;
  });

  return categoryLis
    .map((li: unknown) => (li as { outerHTML?: unknown })?.outerHTML ?? '')
    .map((s: unknown) => (typeof s === 'string' ? s : ''))
    .filter((s: string) => !!s.trim());
}

export function extractUberEatsStoreContainerHtmlFromPageHtml(pageHtml: string): string {
  // Uber Eats seems to vary between these test ids depending on layout/version.
  const { outerHTML } = extractOuterHtmlByAnyDataTestId(pageHtml, [
    'store-desktop-loaded-coi',
    'store-loaded',
  ]);
  return outerHTML;
}

export function stripUberEatsMenuFromStoreContainerHtml(
  storeContainerHtml: string
): string {
  const input = storeContainerHtml.trim();
  if (!input) return '';

  const root = parse(input);
  const lis = (root.querySelectorAll('li') ?? []) as unknown[];

  // Reuse the same heuristic used for category extraction, but operate on nodes so we can remove them.
  const categoryLis = lis.filter((li: unknown) => {
    const node = li as {
      parentNode?: unknown;
      querySelector?: (selector: string) => unknown;
    };
    if (hasLiAncestor(node)) return false;
    const hasProductThumbnail = !!node.querySelector?.(
      '[data-testid="item-thumbnail-label"]'
    );
    const hasNestedList = !!node.querySelector?.('ul');
    return hasProductThumbnail || hasNestedList;
  });

  for (const li of categoryLis) {
    (li as { remove?: () => void })?.remove?.();
  }

  return (root as unknown as { outerHTML?: unknown })?.outerHTML && typeof (root as unknown as { outerHTML?: unknown }).outerHTML === 'string'
    ? ((root as unknown as { outerHTML?: string }).outerHTML as string)
    : input;
}

export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 63)
    .replace(/^-+|-+$/g, '');
}

export function getServiceSupabaseClient() {
  const isLocal = Deno.env.get('LOCALLY') === 'true';
  const supabaseUrl = isLocal
    ? Deno.env.get('LOCAL_SUPABASE_URL')
    : Deno.env.get('SUPABASE_URL');
  const serviceKey = isLocal
    ? Deno.env.get('LOCAL_SUPABASE_SERVICE_ROLE_KEY')
    : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase service credentials not set');
  }

  return createClient(supabaseUrl, serviceKey);
}

type SupabaseStorageClient = {
  storage: {
    createBucket: (
      bucket: string,
      options: { public: boolean }
    ) => Promise<{ error?: { message?: string } | null }>;
    from: (bucket: string) => {
      upload: (
        path: string,
        body: Uint8Array,
        options: { upsert: boolean; contentType: string }
      ) => Promise<{ error?: { message?: string } | null }>;
    };
  };
};

export async function ensureStorageBucket(
  supabase: SupabaseStorageClient,
  bucket: string
) {
  const { error } = await supabase.storage.createBucket(bucket, {
    public: false,
  });

  // If it already exists, ignore.
  if (
    error &&
    !String(error.message || '')
      .toLowerCase()
      .includes('exists')
  ) {
    throw error;
  }
}

export async function uploadJsonToStorage(params: {
  bucket: string;
  path: string;
  jsonString: string;
}) {
  const supabase = getServiceSupabaseClient();
  await ensureStorageBucket(supabase, params.bucket);

  const content = new TextEncoder().encode(params.jsonString);
  const { error } = await supabase.storage
    .from(params.bucket)
    .upload(params.path, content, {
      upsert: true,
      contentType: 'application/json',
    });

  if (error) throw error;
}

export async function firecrawlScrapeMarkdownAndHtml(
  url: string
): Promise<{ markdown: string; html: string }> {
  const apiKey = requireEnv('FIRECRAWL_API_KEY');

  const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      // We need the specific container node from the fully-rendered DOM.
      // onlyMainContent can sometimes exclude wrapper nodes, so keep full HTML.
      onlyMainContent: false,
      formats: ['rawHtml'],
      maxAge: 3600000,
      actions: [
        {
          type: 'wait',
          milliseconds: 3000,
        },
      ],
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Firecrawl scrape failed (${res.status}): ${raw}`);
  }

  const parsed = safeJsonParse(
    raw,
    'Firecrawl scrape returned non-JSON response'
  );

  const data = (parsed as {
    data?: { markdown?: unknown; html?: unknown; rawHtml?: unknown };
  })?.data;
  const markdown = typeof data?.markdown === 'string' ? data.markdown : '';
  const rawHtml = typeof data?.rawHtml === 'string' ? data.rawHtml : '';
  const html = typeof data?.html === 'string' ? data.html : '';
  const resolvedHtml = html || rawHtml;
  if (!resolvedHtml && !markdown) {
    throw new Error(
      'Firecrawl scrape response missing data.html/data.rawHtml/data.markdown'
    );
  }

  const uberEatsRootHtml = resolvedHtml
    ? extractUberEatsStoreContainerHtmlFromPageHtml(resolvedHtml)
    : '';

  return { markdown, html: uberEatsRootHtml };
}

export async function firecrawlScrapeUberEatsMenuCategoryLis(url: string): Promise<{
  storeContainerHtml: string;
  menuCategoryLis: string[];
}> {
  const { html } = await firecrawlScrapeMarkdownAndHtml(url);
  const storeContainerHtml = html.trim();
  const menuCategoryLis =
    extractUberEatsMenuCategoryLisFromStoreContainerHtml(storeContainerHtml);
  return { storeContainerHtml, menuCategoryLis };
}

function isTruthyEnv(value: string | undefined | null): boolean {
  const v = (value ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export function isFirecrawlJsonModeEnabled(): boolean {
  return isTruthyEnv(Deno.env.get('FIRECRAWL_JSON_MODE'));
}

// Firecrawl v2 JSON mode schema for RestaurantInfo.
// Keep it reasonably permissive (many fields can be absent), but enforce that
// each menu item includes an imageUrl, per project needs.
const stepOptionSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    name: { type: 'string' },
    priceAdjustment: { type: 'string' },
    imageUrl: { type: 'string' },
    description: { type: 'string' },
    displayOrder: { type: 'number' },
    optionType: { type: 'string', enum: ['component', 'product'] },
  },
  required: ['name', 'priceAdjustment', 'displayOrder', 'optionType'],
} as const;

const productStepSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    displayOrder: { type: 'number' },
    stepType: { type: 'string' },
    isRequired: { type: 'boolean' },
    minSelections: { type: 'number' },
    maxSelections: { type: 'number' },
    options: { type: 'array', items: stepOptionSchema },
  },
  required: ['name', 'displayOrder', 'isRequired', 'minSelections', 'maxSelections', 'options'],
} as const;

const customisationOptionSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    name: { type: 'string' },
    priceAdjustment: { type: 'string' },
    imageUrl: { type: 'string' },
    description: { type: 'string' },
    displayOrder: { type: 'number' },
    optionType: { type: 'string', enum: ['component', 'product'] },
    productName: { type: 'string' },
  },
  required: ['name', 'priceAdjustment', 'displayOrder', 'optionType'],
} as const;

const customisationSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    selectionType: { type: 'string', enum: ['single-select', 'multi-select'] },
    isRequired: { type: 'boolean' },
    minSelections: { type: 'number' },
    maxSelections: { type: 'number' },
    displayOrder: { type: 'number' },
    options: { type: 'array', items: customisationOptionSchema },
  },
  required: ['name', 'selectionType', 'isRequired', 'minSelections', 'maxSelections', 'displayOrder', 'options'],
} as const;

const productComplementSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    name: { type: 'string' },
    price: { type: 'string' },
    imageUrl: { type: 'string' },
    description: { type: 'string' },
    isRequired: { type: 'boolean' },
    selectionType: { type: 'string', enum: ['single', 'multiple'] },
    maxSelections: { type: 'number' },
    displayOrder: { type: 'number' },
    isFree: { type: 'boolean' },
  },
  required: ['name', 'price', 'isRequired', 'selectionType', 'maxSelections', 'displayOrder', 'isFree'],
} as const;

const productSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    name: { type: 'string' },
    price: { type: 'string' },
    imageUrl: { type: 'string' },
    shortDescription: { type: 'string' },
    longDescription: { type: 'string' },
    displayOrder: { type: 'number' },
    isMultiStep: { type: 'boolean' },
    steps: { type: 'array', items: productStepSchema },
    hasCustomisations: { type: 'boolean' },
    customisations: { type: 'array', items: customisationSchema },
    complements: { type: 'array', items: productComplementSchema },
  },
  required: ['name', 'price', 'displayOrder', 'isMultiStep', 'hasCustomisations'],
} as const;

export const restaurantInfoJsonSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    bannerImageUrl: { type: 'string' },
    name: { type: 'string' },
    ratingValue: { type: 'number' },
    ratingCount: { type: 'string' },
    cuisineAndPriceTags: { type: 'array', items: { type: 'string' } },
    address: { type: 'string' },
    description: { type: 'string' },
    acceptedPaymentMethods: { type: 'array', items: { type: 'string' } },
    pickupTimeEstimate: { type: 'string' },
    operatingHours: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          dayRange: { type: 'string' },
          periods: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: true,
              properties: {
                open: { type: 'string' },
                close: { type: 'string' },
              },
            },
          },
        },
      },
    },
    menu: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          categoryName: { type: 'string' },
          description: { type: 'string' },
          icon: { type: 'string' },
          displayOrder: { type: 'number' },
          items: { type: 'array', items: productSchema },
        },
        required: ['categoryName', 'displayOrder', 'items'],
      },
    },
  },
} as const;

function buildFirecrawlRestaurantInfoPrompt(extraPrompt?: string): string {
  const base =
    `Extract the restaurant information from this Uber Eats restaurant page.\n` +
    `Return JSON that conforms to the following TypeScript interface (desired type: RestaurantInfo).\n\n` +
    `Critical instructions:\n` +
    `- Find ALL product/menu item images. Use absolute URLs.\n` +
    `- Identify MULTI-STEP products (menus/formulas): Products where you choose multiple components (e.g., "Menu Big Mac" with drink + side choices). Set isMultiStep=true and populate steps array.\n` +
    `- Identify CUSTOMISATIONS: Modification groups like "Choose your toppings", "Extra sauce", "Remove ingredients". These are shared across products. Set hasCustomisations=true and populate customisations array.\n` +
    `- Identify COMPLEMENTS: Add-on products (actual menu items) that can be added, like extra sauces, sides. Populate complements array.\n` +
    `- For simple products without configuration options, set isMultiStep=false and hasCustomisations=false.\n` +
    `- displayOrder should be the position in the list (0-indexed).\n\n` +
    `Target Interface:\n${targetInterface}\n`;

  const extra = (extraPrompt ?? '').trim();
  return extra ? `${base}\nAdditional instructions:\n${extra}\n` : base;
}

export async function firecrawlScrapeRestaurantInfoJson(params: {
  url: string;
  prompt?: string;
}): Promise<unknown> {
  const apiKey = requireEnv('FIRECRAWL_API_KEY');

  const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: params.url,
      onlyMainContent: true,
      formats: [
        {
          type: 'json',
          schema: restaurantInfoJsonSchema,
          prompt: buildFirecrawlRestaurantInfoPrompt(params.prompt),
        },
      ],
      maxAge: 3600000,
      actions: [
        {
          type: 'wait',
          milliseconds: 3000,
        },
      ],
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Firecrawl scrape failed (${res.status}): ${raw}`);
  }

  const parsed = safeJsonParse(
    raw,
    'Firecrawl scrape returned non-JSON response'
  ) as unknown;

  const jsonData = (parsed as { data?: { json?: unknown } })?.data?.json;
  if (jsonData === undefined) {
    throw new Error('Firecrawl JSON mode response missing data.json');
  }

  return jsonData;
}

export const targetInterface = `
/*
 * =============================================================================
 * PRODUCT CONFIGURATION MODEL
 * =============================================================================
 * 
 * There are TWO ways a product can have configuration options:
 * 
 * 1. MULTI-STEP PRODUCTS (isMultiStep = true)
 *    - Products that require MULTIPLE sequential configuration steps
 *    - Displayed in the menu as a "formula" or "menu" (e.g., "Menu Big Mac")
 *    - User must go through each step to build their order
 *    - Example: "Menu Big Mac" → Step 1: Choose drink → Step 2: Choose side → Step 3: Choose sauce
 *    - Uses: ProductStep[] with StepOption[]
 * 
 * 2. REGULAR PRODUCTS WITH CUSTOMISATIONS (isMultiStep = false, hasCustomisations = true)
 *    - Products displayed as regular items in the catalog
 *    - Have ONE or more optional/required modifier groups attached
 *    - Conceptually: A customisation is like a SINGLE step from a multi-step product
 *    - But represented as a regular product with modifier options
 *    - Example: "Pad Thaï Poulet" → Customisation: "Choose your toppings" (Piment, Coriandre, etc.)
 *    - Uses: Customisation[] with CustomisationOption[]
 * 
 * KEY DIFFERENCE:
 *    - Multi-step: Product IS the configuration (you're building a meal from scratch)
 *    - Customisation: Product is already defined, you're just modifying/adding to it
 * 
 * =============================================================================
 */

/**
 * Option within a step for multi-step products.
 * Maps to product_step_options table.
 */
export interface StepOption {
  /** Name of the option (e.g., "Coca-Cola", "Extra Cheese") */
  name: string;
  /** Price adjustment in string format (e.g., "2.50", "0") */
  priceAdjustment: string;
  /** Image URL for the option if available */
  imageUrl?: string;
  /** Description of the option */
  description?: string;
  /** Order for display within the step */
  displayOrder: number;
  /** Type of option: 'component' for simple items, 'product' if it references another product */
  optionType: 'component' | 'product';
}

/**
 * A step in a multi-step product configuration.
 * Maps to product_steps table.
 * 
 * MULTI-STEP products have MULTIPLE steps that the user goes through sequentially.
 * Example: "Menu Big Mac" has 3 steps: Choose Drink → Choose Side → Choose Sauce
 */
export interface ProductStep {
  /** Name of the step (e.g., "Choisissez votre boisson", "Choisissez vos sauces") */
  name: string;
  /** Description of the step */
  description?: string;
  /** Order for display */
  displayOrder: number;
  /** Type of step (e.g., "choice", "extras") */
  stepType?: string;
  /** Whether selection is required for this step */
  isRequired: boolean;
  /** Minimum number of selections required */
  minSelections: number;
  /** Maximum number of selections allowed */
  maxSelections: number;
  /** Available options for this step */
  options: StepOption[];
}

/**
 * Option within a customisation group.
 * Maps to customisation_options table.
 */
export interface CustomisationOption {
  /** Name of the option (e.g., "Piment", "Extra Cheese", "No onions") */
  name: string;
  /** Price adjustment in string format (e.g., "1.50", "0", "-0.50") */
  priceAdjustment: string;
  /** Image URL for the option if available */
  imageUrl?: string;
  /** Description of the option */
  description?: string;
  /** Order for display within the customisation */
  displayOrder: number;
  /** Type: 'component' for simple items, 'product' if referencing another product */
  optionType: 'component' | 'product';
  /** If optionType is 'product', the name of the referenced product */
  productName?: string;
}

/**
 * A customisation group attached to a regular product.
 * Maps to customisations table.
 * 
 * CONCEPTUALLY: A Customisation is like a SINGLE ProductStep, but for regular products.
 * - Multi-step product: Multiple ProductSteps (build a meal from scratch)
 * - Regular product with customisation: One or more Customisations (modify an existing item)
 * 
 * Example: "Pad Thaï Poulet" (regular product) has a customisation "Choisissez votre garniture"
 * with options: Piment, Coriandre, Oignons frits, Cacahuètes
 */
export interface Customisation {
  /** Name of the customisation group (e.g., "Choisissez votre garniture") */
  name: string;
  /** Description of the customisation */
  description?: string;
  /** Selection type: 'single-select' or 'multi-select' */
  selectionType: 'single-select' | 'multi-select';
  /** Whether selection is required */
  isRequired: boolean;
  /** Minimum number of selections required (0 if not required) */
  minSelections: number;
  /** Maximum number of selections allowed */
  maxSelections: number;
  /** Order for display */
  displayOrder: number;
  /** Available options in this customisation */
  options: CustomisationOption[];
}

/**
 * A complement product that can be added to a main product.
 * Maps to product_complements table.
 * Example: sauces, sides, extras that are actual products.
 */
export interface ProductComplement {
  /** Name of the complement product */
  name: string;
  /** Price of the complement (or custom price if overridden) */
  price: string;
  /** Image URL of the complement product */
  imageUrl?: string;
  /** Description of the complement */
  description?: string;
  /** Whether selecting a complement is required */
  isRequired: boolean;
  /** Selection type: 'single' or 'multiple' */
  selectionType: 'single' | 'multiple';
  /** Maximum number that can be selected */
  maxSelections: number;
  /** Order for display */
  displayOrder: number;
  /** Whether this complement is free when linked to this product */
  isFree: boolean;
}

/**
 * A menu item/product - can be simple or multi-step, with optional customisations and complements.
 * Maps to products table.
 */
export interface Product {
  /** Product name */
  name: string;
  /** Base price in string format (e.g., "12.50") */
  price: string;
  /** Product image URL */
  imageUrl?: string;
  /** Short description for display in listings */
  shortDescription?: string;
  /** Long/detailed description */
  longDescription?: string;
  /** Order for display within category */
  displayOrder?: number;
  /** Whether this is a multi-step product (has configuration steps like menus/formulas) */
  isMultiStep: boolean;
  /** Configuration steps for multi-step products (formulas, menus) */
  steps?: ProductStep[];
  /** Whether this product has customisations */
  hasCustomisations: boolean;
  /** Customisation groups attached to this product (shared modifier groups) */
  customisations?: Customisation[];
  /** Complement products that can be added (actual products as add-ons) */
  complements?: ProductComplement[];
}

/**
 * A menu category containing products.
 * Maps to categories table.
 */
export interface MenuCategory {
  /** Category name (e.g., "Burgers", "Pizzas", "Menus") */
  categoryName: string;
  /** Description of the category */
  description?: string;
  /** Icon identifier for the category */
  icon?: string;
  /** Order for display otherwise put 0*/
  displayOrder?: number;
  /** Products within this category */
  items: Product[];
}

export interface OperatingHoursPeriod {
  open: string;
  close: string;
}

export interface OperatingHoursDay {
  dayRange: string;
  periods: OperatingHoursPeriod[];
}

/**
 * Represents the structured information for a restaurant scraped from Uber Eats.
 * This interface is designed to map directly to the database schema.
 */
export interface RestaurantInfo {
  bannerImageUrl: string;
  name: string;
  ratingValue: number;
  ratingCount: string;
  cuisineAndPriceTags: string[];
  address: string;
  description: string;
  acceptedPaymentMethods?: string[];
  pickupTimeEstimate?: string;
  operatingHours: OperatingHoursDay[];
  menu: MenuCategory[];
}
`;

/**
 * Option within a step for multi-step products.
 * Maps to product_step_options table.
 */
export interface StepOption {
  name: string;
  priceAdjustment: string;
  imageUrl?: string;
  description?: string;
  displayOrder: number;
  optionType: 'component' | 'product';
}

/**
 * A step in a multi-step product configuration.
 * Maps to product_steps table.
 */
export interface ProductStep {
  name: string;
  description?: string;
  displayOrder: number;
  stepType?: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  options: StepOption[];
}

/**
 * Option within a customisation group.
 * Maps to customisation_options table.
 */
export interface CustomisationOption {
  name: string;
  priceAdjustment: string;
  imageUrl?: string;
  description?: string;
  displayOrder: number;
  optionType: 'component' | 'product';
  productName?: string;
}

/**
 * A customisation group that can be shared across products.
 * Maps to customisations table.
 */
export interface Customisation {
  name: string;
  description?: string;
  selectionType: 'single-select' | 'multi-select';
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  displayOrder: number;
  options: CustomisationOption[];
}

/**
 * A complement product that can be added to a main product.
 * Maps to product_complements table.
 */
export interface ProductComplement {
  name: string;
  price: string;
  imageUrl?: string;
  description?: string;
  isRequired: boolean;
  selectionType: 'single' | 'multiple';
  maxSelections: number;
  displayOrder: number;
  isFree: boolean;
}

/**
 * A menu item/product - can be simple or multi-step, with optional customisations and complements.
 * Maps to products table.
 */
export interface Product {
  name: string;
  price: string;
  imageUrl?: string;
  shortDescription?: string;
  longDescription?: string;
  displayOrder?: number;
  isMultiStep: boolean;
  steps?: ProductStep[];
  hasCustomisations: boolean;
  customisations?: Customisation[];
  complements?: ProductComplement[];
}

/**
 * A menu category containing products.
 * Maps to categories table.
 */
export interface MenuCategory {
  categoryName: string;
  description?: string;
  icon?: string;
  displayOrder?: number;
  items: Product[];
}

export interface OperatingHoursPeriod {
  open: string;
  close: string;
}

export interface OperatingHoursDay {
  dayRange: string;
  periods: OperatingHoursPeriod[];
}

/**
 * Represents the structured information for a restaurant scraped from Uber Eats.
 * This interface is designed to map directly to the database schema.
 */
export interface RestaurantInfo {
  bannerImageUrl: string;
  name: string;
  ratingValue: number;
  ratingCount: string;
  cuisineAndPriceTags: string[];
  address: string;
  description: string;
  acceptedPaymentMethods?: string[];
  pickupTimeEstimate?: string;
  operatingHours: OperatingHoursDay[];
  menu: MenuCategory[];
}

export interface RestaurantInfoExtractor {
  extractRestaurantInfo(params: {
    markdown: string;
    html: string;
  }): Promise<{ jsonString: string; data: unknown }>;
}

export class AzureOpenAiRestaurantInfoExtractor
  implements RestaurantInfoExtractor
{
  async extractRestaurantInfo(params: {
    markdown: string;
    html: string;
  }): Promise<{ jsonString: string; data: unknown }> {
    return await azureOpenAiExtractRestaurantInfo(params);
  }
}

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string;
    };
  }>;
  model?: string;
  id?: string;
  usage?: unknown;
};

export class QwenRestaurantInfoExtractor implements RestaurantInfoExtractor {
  async extractRestaurantInfo(params: {
    markdown: string;
    html: string;
  }): Promise<{ jsonString: string; data: unknown }> {
    const markdown = params.markdown?.trim() ?? '';
    const html = params.html?.trim() ?? '';
    if (!markdown && !html) {
      throw new Error('No markdown or html content provided for extraction');
    }

    const apiKey = requireEnv('QWEN_API_KEY');
    const baseUrl = (
      Deno.env.get('QWEN_BASE_URL') ||
      'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
    ).replace(/\/+$/g, '');
    const model = (Deno.env.get('QWEN_MODEL') || 'qwen-plus').trim();

    const url = `${baseUrl}/chat/completions`;

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [
      {
        role: 'system',
        content:
          `You are an expert data transformation. Your task is to parse the provided content (Markdown and/or HTML) scraped from an Uber Eats restaurant page, and extract the relevant restaurant information. ` +
          `Format the output strictly as a JSON object conforming to the following TypeScript interface. ` +
          `Ignore all irrelevant information like general site navigation, promotions, footer links, web cookies, notices, etc., focusing only on the specific restaurant's data (name, rating, address, description, hours, menu items, prices, categories). ` +
          `Output ONLY the JSON object.\n\nTarget Interface:\n${targetInterface}\n\nPlease output in JSON format.`,
      },
    ];

    if (markdown) {
      messages.push({
        role: 'user',
        content: `Parse the following Markdown content:\n\n---\n${markdown}\n---`,
      });
    }
    if (html) {
      messages.push({
        role: 'user',
        content: `Parse the following HTML content:\n\n---\n${html}\n---`,
      });
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages,
        temperature: 0.1,
      }),
    });

    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`Qwen error (${res.status}): ${raw}`);
    }

    const responseJson = safeJsonParse(
      raw,
      'Qwen returned non-JSON response'
    ) as ChatCompletionResponse | unknown;

    const content = (responseJson as ChatCompletionResponse)?.choices?.[0]
      ?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Qwen response missing content');
    }

    const data = safeJsonParse(
      content,
      'Failed to parse JSON object from Qwen content'
    );

    const name = (data as { name?: unknown })?.name;
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error('Extracted JSON is missing restaurant name');
    }

    return { jsonString: JSON.stringify(data), data };
  }
}

type TypeChatExtractorProvider = 'azure_openai' | 'qwen';

type TypeChatTargetType = 'RestaurantInfo' | 'MenuCategory';

const typeChatTranslators = new Map<
  string,
  ReturnType<typeof createJsonTranslator<any>>
>();

function ensureChatCompletionsEndpoint(rawBaseUrl: string): string {
  const base = rawBaseUrl.replace(/\/+$/g, '');
  return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
}

function getTypeChatTranslator(
  provider: TypeChatExtractorProvider,
  targetType: TypeChatTargetType
) {
  const cacheKey = `${provider}:${targetType}`;
  const cached = typeChatTranslators.get(cacheKey);
  if (cached) return cached;

  const validator = createTypeScriptJsonValidator<any>(targetInterface, targetType);

  if (provider === 'qwen') {
    const apiKey = requireEnv('QWEN_API_KEY');
    const baseUrl = (
      Deno.env.get('QWEN_BASE_URL') ||
      'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
    ).trim();
    const modelName = (Deno.env.get('QWEN_MODEL') || 'qwen-plus').trim();

    const model = createOpenAILanguageModel(
      apiKey,
      modelName,
      ensureChatCompletionsEndpoint(baseUrl)
    );
    const translator = createJsonTranslator(model, validator);
    typeChatTranslators.set(cacheKey, translator);
    return translator;
  }

  // Azure OpenAI (existing project env var names)
  const apiKey = (
    Deno.env.get('AZURE_OPENAI_KEY') ?? Deno.env.get('AZURE_OPENAI_API_KEY') ?? ''
  ).trim();
  const baseEndpoint = (Deno.env.get('AZURE_OPENAI_ENDPOINT') ?? '').trim();
  const deployment = (Deno.env.get('AZURE_OPENAI_DEPLOYMENT') ?? '').trim();
  const apiVersion = (
    Deno.env.get('OPEN_AI_VERSION') ?? Deno.env.get('AZURE_OPENAI_API_VERSION') ?? ''
  ).trim();

  if (!apiKey || !baseEndpoint || !deployment || !apiVersion) {
    throw new Error(
      'TypeChat (Azure) provider requires env vars: AZURE_OPENAI_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT (and OPEN_AI_VERSION).'
    );
  }

  const fullEndpoint = `${baseEndpoint.replace(
    /\/+$/g,
    ''
  )}/openai/deployments/${deployment}/chat/completions?api-version=${encodeURIComponent(
    apiVersion
  )}`;

  const model = createAzureOpenAILanguageModel(apiKey, fullEndpoint);
  const translator = createJsonTranslator(model, validator);
  typeChatTranslators.set(cacheKey, translator);
  return translator;
}

export class TypeChatRestaurantInfoExtractor implements RestaurantInfoExtractor {
  async extractRestaurantInfo(params: {
    markdown: string;
    html: string;
  }): Promise<{ jsonString: string; data: unknown }> {
    const markdown = params.markdown?.trim() ?? '';
    const html = params.html?.trim() ?? '';
    if (!markdown && !html) {
      throw new Error('No markdown or html content provided for extraction');
    }

    const translator = getTypeChatTranslator('azure_openai', 'RestaurantInfo');
    const request =
      `Extract the restaurant information from the following Uber Eats page content.\n` +
      `Return ONLY a JSON object that conforms to the TypeScript type RestaurantInfo.\n\n` +
      (markdown
        ? `Markdown:\n---\n${markdown}\n---\n\n`
        : '') +
      (html ? `HTML:\n---\n${html}\n---\n` : '');

    const response = await translator.translate(request);
    if (!response.success) {
      throw new Error(response.message);
    }

    const data = response.data as RestaurantInfo;
    if (!data?.name || typeof data.name !== 'string' || !data.name.trim()) {
      throw new Error('Extracted JSON is missing restaurant name');
    }

    return { jsonString: JSON.stringify(data), data };
  }
}

export class TypeChatQwenRestaurantInfoExtractor
  implements RestaurantInfoExtractor
{
  async extractRestaurantInfo(params: {
    markdown: string;
    html: string;
  }): Promise<{ jsonString: string; data: unknown }> {
    const markdown = params.markdown?.trim() ?? '';
    const html = params.html?.trim() ?? '';
    if (!markdown && !html) {
      throw new Error('No markdown or html content provided for extraction');
    }

    // Fail fast with a helpful message; TypeChat will also throw if not configured.
    const qwenKey = (Deno.env.get('QWEN_API_KEY') ?? '').trim();
    const qwenModel = (Deno.env.get('QWEN_MODEL') ?? 'qwen-plus').trim();
    const qwenBaseUrl = (
      Deno.env.get('QWEN_BASE_URL') ||
      'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
    ).trim();

    if (!qwenKey || !qwenModel || !qwenBaseUrl) {
      throw new Error(
        'TypeChat (Qwen) provider requires env vars: QWEN_API_KEY (and optionally QWEN_BASE_URL, QWEN_MODEL).'
      );
    }

    const translator = getTypeChatTranslator('qwen', 'RestaurantInfo');
    const request =
      `Extract the restaurant information from the following Uber Eats page content.\n` +
      `Return ONLY a JSON object that conforms to the TypeScript type RestaurantInfo.\n\n` +
      (markdown
        ? `Markdown:\n---\n${markdown}\n---\n\n`
        : '') +
      (html ? `HTML:\n---\n${html}\n---\n` : '');

    const response = await translator.translate(request);
    if (!response.success) {
      throw new Error(response.message);
    }

    const data = response.data as RestaurantInfo;
    if (!data?.name || typeof data.name !== 'string' || !data.name.trim()) {
      throw new Error('Extracted JSON is missing restaurant name');
    }

    return { jsonString: JSON.stringify(data), data };
  }
}

export function getRestaurantInfoExtractorFromEnv(): RestaurantInfoExtractor {
  const provider = (Deno.env.get('UBEREATS_LLM_PROVIDER') ?? 'azure_openai')
    .toLowerCase()
    .trim();

  switch (provider) {
    case 'azure_openai':
    case 'openai':
      return new AzureOpenAiRestaurantInfoExtractor();
    case 'qwen':
      return new QwenRestaurantInfoExtractor();
    case 'typechat':
      return new TypeChatRestaurantInfoExtractor();
    case 'typechat_qwen':
    case 'typechat-qwen':
      return new TypeChatQwenRestaurantInfoExtractor();
    default:
      throw new Error(
        `Unsupported UBEREATS_LLM_PROVIDER: "${provider}". Expected "azure_openai", "qwen", "typechat", or "typechat_qwen".`
      );
  }
}

export interface MenuCategoryExtractor {
  extractMenuCategory(params: {
    html: string;
  }): Promise<{ jsonString: string; data: unknown }>;
}

export class AzureOpenAiMenuCategoryExtractor implements MenuCategoryExtractor {
  async extractMenuCategory(params: {
    html: string;
  }): Promise<{ jsonString: string; data: unknown }> {
    return await azureOpenAiExtractMenuCategory(params);
  }
}

export class QwenMenuCategoryExtractor implements MenuCategoryExtractor {
  async extractMenuCategory(params: {
    html: string;
  }): Promise<{ jsonString: string; data: unknown }> {
    const html = params.html?.trim() ?? '';
    if (!html) {
      throw new Error('No html content provided for menu category extraction');
    }

    const apiKey = requireEnv('QWEN_API_KEY');
    const baseUrl = (
      Deno.env.get('QWEN_BASE_URL') ||
      'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
    ).replace(/\/+$/g, '');
    const model = (Deno.env.get('QWEN_MODEL') || 'qwen-plus').trim();
    const url = `${baseUrl}/chat/completions`;

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [
      {
        role: 'system',
        content:
          `You are an expert data extraction assistant. Your task is to parse ONE Uber Eats menu category HTML block (a <li> that represents a category). ` +
          `Extract the category name and ALL items (products) inside it. ` +
          `Output ONLY a JSON object that conforms to the TypeScript type MenuCategory.\n\n` +
          `Critical: Each MenuItem MUST include imageUrl (best product image URL, absolute if possible) and price.\n\n` +
          `Target Interface:\n${targetInterface}\n\nDesired type: MenuCategory`,
      },
      {
        role: 'user',
        content: `Parse the following HTML content:\n\n---\n${html}\n---`,
      },
    ];

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages,
        temperature: 0.1,
      }),
    });

    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`Qwen error (${res.status}): ${raw}`);
    }

    const responseJson = safeJsonParse(raw, 'Qwen returned non-JSON response') as
      | ChatCompletionResponse
      | unknown;
    const content = (responseJson as ChatCompletionResponse)?.choices?.[0]
      ?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Qwen response missing content');
    }

    const data = safeJsonParse(content, 'Failed to parse JSON object from Qwen content');
    return { jsonString: JSON.stringify(data), data };
  }
}

export class TypeChatMenuCategoryExtractor implements MenuCategoryExtractor {
  async extractMenuCategory(params: {
    html: string;
  }): Promise<{ jsonString: string; data: unknown }> {
    const html = params.html?.trim() ?? '';
    if (!html) {
      throw new Error('No html content provided for menu category extraction');
    }

    const translator = getTypeChatTranslator('azure_openai', 'MenuCategory');
    const request =
      `Extract ONE Uber Eats menu category from the following HTML.\n` +
      `Return ONLY a JSON object that conforms to the TypeScript type MenuCategory.\n\n` +
      `Critical: Every MenuItem must include imageUrl (best available product image URL) and price.\n\n` +
      `HTML:\n---\n${html}\n---\n`;

    const response = await translator.translate(request);
    if (!response.success) {
      throw new Error(response.message);
    }

    const data = response.data as MenuCategory;
    const categoryName = (data as { categoryName?: unknown })?.categoryName;
    if (typeof categoryName !== 'string' || !categoryName.trim()) {
      throw new Error('Extracted JSON is missing categoryName');
    }

    return { jsonString: JSON.stringify(data), data };
  }
}

export class TypeChatQwenMenuCategoryExtractor implements MenuCategoryExtractor {
  async extractMenuCategory(params: {
    html: string;
  }): Promise<{ jsonString: string; data: unknown }> {
    const html = params.html?.trim() ?? '';
    if (!html) {
      throw new Error('No html content provided for menu category extraction');
    }

    const qwenKey = (Deno.env.get('QWEN_API_KEY') ?? '').trim();
    const qwenModel = (Deno.env.get('QWEN_MODEL') ?? 'qwen-plus').trim();
    const qwenBaseUrl = (
      Deno.env.get('QWEN_BASE_URL') ||
      'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
    ).trim();
    if (!qwenKey || !qwenModel || !qwenBaseUrl) {
      throw new Error(
        'TypeChat (Qwen) provider requires env vars: QWEN_API_KEY (and optionally QWEN_BASE_URL, QWEN_MODEL).'
      );
    }

    const translator = getTypeChatTranslator('qwen', 'MenuCategory');
    const request =
      `Extract ONE Uber Eats menu category from the following HTML.\n` +
      `Return ONLY a JSON object that conforms to the TypeScript type MenuCategory.\n\n` +
      `Critical: Every MenuItem must include imageUrl (best available product image URL) and price.\n\n` +
      `HTML:\n---\n${html}\n---\n`;

    const response = await translator.translate(request);
    if (!response.success) {
      throw new Error(response.message);
    }

    const data = response.data as MenuCategory;
    const categoryName = (data as { categoryName?: unknown })?.categoryName;
    if (typeof categoryName !== 'string' || !categoryName.trim()) {
      throw new Error('Extracted JSON is missing categoryName');
    }

    return { jsonString: JSON.stringify(data), data };
  }
}

export function getMenuCategoryExtractorFromEnv(): MenuCategoryExtractor {
  const provider = (Deno.env.get('UBEREATS_LLM_PROVIDER') ?? 'azure_openai')
    .toLowerCase()
    .trim();

  switch (provider) {
    case 'azure_openai':
    case 'openai':
      return new AzureOpenAiMenuCategoryExtractor();
    case 'qwen':
      return new QwenMenuCategoryExtractor();
    case 'typechat':
      return new TypeChatMenuCategoryExtractor();
    case 'typechat_qwen':
    case 'typechat-qwen':
      return new TypeChatQwenMenuCategoryExtractor();
    default:
      throw new Error(
        `Unsupported UBEREATS_LLM_PROVIDER: "${provider}". Expected "azure_openai", "qwen", "typechat", or "typechat_qwen".`
      );
  }
}

export async function azureOpenAiExtractRestaurantInfo(params: {
  markdown: string;
  html: string;
}): Promise<{ jsonString: string; data: any }> {
  const markdown = params.markdown?.trim() ?? '';
  const html = params.html?.trim() ?? '';
  if (!markdown && !html) {
    throw new Error('No markdown or html content provided for extraction');
  }

  const key = requireEnv('AZURE_OPENAI_KEY');
  const endpoint = requireEnv('AZURE_OPENAI_ENDPOINT');
  const deployment = requireEnv('AZURE_OPENAI_DEPLOYMENT');
  const apiVersion = requireEnv('OPEN_AI_VERSION');

  const url = `${endpoint.replace(
    /\/+$/g,
    ''
  )}/openai/deployments/${deployment}/chat/completions?api-version=${encodeURIComponent(
    apiVersion
  )}`;

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    {
      role: 'system',
      content:
        `You are an expert data transformation. Your task is to parse the provided content (Markdown and/or HTML) scraped from an Uber Eats restaurant page, and extract the relevant restaurant information. ` +
        `Format the output strictly as a JSON object conforming to the following TypeScript interface. ` +
        `Ignore all irrelevant information like general site navigation, promotions, footer links, web cookies, notices, etc., focusing only on the specific restaurant's data (name, rating, address, description, hours, menu items, prices, categories). ` +
        `Output ONLY the JSON object.\n\nTarget Interface:\n${targetInterface}`,
    },
  ];

  if (markdown) {
    messages.push({
      role: 'user',
      content: `Parse the following Markdown content:\n\n---\n${markdown}\n---`,
    });
  }
  if (html) {
    messages.push({
      role: 'user',
      content: `Parse the following HTML content:\n\n---\n${html}\n---`,
    });
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      response_format: { type: 'json_object' },
      messages,
      temperature: 0.1,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Azure OpenAI error (${res.status}): ${raw}`);
  }

  const responseJson = safeJsonParse(
    raw,
    'Azure OpenAI returned non-JSON response'
  ) as any;

  const content = responseJson?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Azure OpenAI response missing content');
  }

  const data = safeJsonParse(
    content,
    'Failed to parse JSON object from Azure OpenAI content'
  ) as any;

  if (!data?.name || typeof data.name !== 'string') {
    throw new Error('Extracted JSON is missing restaurant name');
  }

  return { jsonString: JSON.stringify(data), data };
}

export async function azureOpenAiExtractMenuCategory(params: {
  html: string;
}): Promise<{ jsonString: string; data: any }> {
  const html = params.html?.trim() ?? '';
  if (!html) {
    throw new Error('No html content provided for menu category extraction');
  }

  const key = requireEnv('AZURE_OPENAI_KEY');
  const endpoint = requireEnv('AZURE_OPENAI_ENDPOINT');
  const deployment = requireEnv('AZURE_OPENAI_DEPLOYMENT');
  const apiVersion = requireEnv('OPEN_AI_VERSION');

  const url = `${endpoint.replace(
    /\/+$/g,
    ''
  )}/openai/deployments/${deployment}/chat/completions?api-version=${encodeURIComponent(
    apiVersion
  )}`;

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    {
      role: 'system',
      content:
        `You are an expert data extraction assistant. Your task is to parse ONE Uber Eats menu category HTML block (a <li> that represents a category). ` +
        `Extract the category name and ALL items (products) inside it.\n\n` +
        `Format the output strictly as a JSON object conforming to the TypeScript type MenuCategory (from the Target Interface below). ` +
        `Ignore all irrelevant information like site navigation, promotions, footers, cookies, etc.\n\n` +
        `Critical: Every MenuItem must include imageUrl (best available product image URL, absolute if possible) and price.\n\n` +
        `Target Interface:\n${targetInterface}\n\nDesired type: MenuCategory`,
    },
    {
      role: 'user',
      content: `Parse the following HTML content:\n\n---\n${html}\n---`,
    },
  ];

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      response_format: { type: 'json_object' },
      messages,
      temperature: 0.1,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Azure OpenAI error (${res.status}): ${raw}`);
  }

  const responseJson = safeJsonParse(
    raw,
    'Azure OpenAI returned non-JSON response'
  ) as any;

  const content = responseJson?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Azure OpenAI response missing content');
  }

  const data = safeJsonParse(
    content,
    'Failed to parse JSON object from Azure OpenAI content'
  ) as any;

  const categoryName = data?.categoryName;
  if (typeof categoryName !== 'string' || !categoryName.trim()) {
    throw new Error('Extracted JSON is missing categoryName');
  }

  return { jsonString: JSON.stringify(data), data };
}
