/// <reference path="../edge-url-modules.d.ts" />
import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';
import {
  corsHeaders,
  extractUberEatsMenuCategoryLisFromStoreContainerHtml,
  firecrawlScrapeMarkdownAndHtml,
  firecrawlScrapeRestaurantInfoJson,
  isFirecrawlJsonModeEnabled,
  json,
  sanitizeSlug,
  uploadJsonToStorage,
} from 'ubereats';

interface ScrapeRequestBody {
  url?: string;
  prompt?: string;
  saveToStorage?: boolean;
  bucket?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  let body: ScrapeRequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const url = body.url;
  if (!url) {
    return json(
      {
        error:
          'Please provide a URL in the request body as { "url": "https://example.com" }',
      },
      { status: 400 }
    );
  }

  try {
    const jsonMode = isFirecrawlJsonModeEnabled();
    if (jsonMode) {
      const data = await firecrawlScrapeRestaurantInfoJson({
        url,
        prompt: body.prompt,
      });

      const bucket = body.bucket || Deno.env.get('UBEREATS_STORAGE_BUCKET') || 'ubereats';
      const saveToStorage = body.saveToStorage ?? true;

      const nameRaw = (data as { name?: unknown })?.name;
      const name = typeof nameRaw === 'string' ? nameRaw.trim() : '';
      const slugSource = name || url;
      const restaurantSlug = sanitizeSlug(slugSource) || `ubereats-${Date.now()}`;
      const objectPath = `restaurants/${restaurantSlug}/restaurant_info.json`;

      if (saveToStorage) {
        await uploadJsonToStorage({
          bucket,
          path: objectPath,
          jsonString: JSON.stringify(data),
        });
      }

      return json({
        message: 'URL scraped successfully (json mode)',
        url,
        scraped: true,
        mode: 'json',
        desiredType: 'RestaurantInfo',
        ...(saveToStorage ? { bucket, path: objectPath } : {}),
        data,
      });
    }

    const { markdown, html } = await firecrawlScrapeMarkdownAndHtml(url);
    const menuCategoryLis = extractUberEatsMenuCategoryLisFromStoreContainerHtml(html);
    return json({
      message: 'URL scraped successfully',
      url,
      scraped: true,
      mode: 'markdown',
      desiredType: 'RestaurantInfo',
      markdown,
      html,
      menuCategoryLis,
      totalCategories: menuCategoryLis.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, { status: 500 });
  }
});
