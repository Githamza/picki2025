declare module 'https://deno.land/std@0.200.0/http/server.ts' {
  export function serve(
    handler: (req: Request) => Response | Promise<Response>
  ): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export function createClient(...args: any[]): any;
}

declare module 'npm:typechat' {
  export function createLanguageModel(
    env: Record<string, string | undefined>
  ): any;
  export function createJsonTranslator<T>(model: any, validator: any): any;
  export function createOpenAILanguageModel(
    apiKey: string,
    model: string,
    endPoint?: string,
    org?: string
  ): any;
  export function createAzureOpenAILanguageModel(
    apiKey: string,
    endPoint: string
  ): any;
}

declare module 'npm:typechat/ts' {
  export function createTypeScriptJsonValidator<T>(
    schema: string,
    typeName: string
  ): any;
}

declare module 'npm:typescript@^5.0.0' {
  const ts: any;
  export default ts;
}

declare module 'npm:node-html-parser@6.1.13' {
  export function parse(...args: any[]): any;
}

declare module 'ubereats' {
  export const corsHeaders: Record<string, string>;
  export const json: (data: unknown, init?: ResponseInit) => Response;
  export function sanitizeSlug(input: string): string;
  export function getServiceSupabaseClient(): any;
  export function ensureStorageBucket(
    supabase: any,
    bucket: string
  ): Promise<void>;
  export function uploadJsonToStorage(params: {
    bucket: string;
    path: string;
    jsonString: string;
  }): Promise<void>;
  export function firecrawlScrapeMarkdownAndHtml(
    url: string
  ): Promise<{ markdown: string; html: string }>;
  export function extractUberEatsMenuCategoryLisFromStoreContainerHtml(
    storeContainerHtml: string
  ): string[];
  export function extractUberEatsStoreContainerHtmlFromPageHtml(
    pageHtml: string
  ): string;
  export function stripUberEatsMenuFromStoreContainerHtml(
    storeContainerHtml: string
  ): string;
  export function firecrawlScrapeUberEatsMenuCategoryLis(url: string): Promise<{
    storeContainerHtml: string;
    menuCategoryLis: string[];
  }>;
  export function isFirecrawlJsonModeEnabled(): boolean;
  export const restaurantInfoJsonSchema: unknown;
  export function firecrawlScrapeRestaurantInfoJson(params: {
    url: string;
    prompt?: string;
  }): Promise<unknown>;
  export const targetInterface: string;
  export interface MenuItem {
    name: string;
    price: string;
    imageUrl: string;
    description?: string;
  }
  export interface MenuCategory {
    categoryName: string;
    items: MenuItem[];
  }
  export interface OperatingHoursPeriod {
    open: string;
    close: string;
  }
  export interface OperatingHoursDay {
    dayRange: string;
    periods: OperatingHoursPeriod[];
  }
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
    extractRestaurantInfo(params: {
      markdown: string;
      html: string;
    }): Promise<{ jsonString: string; data: unknown }>;
  }
  export class QwenRestaurantInfoExtractor implements RestaurantInfoExtractor {
    extractRestaurantInfo(params: {
      markdown: string;
      html: string;
    }): Promise<{ jsonString: string; data: unknown }>;
  }
  export class TypeChatRestaurantInfoExtractor
    implements RestaurantInfoExtractor
  {
    extractRestaurantInfo(params: {
      markdown: string;
      html: string;
    }): Promise<{ jsonString: string; data: unknown }>;
  }
  export function getRestaurantInfoExtractorFromEnv(): RestaurantInfoExtractor;
  export interface MenuCategoryExtractor {
    extractMenuCategory(params: {
      html: string;
    }): Promise<{ jsonString: string; data: unknown }>;
  }
  export class AzureOpenAiMenuCategoryExtractor implements MenuCategoryExtractor {
    extractMenuCategory(params: {
      html: string;
    }): Promise<{ jsonString: string; data: unknown }>;
  }
  export class QwenMenuCategoryExtractor implements MenuCategoryExtractor {
    extractMenuCategory(params: {
      html: string;
    }): Promise<{ jsonString: string; data: unknown }>;
  }
  export class TypeChatMenuCategoryExtractor implements MenuCategoryExtractor {
    extractMenuCategory(params: {
      html: string;
    }): Promise<{ jsonString: string; data: unknown }>;
  }
  export class TypeChatQwenMenuCategoryExtractor
    implements MenuCategoryExtractor
  {
    extractMenuCategory(params: {
      html: string;
    }): Promise<{ jsonString: string; data: unknown }>;
  }
  export function getMenuCategoryExtractorFromEnv(): MenuCategoryExtractor;
  export function azureOpenAiExtractRestaurantInfo(params: {
    markdown: string;
    html: string;
  }): Promise<{ jsonString: string; data: any }>;
  export function azureOpenAiExtractMenuCategory(params: {
    html: string;
  }): Promise<{ jsonString: string; data: any }>;
}
