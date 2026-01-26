import { Injectable, inject } from '@angular/core';
import { SupabaseAuthService } from './supabase-auth.service';

import { DefaultCatalogService } from './default-catalog.service';
import type { OnboardingCatalog } from './onboarding-catalog.types';

export type CreateVendorAccountInput = {
  businessName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  uberEatsUrl?: string;
};

export type CreateVendorAccountResult = {
  vendorId: string;
  businessName: string;
  email: string;
  catalogSource?: 'default' | 'ubereats';
};

export type UberEatsImportProgress = {
  formattedCategories: number;
  totalCategories: number;
};

export type CreateVendorAccountOptions = {
  onUberEatsProgress?: (progress: UberEatsImportProgress) => void;
};

type UberEatsScrapeResult = {
  error?: string;
  mode?: 'markdown' | 'json';
  desiredType?: string;
  markdown?: string;
  html?: string;
  menuCategoryLis?: string[];
  totalCategories?: number;
  data?: unknown;
  bucket?: string;
  path?: string;
};

type UberEatsFormatResult = {
  error?: string;
  complete?: boolean;
  formattedCategoryCount?: number;
  totalCategories?: number;
  bucket?: string;
  path?: string;
  data?: unknown;
};

type UberEatsRestaurantInfo = {
  name?: string;
  bannerImageUrl?: string;
  operatingHours?: Array<{
    dayRange?: string;
    periods?: Array<{
      open?: string;
      close?: string;
    }>;
  }>;
  menu?: Array<{
    categoryName?: string;
    items?: Array<{
      name?: string;
      price?: string;
      description?: string;
      imageUrl?: string;
    }>;
  }>;
};

@Injectable({ providedIn: 'root' })
export class VendorOnboardingService {
  private readonly supabaseAuthService = inject(SupabaseAuthService);
  private readonly defaultCatalogService = inject(DefaultCatalogService);

  private readonly defaultBanner = {
    image_url:
      'https://t4.ftcdn.net/jpg/03/53/68/47/360_F_353684779_sXaY7PHyX6Xb9okW7qjVfARj96YIJMZ1.jpg',
    title: 'Ajoutez votre propre bannière',
    link_url: null,
  } as const;

