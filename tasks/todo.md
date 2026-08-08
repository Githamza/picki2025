# Task List: Storefront UI Redesign

Source: `SPEC.md` + `tasks/plan.md`. Statuses: `[ ]` todo · `[x]` done.
Run order is top-to-bottom; dependencies noted per task.

---

## Phase 0 — E2E foundation

- [x] **T1: Install Playwright with four viewport projects**
  - **Description:** Add `@playwright/test` (dev dep — confirm at install). Create `playwright.config.ts` with projects `phone-portrait` (390×844), `tablet-portrait` (834×1194), `tablet-landscape` (1194×834), `kiosk-landscape` (1920×1080); `webServer` runs `ng serve --configuration e2e --port 4400`; block requests to Stripe/PayGreen origins globally.
  - Acceptance: `npx playwright test` starts the dev server and runs an empty spec in all four projects.
  - Verify: `npx playwright test e2e/smoke.spec.ts` green; `git status` shows no stray artifacts (report dirs gitignored).
  - Files: `package.json`, `playwright.config.ts`, `.gitignore`, `e2e/smoke.spec.ts`
  - Dependencies: none · **Size: S**

- [x] **T2: e2e build configuration targeting local Supabase**
  - **Description:** Add `src/environments/environment.e2e.ts` (supabase url/key → `http://127.0.0.1:54321` + local anon key, `backendUrl` local, test Stripe key) and an `e2e` configuration in `angular.json` with fileReplacement.
  - Acceptance: `ng serve --configuration e2e` boots against local Supabase; no request to `*.supabase.co` in the network log.
  - Verify: manual check with local stack running; `npm run build` still clean.
  - Files: `angular.json`, `src/environments/environment.e2e.ts`
  - Dependencies: T1 · **Size: S**

- [x] **T3: Deterministic seed data**
  - **Description:** Create `supabase/seed.sql` (already referenced by `config.toml` but missing): vendor `e2e-cafe` with `online_payments_enabled = false`, `is_active = true`, 24/7 `business_hours`, all order types enabled; 2 categories; 2 simple products (one out of stock); 1 multi-step product with a required single-select, a required multi-select (`min_selections=1`, `max_selections=2`), and an optional step; 1 banner.
  - Acceptance: `supabase db reset --yes --local` loads the seed; `/vendor/e2e-cafe` renders categories and products.
  - Verify: manual smoke in browser against local stack.
  - Files: `supabase/seed.sql`
  - Dependencies: T2 · **Size: S**

- [x] **T4: Baseline journey spec**
  - **Description:** `e2e/journeys/order-flow.spec.ts`: land on `/vendor/e2e-cafe` → dining preference (take-away) → category → simple product → add to cart → open cart sheet → customer details (name + required phone) → place order via pay-at-counter branch → assert order confirmation. Shared helpers in `e2e/fixtures/`.
  - Acceptance: spec passes in all four viewport projects against current UI.
  - Verify: `npx playwright test e2e/journeys/` green ×3 consecutive runs.
  - Files: `e2e/journeys/order-flow.spec.ts`, `e2e/fixtures/vendor.ts`, `e2e/fixtures/helpers.ts`
  - Dependencies: T3 · **Size: M**

- [x] **T5: Baseline layout spec**
  - **Description:** `e2e/layout/overflow.spec.ts`: on each journey screen assert no horizontal overflow (`document.documentElement.scrollWidth <= innerWidth`) and primary CTA visible in viewport. Encodes today's behavior as the floor.
  - Acceptance: passes in all four projects (document any *pre-existing* failures as known-issues comments rather than hiding them).
  - Verify: `npx playwright test e2e/layout/` green ×3.
  - Files: `e2e/layout/overflow.spec.ts`
  - Dependencies: T4 · **Size: S**

### Checkpoint — Gate 0
- [x] Full e2e suite green 3× consecutively; `npm run build` clean; **human review before Phase 1**

---

## Phase 1 — Layout foundation

