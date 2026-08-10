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
 * A vendor on a custom domain must build with their own domain:
 *   PICKI_APP_URL=https://granola.fr npm run android:sync
 *
 * Staging APK (installable alongside the prod app thanks to its own appId):
 *   npm run android:sync:staging
 */
const appUrl = process.env['PICKI_APP_URL'] || 'https://piki-app.com';
const appHost = new URL(appUrl).hostname;
const appId = process.env['PICKI_APP_ID'] || 'com.pikiapp.tablet';

const config: CapacitorConfig = {
  appId,
  appName: appId === 'com.pikiapp.tablet' ? 'Picki' : 'Picki Staging',
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