  async createVendorAccount(
    input: CreateVendorAccountInput,
    options?: CreateVendorAccountOptions
  ): Promise<CreateVendorAccountResult> {
    const defaultCatalog = await this.defaultCatalogService.getDefaultCatalog();
    let catalog: OnboardingCatalog = defaultCatalog;
    let catalogSource: CreateVendorAccountResult['catalogSource'] = 'default';
    let businessHours:
      | Array<{
          day_of_week: number;
          open_time: string | null;
          close_time: string | null;
          is_closed: boolean;
        }>
      | undefined;

    const uberEatsUrl = input.uberEatsUrl?.trim() ?? '';
    if (uberEatsUrl) {
      try {
        const formatted = await this.scrapeUberEatsRestaurantToJson(
          uberEatsUrl,
          options?.onUberEatsProgress
        );
        const mapped = this.toOnboardingCatalogFromUberEats(formatted.data);
        const extras = this.extractRestaurantExtrasFromUberEats(formatted.data);
        if (mapped && mapped.categories.length && mapped.products.length) {
          catalog = mapped;
          if (extras?.bannerImageUrl) {
            catalog = {
              ...catalog,
              banners: [
                {
                  image_url: extras.bannerImageUrl,
                  title: (input.businessName || '').trim() || null,
                  link_url: null,
                },
              ],
            };
          }
          if (extras?.businessHours?.length) {
            businessHours = extras.businessHours;
          }
          catalogSource = 'ubereats';
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(message || 'Uber Eats import failed');
      }
    }

    // Default store banner (placeholder) for new stores:
    // - Always use it when NOT importing from Uber Eats (overrides default catalog banners)
    // - Use it as a fallback if Uber Eats import succeeds but doesn't provide a banner
    if (catalogSource !== 'ubereats' || !catalog.banners?.length) {
      catalog = { ...catalog, banners: [this.defaultBanner] };
    }

    const { data, error } = await this.supabaseAuthService
      .getClient()
      .functions.invoke<CreateVendorAccountResult>('create-vendor-account', {
        body: {
          businessName: input.businessName,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          password: input.password,
          catalog,
          ...(businessHours ? { businessHours } : {}),
        },
      });

    if (error) {
      throw new Error(error.message || 'Failed to create account');
    }

    if (!data?.vendorId) {
      throw new Error('Failed to create account');
    }

    return { ...data, catalogSource };
  }

  /**
   * Scrape an Uber Eats restaurant page, format it into structured JSON,
   * and save it to Supabase Storage via Edge Functions.
   *
   * Note: Edge Functions are deployed with verify_jwt=false, so this can run before login.
   */
  async scrapeUberEatsRestaurantToJson(
    uberEatsUrl: string,
    onProgress?: (progress: UberEatsImportProgress) => void
  ): Promise<UberEatsFormatResult> {
    const trimmedUrl = uberEatsUrl.trim();
    if (!trimmedUrl) {
      throw new Error('Uber Eats URL is required');
    }

    const { data: scrapeData, error: scrapeError } =
      await this.supabaseAuthService
        .getClient()
        .functions.invoke<UberEatsScrapeResult>('ubereatdatascrapper', {
          body: { url: trimmedUrl },
        });

    if (scrapeError) {
      throw new Error(scrapeError.message || 'Failed to scrape Uber Eats URL');
    }

    const scrapeErrorMessage = this.extractEdgeFunctionError(scrapeData);
    if (scrapeErrorMessage) {
      throw new Error(scrapeErrorMessage);
    }

    // If the backend is configured to use Firecrawl JSON mode, it can return
    // the structured RestaurantInfo directly and store it server-side.
    if (this.isRecord(scrapeData) && scrapeData['mode'] === 'json') {
      const data = (scrapeData as { data?: unknown })?.data;
      if (!data) {
        throw new Error('Uber Eats scraper returned empty JSON data');
      }
      const bucket =
        typeof scrapeData['bucket'] === 'string' ? (scrapeData['bucket'] as string) : undefined;
      const path =
        typeof scrapeData['path'] === 'string' ? (scrapeData['path'] as string) : undefined;

      return { ...(bucket ? { bucket } : {}), ...(path ? { path } : {}), data };
    }

    const markdownContent = this.extractNonEmptyString(scrapeData, 'markdown');
    const htmlContent = this.extractNonEmptyString(scrapeData, 'html');
    if (!markdownContent && !htmlContent) {
      throw new Error('Uber Eats scraper returned empty content');
    }

    const menuCategoryLis = this.extractStringArray(scrapeData, 'menuCategoryLis');
    const totalCategories =
      (this.isRecord(scrapeData) && typeof scrapeData['totalCategories'] === 'number'
        ? (scrapeData['totalCategories'] as number)
        : null) ?? menuCategoryLis.length;

    // If the scraper didn't provide category blocks, fallback to one-shot formatting.
    if (!menuCategoryLis.length || totalCategories <= 0) {
      const { data: formatData, error: formatError } =
        await this.supabaseAuthService
          .getClient()
          .functions.invoke<UberEatsFormatResult>('ubereatformatter', {
            body: {
              markdownContent,
              htmlContent,
              saveToStorage: true,
            },
          });

      if (formatError) {
        throw new Error(formatError.message || 'Failed to format Uber Eats data');
      }

      const formatErrorMessage = this.extractEdgeFunctionError(formatData);
      if (formatErrorMessage) {
        throw new Error(formatErrorMessage);
      }

      if (!formatData || !('data' in formatData)) {
        throw new Error('Uber Eats formatter returned an invalid response');
      }

      return formatData ?? {};
    }

    onProgress?.({ formattedCategories: 0, totalCategories });

    let partialRestaurantInfo: unknown = undefined;
    let lastResponse: UberEatsFormatResult | null = null;

    for (let i = 0; i < totalCategories; i++) {
      const categoryLiHtml = menuCategoryLis[i] ?? '';
      if (!categoryLiHtml.trim()) continue;

      const isLast = i === totalCategories - 1;
      const body =
        i === 0
          ? {
              markdownContent,
              htmlContent,
              categoryLiHtml,
              totalCategories,
              categoryIndex: 0,
              saveToStorage: isLast,
            }
          : {
              partialRestaurantInfo,
              categoryLiHtml,
              totalCategories,
              categoryIndex: i,
              saveToStorage: isLast,
            };

      const { data: formatData, error: formatError } =
        await this.supabaseAuthService
          .getClient()
          .functions.invoke<UberEatsFormatResult>('ubereatformatter', { body });

      if (formatError) {
        throw new Error(formatError.message || 'Failed to format Uber Eats data');
      }

      const formatErrorMessage = this.extractEdgeFunctionError(formatData);
      if (formatErrorMessage) {
        throw new Error(formatErrorMessage);
      }

      if (!formatData || !('data' in formatData)) {
        throw new Error('Uber Eats formatter returned an invalid response');
      }

      partialRestaurantInfo = formatData.data;
      lastResponse = formatData;
      onProgress?.({ formattedCategories: i + 1, totalCategories });

      if (formatData.complete === true) break;
    }

    if (!lastResponse) {
      throw new Error('Uber Eats formatter returned an invalid response');
    }

    return lastResponse;
  }

  private toOnboardingCatalogFromUberEats(
    data: unknown
  ): OnboardingCatalog | null {
    if (!this.isRecord(data)) {
      return null;
    }

    const info = data as UberEatsRestaurantInfo;
    const menu = info.menu;
    if (!Array.isArray(menu) || menu.length === 0) {
      return null;
    }

    const categories: OnboardingCatalog['categories'] = [];
    const products: OnboardingCatalog['products'] = [];
    const keyByCategoryName = new Map<string, string>();

    for (const category of menu) {
      const categoryName = (category?.categoryName ?? '').toString().trim();
      if (!categoryName) continue;

      let key = keyByCategoryName.get(categoryName);
      if (!key) {
        key =
          this.sanitizeKey(categoryName) || `cat-${keyByCategoryName.size + 1}`;
        // Avoid collisions
        while (categories.some((c) => c.key === key)) {
          key = `${key}-${Math.floor(Math.random() * 10_000)}`;
        }
        keyByCategoryName.set(categoryName, key);
        categories.push({ key, name: categoryName });
      }

      const items = category?.items;
      if (!Array.isArray(items) || items.length === 0) continue;

      for (const item of items) {
        const name = (item?.name ?? '').toString().trim();
        if (!name) continue;

        const parsedPrice = this.parsePriceToNumber(item?.price);
        if (parsedPrice === null) continue;

        const description = (item?.description ?? '').toString().trim();
        const imageUrl = (item?.imageUrl ?? '').toString().trim();

        products.push({
          name,
          price: parsedPrice,
          categoryKey: key,
          ...(description
            ? { short_description: description, long_description: description }
            : {}),
          ...(imageUrl ? { image_url: imageUrl } : {}),
        });
      }
    }

    if (!categories.length || !products.length) {
      return null;
    }

    return { categories, products };
  }

  private extractRestaurantExtrasFromUberEats(data: unknown): {
    bannerImageUrl?: string;
    businessHours?: Array<{
      day_of_week: number;
      open_time: string | null;
      close_time: string | null;
      is_closed: boolean;
    }>;
  } | null {
    if (!this.isRecord(data)) return null;
    const info = data as UberEatsRestaurantInfo;

    const bannerImageUrl = (info.bannerImageUrl ?? '').toString().trim();
    const businessHours = this.toBusinessHoursFromUberEats(info.operatingHours);

    return {
      ...(bannerImageUrl ? { bannerImageUrl } : {}),
      ...(businessHours?.length ? { businessHours } : {}),
    };
  }

  private toBusinessHoursFromUberEats(
    operatingHours: UberEatsRestaurantInfo['operatingHours'] | undefined
  ): Array<{
    day_of_week: number;
    open_time: string | null;
    close_time: string | null;
    is_closed: boolean;
  }> | null {
    if (!Array.isArray(operatingHours) || operatingHours.length === 0) {
      return null;
    }

    const result: Array<{
      day_of_week: number;
      open_time: string | null;
      close_time: string | null;
      is_closed: boolean;
    }> = Array.from({ length: 7 }, (_, day) => ({
      day_of_week: day,
      open_time: null,
      close_time: null,
      is_closed: true,
    }));

    for (const day of operatingHours) {
      const dayRange = (day?.dayRange ?? '').toString().trim();
      const indices = this.expandDayRangeToDayOfWeekIndices(dayRange);
      if (!indices.length) continue;

      const periods = Array.isArray(day?.periods) ? day.periods : [];
      if (!periods.length) {
        for (const idx of indices) {
          result[idx] = {
            day_of_week: idx,
            open_time: null,
            close_time: null,
            is_closed: true,
          };
        }
        continue;
      }

      // If multiple periods exist, approximate with earliest open / latest close.
      let openTime: string | null = null;
      let closeTime: string | null = null;

      for (const p of periods) {
        const open = (p?.open ?? '').toString().trim();
        const close = (p?.close ?? '').toString().trim();
        if (!this.isValidTime(open) || !this.isValidTime(close)) continue;

        if (!openTime || open < openTime) openTime = open;
        if (!closeTime || close > closeTime) closeTime = close;
      }

      const isClosed = !openTime || !closeTime;
      for (const idx of indices) {
        result[idx] = {
          day_of_week: idx,
          open_time: isClosed ? null : openTime,
          close_time: isClosed ? null : closeTime,
          is_closed: isClosed,
        };
      }
    }

    return result;
  }

  private expandDayRangeToDayOfWeekIndices(dayRangeRaw: string): number[] {
    const raw = (dayRangeRaw || '').trim();
    if (!raw) return [];

    const normalized = this.normalizeDayString(raw);
    if (
      normalized.includes('everyday') ||
      normalized.includes('every day') ||
      normalized.includes('daily') ||
      normalized.includes('touslesjours') ||
      normalized.includes('tous les jours')
    ) {
      return [0, 1, 2, 3, 4, 5, 6];
    }

    const dashNormalized = normalized
      .replace(/\s*(–|—|to)\s*/g, '-')
      .replace(/\s*-\s*/g, '-');

    const parts = dashNormalized
      .split('-')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 1) {
      const idx = this.dayToIndex(parts[0]);
      return idx === null ? [] : [idx];
    }

    // Only handle simple ranges like "mon-fri"
    const start = this.dayToIndex(parts[0]);
    const end = this.dayToIndex(parts[parts.length - 1]);
    if (start === null || end === null) return [];

    const indices: number[] = [];
    let i = start;
    while (true) {
      indices.push(i);
      if (i === end) break;
      i = (i + 1) % 7;
      if (indices.length > 7) break; // safety
    }
    return indices;
  }