- [x] **T6: `LayoutService` with `formFactor` signal**
  - **Description:** `src/app/services/layout.service.ts`: signals `formFactor()` (`phone | tablet-portrait | tablet-landscape | kiosk`), `isLandscape()`, `isTouch()` from `BreakpointObserver` + orientation media query. `kiosk` wired but constant-false until Phase 6. Unit spec covering the breakpoint→formFactor matrix.
  - Acceptance: spec covers all four factors + orientation flips.
  - Verify: `ng test --include='**/layout.service.spec.ts'` green.
  - Files: `src/app/services/layout.service.ts`, `src/app/services/layout.service.spec.ts`
  - Dependencies: Gate 0 · **Size: S**

- [x] **T7: Remove global max-width cap**
  - **Description:** Delete `max-width: 1440px` from `html, body` (`src/styles.scss:29`); re-scope an equivalent cap to the admin shell only (`admin-layout`). Add a layout spec asserting the storefront fills 1920×1080.
  - Acceptance: storefront content spans full width at `kiosk-landscape`; admin unchanged at 1440.
  - Verify: e2e layout specs green; visual check of admin.
  - Files: `src/styles.scss`, `src/app/components/admin-layout/admin-layout.component.scss`, `e2e/layout/overflow.spec.ts`
  - Dependencies: T6 · **Size: S**

- [x] **T8: Migrate layout shell + grids to `LayoutService`**
  - **Description:** Replace direct `BreakpointObserver` in `main-layout`, `product-grid`, `category-grid` with `LayoutService`. Convert touched components to `inject()` + OnPush + `@if/@for` per SPEC code style. Behavior identical (this task is mechanical, not visual).
  - Acceptance: no behavior change — baseline suite green; components OnPush.
  - Verify: full e2e suite; `npm run build`.
  - Files: `main-layout.component.{ts,html,scss}`, `product-grid.component.{ts,html}`, `category-grid.component.ts`
  - Dependencies: T6, T7 · **Size: M**

- [x] **T9: Migrate multi-step consumers to `LayoutService`**
  - **Description:** Same mechanical migration for `add-product-multi-step` and `product-option-card` (their `isMobile` subscriptions). No template redesign here — that's Phase 4b.
  - Acceptance: no behavior change; baseline green.
  - Verify: full e2e suite.
  - Files: `add-product-multi-step.component.ts`, `product-option-card.component.ts`
  - Dependencies: T8 · **Size: S**

### Checkpoint — Gate 1
- [x] Baseline green; storefront fills 1920×1080; `grep -rn "BreakpointObserver" src/app/components` hits only admin components

---

## Phase 2 — Restyle (Material 3, token-only)

- [x] **T10: Token purge — grids & layout**
  - **Description:** Replace hardcoded hex with `--mat-sys-*` tokens in `product-grid`, `main-layout`-adjacent storefront SCSS. Tonal elevation (surface-container tiers) replaces box-shadow where present.
  - Acceptance: zero hex in the touched files; dark mode visually coherent.
  - Verify: grep the files; manual light/dark check; baseline green.
  - Files: `product-grid.component.scss` + storefront shell SCSS
  - Dependencies: Gate 1 · **Size: S**

- [x] **T11: Token purge — product detail & sheets**
  - **Description:** Same purge for `product-add`, `regular-product-view`, `add-product-multi-step`, `product-option-card`, `cart-details-sheet` (inline styles in TS), `product-details-sheet`.
  - Acceptance: `grep -rn '#[0-9a-fA-F]\{3,6\}' <storefront scss>` → zero.
  - Verify: grep gate; manual light/dark check; baseline green.
  - Files: the 6 listed component style files
  - Dependencies: T10 · **Size: M**

- [x] **T12: Type scale + storefront chrome**
  - **Description:** Define the revised type scale (M3 typography levels, stepping up at kiosk factor) in `theme.scss`/`styles.scss`; apply to toolbar, category/product titles. Collapse secondary toolbar actions on phone per Design Direction.
  - Acceptance: one visible title per screen region; toolbar fits 390px without wrapping.
  - Verify: baseline + layout specs; manual review.
  - Files: `theme.scss`, `styles.scss`, `main-layout.component.{html,scss}`
  - Dependencies: T11 · **Size: M**

