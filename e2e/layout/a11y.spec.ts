import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { E2E_VENDOR } from '../fixtures/vendor';
import {
  gotoStorefront,
  gotoWelcomeScreen,
  openCategory,
} from '../fixtures/helpers';

/**
 * WCAG 2.1 AA scan of the storefront journey (SPEC.md FR8, plan T14).
 * Every screen is scanned in BOTH themes — dark mode regressions are a
 * stated risk of the token restyle.
 */

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((t) => {
    // Freeze transitions/animations: axe samples computed colors, and the
    // theme flip would otherwise be scanned mid-transition (false fails).
    if (!document.getElementById('axe-freeze')) {
      const style = document.createElement('style');
      style.id = 'axe-freeze';
      style.textContent =
        '*, *::before, *::after { transition: none !important; animation: none !important; }';
      document.head.appendChild(style);
    }
    document.documentElement.classList.toggle('dark-mode', t === 'dark');
  }, theme);
}

async function expectNoAAViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target).slice(0, 5),
    }))
  ).toEqual([]);
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`a11y — WCAG 2.1 AA (${theme})`, () => {
    test(`welcome screen (${theme})`, async ({ page }) => {
      await gotoWelcomeScreen(page);
      await setTheme(page, theme);
      await expectNoAAViolations(page);
    });

    test(`category grid (${theme})`, async ({ page }) => {
      await gotoStorefront(page);
      await setTheme(page, theme);
      await expectNoAAViolations(page);
    });

    test(`product grid (${theme})`, async ({ page }) => {
      await gotoStorefront(page);
      await openCategory(page, E2E_VENDOR.categories.burgers);
      await setTheme(page, theme);
      await expectNoAAViolations(page);
    });

    test(`product page (${theme})`, async ({ page }) => {
      await gotoStorefront(page);
      await openCategory(page, E2E_VENDOR.categories.burgers);
      await page.getByText(E2E_VENDOR.products.simple.name).first().click();
      await setTheme(page, theme);
      await expectNoAAViolations(page);
    });
  });
}