  private normalizeDayString(input: string): string {
    return input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private dayToIndex(day: string): number | null {
    const d = this.normalizeDayString(day);
    const map: Record<string, number> = {
      // English
      sunday: 0,
      sun: 0,
      monday: 1,
      mon: 1,
      tuesday: 2,
      tue: 2,
      tues: 2,
      wednesday: 3,
      wed: 3,
      thursday: 4,
      thu: 4,
      thur: 4,
      thurs: 4,
      friday: 5,
      fri: 5,
      saturday: 6,
      sat: 6,
      // French
      dimanche: 0,
      dim: 0,
      lundi: 1,
      lun: 1,
      mardi: 2,
      mar: 2,
      mercredi: 3,
      mer: 3,
      jeudi: 4,
      jeu: 4,
      vendredi: 5,
      ven: 5,
      samedi: 6,
      sam: 6,
    };
    return map[d] ?? null;
  }

  private isValidTime(value: string): boolean {
    // Expect "HH:mm"
    return /^\d{2}:\d{2}$/.test(value);
  }

  private parsePriceToNumber(price: unknown): number | null {
    if (price === null || price === undefined) return null;
    const raw = String(price).trim();
    if (!raw) return null;

    // Common examples: "12,50 €", "€12.50", "12.50", "12"
    const normalized = raw
      .replace(/\s/g, '')
      .replace(/€/g, '')
      .replace(',', '.');

    const match = /(\d+(?:\.\d+)?)/.exec(normalized);
    if (!match?.[1]) return null;

    const value = Number(match[1]);
    if (!Number.isFinite(value)) return null;
    return value;
  }

  private sanitizeKey(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
  }

  private extractStringArray(obj: unknown, field: string): string[] {
    if (!this.isRecord(obj)) return [];
    const raw = obj[field];
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter((v) => !!v);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private extractEdgeFunctionError(value: unknown): string | null {
    if (!this.isRecord(value)) return null;
    const err = value['error'];
    if (typeof err !== 'string') return null;
    const msg = err.trim();
    return msg ? msg : null;
  }

  private extractNonEmptyString(
    value: unknown,
    key: string
  ): string {
    if (!this.isRecord(value)) return '';
    const raw = value[key];
    if (typeof raw !== 'string') return '';
    return raw.trim();
  }
}