- [x] **T13: Imagery-forward product cards + category tiles**
  - **Description:** Restyle `product-grid` cards (photo leads, name+price beneath, M3 corners) and `category-grid` tiles. Keep add-to-cart affordance for no-customization products in mind (FR6, lands Phase 3+).
  - Acceptance: cards match Design Direction; stock/unavailable states legible; both themes pass contrast.
  - Verify: baseline green; manual review both themes.
  - Files: `product-grid.component.{html,scss}`, `category-grid.component.{html,scss}`
  - Dependencies: T12 · **Size: M**

- [x] **T14: axe AA scan**
  - **Description:** Add `@axe-core/playwright` (dev dep — confirm at install). `e2e/layout/a11y.spec.ts` scans each journey screen, light + dark, asserting zero WCAG 2.1 AA violations. Fix violations found (contrast, alt, focus).
  - Acceptance: zero AA violations both themes on all journey screens.
  - Verify: `npx playwright test e2e/layout/a11y.spec.ts` green.
  - Files: `package.json`, `e2e/layout/a11y.spec.ts`, spot fixes in storefront components
  - Dependencies: T13 · **Size: M**

### Checkpoint — Gate 2
- [ ] Grep gate zero hex; axe green both themes; **manual design review (screenshots phone + landscape × light + dark); human approval before Phase 3**

---

## Phase 3 — Responsive layouts (FR2)

- [x] **T15: Responsive storefront shell**
  - **Description:** `main-layout` per FR2: persistent left category rail on tablet-landscape/kiosk (replaces sidenav-over), horizontal scroller stays on portrait/phone; content area grid prepared for the Phase-5 cart panel (grid-template with an empty named area — no cart work now).
  - Acceptance: rail visible without scroll at 1194×834 and 1920×1080; phone/portrait unchanged.
  - Verify: layout specs + baseline in all projects.
  - Files: `main-layout.component.{ts,html,scss}`, `category-menu.component.{ts,html,scss}`
  - Dependencies: Gate 2 · **Size: M**

- [x] **T16: Grid columns per form factor**
  - **Description:** Drive `--columns` from `formFactor` per the FR2 table (category 2/3/4/4, product 1–2/2–3/3–4/3), replacing `auto-fill minmax` and hardcoded queries.
  - Acceptance: column counts match FR2 at each viewport.
  - Verify: `e2e/layout/columns.spec.ts` (new) green in all four projects.
  - Files: `product-grid.component.{ts,scss}`, `category-grid.component.{ts,scss}`, `e2e/layout/columns.spec.ts`
  - Dependencies: T15 · **Size: S**

- [x] **T17: Landscape no-scroll guarantee**
  - **Description:** Ensure page shell never scrolls vertically on landscape to reach the primary action (FR2): sticky add-to-cart bar, internal scroll areas for grids. Fix violations the spec finds.
  - Acceptance: on `tablet-landscape` + `kiosk-landscape`, primary CTA in viewport on every journey screen without shell scroll.
  - Verify: extend `overflow.spec.ts` with vertical-shell assertion; suite green.
  - Files: `e2e/layout/overflow.spec.ts`, spot fixes (≤3 components)
  - Dependencies: T16 · **Size: S**

### Checkpoint — Gate 3
- [x] Layout specs green all four projects; FR2 satisfied (product-detail modal deferred to Phase 5 per plan decision 7)

---

## Phase 4 — View transitions (FR3)

- [x] **T18: `appViewTransitionName` directive**
  - **Description:** `src/app/shared/directives/view-transition-name.directive.ts`; replace the inline `style="view-transition-name"` usages in `product-grid.component.html` (lines 9, 40, 106). No-op when API unsupported.
  - Acceptance: existing two transitions behave as before via the directive.
  - Verify: manual nav check; baseline green.
  - Files: directive + spec, `product-grid.component.html`
  - Dependencies: Gate 3 · **Size: S**

- [x] **T19: Named transitions for the four key moves + reduced-motion**
  - **Description:** Category→grid, card→detail (image morph), add-to-cart→badge, cart open/close. M3 motion durations/easing. Global `@media (prefers-reduced-motion: reduce)` kill-switch. Skip transition on same-grid navigation.
  - Acceptance: four moves animate; none animate under reduced motion; nav works in a no-VT browser profile.
  - Verify: manual + T20 specs.
  - Files: `styles.scss`, `app.config.ts` (transition skip predicate), templates of the four surfaces (≤5 files)
  - Dependencies: T18 · **Size: M**

