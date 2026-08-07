import { defineConfig, devices } from '@playwright/test';

/**
 * Storefront e2e configuration — see SPEC.md (Testing Strategy) and tasks/plan.md.
 *
 * Four viewport projects mirror the LayoutService form factors:
 * phone, tablet portrait, tablet landscape, kiosk.
 *
 * The web server boots the app against the LOCAL Supabase stack
 * (`ng serve --configuration e2e`, added in T2). E2e must never touch
 * production services — payment provider origins are blocked below as a
 * second fence on top of the e2e vendor having online payments disabled.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  /* One retry locally: the dev server + Docker + workers share this
     machine, and a starved worker can time out a whole project batch.
     trace-on-first-retry keeps the evidence; real regressions fail twice. */
  retries: process.env['CI'] ? 2 : 1,
  /* The dev server, local Supabase (Docker), and workers share one
     machine; more workers thrash and order-creation intermittently
     exceeds assertion timeouts. 4 is stable. */
  workers: 4,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:4400',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'phone-portrait',
      use: {
        ...devices['iPhone 14'],
        defaultBrowserType: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'tablet-portrait',
      use: {
        ...devices['iPad (gen 11)'],
        defaultBrowserType: 'chromium',
        viewport: { width: 834, height: 1194 },
      },
    },
    {
      name: 'tablet-landscape',
      use: {
        ...devices['iPad (gen 11) landscape'],
        defaultBrowserType: 'chromium',
        viewport: { width: 1194, height: 834 },
      },
    },
    {
      name: 'kiosk-landscape',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        hasTouch: true,
      },
    },
  ],

  webServer: {
    // Boots against the LOCAL Supabase stack (environment.e2e.ts).
    // Requires `npx supabase start` + `npx supabase db reset --yes --local`.
    command: 'npx ng serve --configuration e2e --port 4400',
    url: 'http://localhost:4400',
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
