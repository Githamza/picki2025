import { test, expect } from '@playwright/test';

/**
 * Smoke: the app boots in every viewport project, and the e2e build is
 * fully isolated from production services. Any request to production
 * Supabase, Stripe, or PayGreen fails this spec — the standing fence
 * required by SPEC.md ("Never run e2e against production").
 */
const FORBIDDEN_ORIGINS = [
  /\.supabase\.co\//, // production Supabase (local stack is 127.0.0.1:54321)
  /stripe\.com/,
  /paygreen\.fr/,
];

test('app shell renders without touching production services', async ({
  page,
}) => {
  const leaked: string[] = [];
  page.on('request', (request) => {
    if (FORBIDDEN_ORIGINS.some((origin) => origin.test(request.url()))) {
      leaked.push(request.url());
    }
  });

  await page.goto('/');
  await expect(page.locator('app-root')).toBeAttached();

  expect(leaked, `e2e build must not call production services`).toEqual([]);
});