- [x] **T20: Transition + reduced-motion specs**
  - **Description:** `e2e/journeys/transitions.spec.ts`: assert `view-transition-name` presence on key elements and journey completion with `reducedMotion: 'reduce'` context (no transition pseudo-elements).
  - Acceptance: green in all projects.
  - Verify: `npx playwright test e2e/journeys/transitions.spec.ts` ×3.
  - Files: `e2e/journeys/transitions.spec.ts`
  - Dependencies: T19 · **Size: S**

### Checkpoint — Gate 4
- [x] Transition + reduced-motion specs green; baseline green

---

## Phase 4b — Multi-step redesign (FR4d)

- [x] **T21: Shared `step-section` component**
  - **Description:** Extract the per-step engine from the tab content into `add-product-multi-step/step-section/`: option cards, selection state, single/multi-select validation, constraint countdown ("Encore 1"), price delta display. Consumes existing NgRx multi-step store; no store changes yet.
  - Acceptance: renders any current step type identically to the tab content, behind a temporary flag/branch.
  - Verify: unit spec for constraint countdown; baseline multi-step flow green.
  - Files: `step-section.component.{ts,html,scss}` + spec
  - Dependencies: Gate 4 · **Size: M**

- [x] **T22: Scrolling-page shell replaces tabs**
  - **Description:** Rebuild `add-product-multi-step` template: vertical `step-section`s; completed sections collapse to "✓ Nom — choix (modifier)"; auto-scroll to next incomplete on satisfy; single-select auto-advances; `mat-tab-group` deleted; "Obligatoire/Optionnel" labels replace `*`; step name and price each rendered once.
  - Acceptance: FR4d scroll-shell rules all hold on phone/tablet-portrait viewports.
  - Verify: multi-step journey e2e (T24 spec drafted alongside); manual check.
  - Files: `add-product-multi-step.component.{ts,html,scss}`
  - Dependencies: T21 · **Size: M**

- [x] **T23: Delete `summary` step type; disabled-CTA navigation**
  - **Description:** Remove `'summary'` from `multi-step-product.model.ts:6`, reducer (`:102,161,197`), effects (`:314,321` — text-input steps get their own `text-input` step type + reducer path). Recap UI is gone (collapsed headers replace it). Disabled add-to-cart tap scrolls to first incomplete section.
  - Acceptance: `grep -rn "'summary'" src/app` → zero; text-input steps still work; comment + add-to-cart bar unchanged.
  - Verify: reducer/effects unit specs via `--include`; full e2e suite.
  - Files: `multi-step-product.model.ts`, `multi-step-product.reducer.ts`, `multi-step-product.effects.ts`, reducer spec
  - Dependencies: T22 · **Size: M**

- [x] **T24: Multi-step journey specs**
  - **Description:** `e2e/journeys/multi-step.spec.ts` against the seeded menu product: required single-select auto-advance; multi-select min/max countdown enforcement; collapse-to-choice; "modifier" reopens with selection preserved; disabled CTA navigates to first incomplete; order completes; cart shows steps via `cart-item-steps-tree`.
  - Acceptance: green in all four viewport projects.
  - Verify: ×3 consecutive runs.
  - Files: `e2e/journeys/multi-step.spec.ts`, seed tweaks if needed
  - Dependencies: T23 · **Size: M**

### Checkpoint — Gate 4b (redesign complete)
- [x] Full e2e suite green ×3; `npm run build` clean; `npm run android:sync` succeeds; SPEC success criteria 1–3, 6, 9–11, 13–14 verified; **human review** ← YOU ARE HERE

---

## Kiosk push (T25–T34) — status

- [x] **T25: cart-content extraction** (commit 8f80a65)
- [x] **T26: CheckoutService** (commit f68fb26)
- [x] **T27: Persistent cart panel on landscape**
- [x] **T28: Delete CartDetailsPageComponent**
- [x] **T29: kiosk_enabled migration + types + seed + admin toggle**
- [x] **T30: KioskModeService + kiosk chrome**
- [x] **T31: Attract screen + idle reset**
- [x] **T32: Kiosk pay-at-counter + order-number confirmation**
- [x] **T33: Kiosk multi-step shell**
- [ ] **T34: Capacitor kiosk affordances**
