import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The webview loads the live hosted site rather than assets bundled in the APK.
 *
 * This keeps `window.location.hostname` a real domain, so DomainService /
 * customDomainVendorGuard / VendorNavigationService and the
 * `window.location.origin`-based Stripe & PayGreen return URLs keep working
 * unchanged. It also means frontend changes ship through the existing FTP
 * deploy - no new APK.
 *
 * Two apps ship from this one project, selected via PICKI_APP_ID:
 * - Shop (com.pikiapp.tablet): opens on /kiosk, which asks the vendor to
 *   log in once and then lands on their public storefront (see
 *   kiosk-entry.guard.ts). One generic APK serves every vendor; a vendor
 *   on a custom domain can still bake their domain in to skip the login:
 *     PICKI_APP_URL=https://granola.fr npm run android:sync
 * - Admin (com.pikiapp.admin): opens straight on /admin for order and
 *   menu management: npm run android:sync:admin
 *
 * Staging APKs (installable alongside the prod apps thanks to their own
 * appIds): npm run android:sync:staging / android:sync:admin:staging
 *
 * Keep the label map in sync with android/app/build.gradle (the webview
 * shell ignores appName after project creation; gradle owns the label).
 */
const appUrl = process.env['PICKI_APP_URL'] || 'https://piki-app.com/kiosk';
const appHost = new URL(appUrl).hostname;
const appId = process.env['PICKI_APP_ID'] || 'com.pikiapp.tablet';

const appNames: Record<string, string> = {
  'com.pikiapp.tablet': 'Picki',
  'com.pikiapp.tablet.staging': 'Picki Staging',
  'com.pikiapp.admin': 'Picki Admin',
  'com.pikiapp.admin.staging': 'Picki Admin Staging',
};

const config: CapacitorConfig = {
  appId,
  appName: process.env['PICKI_APP_NAME'] || appNames[appId] || appId,
  // Only used as an offline fallback shell; the webview serves `server.url`.
  webDir: 'dist/my-angular-app/browser',
  android: {
    // Cheap tablets ship old webviews; fail loudly rather than silently.
    allowMixedContent: false,
  },
  server: {
    url: appUrl,
    androidScheme: 'https',
    cleartext: false,
    // Keep payment redirects inside the webview so they can come back to the app.
    allowNavigation: [
      appHost,
      '*.piki-app.com',
      'checkout.stripe.com',
      '*.stripe.com',
      '*.paygreen.fr',
      '*.paygreen.io',
    ],
  },
  plugins: {
    CapacitorHttp: {
      enabled: false,
    },
  },
};

export default config;
