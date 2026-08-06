# Spec: Storefront UX/UI Overhaul — Responsive, Transitional, Kiosk-Ready

**Status:** Decisions resolved — awaiting approval to plan
**Date:** 2026-08-05
**Scope:** Customer-facing storefront only. Admin dashboard (`/admin/**`) is out of scope.
**Current focus:** UI redesign (Phases 0–4). Kiosk is specced but sequenced later; upsells are cut.

---

## Objective

Rebuild the Picki storefront's user experience so that a customer can order food quickly and confidently on any device — phone, tablet in either orientation, or a fixed self-ordering kiosk — with motion that makes the flow feel continuous rather than page-by-page.

### Who is the user

| User | Context | Primary need |
|---|---|---|
| **Walk-up customer** | Phone, standing, one hand, often in a queue | Reach checkout in as few taps as possible |
| **Seated / delivery customer** | Phone or tablet, unhurried | Browse the menu, explore customizations |
| **Kiosk customer** | Vendor-owned tablet mounted in-store, standing, no keyboard, people waiting behind | Zero-learning-curve flow modelled on McDonald's / Burger King kiosks |
| **Vendor** | Owns the device and the brand | Storefront must look like *their* restaurant, not a generic template |

### Why now

The storefront has grown feature-first, and the UI has not kept up:

- `src/styles.scss:29` caps the whole app at `max-width: 1440px`, so large screens letterbox instead of using the space.
- Exactly **one** `@media (orientation: ...)` query exists in the codebase (`main-layout.component.scss:205`). Tablet landscape — the dominant kiosk orientation — is effectively unhandled.
- Only 13 of ~38 components have any media query at all.
- `withViewTransitions()` is enabled (`app.config.ts:50`) but only two ad-hoc named transitions exist (`product-grid`, `product-add`), applied via inline `style=` attributes in `product-grid.component.html`, with no `prefers-reduced-motion` guard. Every other navigation is an abrupt swap.
- There is no kiosk concept whatsoever: no attract screen, no idle timeout, no session reset, no fullscreen or orientation handling.

### What success looks like

A customer walking up to a kiosk can complete an order without instruction. The same code, on a phone, feels native and fast. Motion communicates hierarchy — a product card grows into a product page, it doesn't cut to one.

---

## Tech Stack

Existing, unchanged unless noted:

| Layer | Technology | Version |
|---|---|---|
| Framework | Angular (standalone components) | 20.3.7 |
| UI | Angular Material (M3) + CDK | 20.2.10 |
| Utility CSS | TailwindCSS | 4.1.6 |
| State | NgRx Store / Effects / Entity | 20.1.0 |
| Backend | Supabase | 2.57.4 |
| Native shell | Capacitor (Android) | 8.5.0 |
| Reactivity | RxJS | 7.8 |

### New dependencies (require approval before install)

| Package | Purpose | Tier |
|---|---|---|
| `@playwright/test` | Cross-viewport e2e (dev dependency) | Ask first |
| `@capacitor/screen-orientation` | Kiosk orientation lock on Android | Ask first |
| `@capacitor/keep-awake` | Prevent kiosk screen sleep | Ask first |
| `@capacitor/status-bar` | Immersive/fullscreen kiosk chrome | Ask first |

No new UI/animation library. View transitions and Material motion tokens cover the motion needs.

---

## Commands

```bash
# Development
npm start                    # ng serve --port 4300
npm run watch                # ng build --watch --configuration development

# Build
npm run build                # ng build (production)

# Test
npm test                     # ng test (Karma) — CURRENTLY BROKEN, see Testing Strategy
npx playwright test                              # all viewport projects (to be added)
npx playwright test --project=phone-portrait     # single viewport
npx playwright test --project=kiosk-landscape
npx playwright test --ui                         # interactive debugging
npx playwright show-report

# Android
npm run android:sync         # ng build && npx cap sync android
npm run android:open         # npx cap open android
npm run android:run          # npx cap run android
```

---

## Project Structure

Existing layout, with additions marked **NEW**:

```
src/
├── styles.scss                          → Global styles, view-transition keyframes
├── theme.scss                           → Material 3 theme (rose palette, light/dark)
└── app/
    ├── components/
    │   ├── vendor-layout/               → Outer vendor shell
    │   ├── main-layout/                 → Storefront shell: toolbar + sidenav + outlet
    │   ├── welcome-screen/              → Dining preference selection
    │   ├── promotional-banner/          → Banner + nested category/product outlet
    │   ├── category-grid/               → Category tiles
    │   ├── product-grid/                → Product cards
    │   ├── product-add/                 → Product detail + customization
    │   ├── add-product-multi-step/      → REWORKED per FR4d — tabs + summary step removed
    │   │   └── step-section/            → NEW — shared step engine (options, validation)
    │   ├── product-details-sheet/       → Product bottom sheet
    │   ├── cart-details-sheet/          → Bottom-sheet wrapper (thin, after FR7)
    │   ├── cart-panel/                  → NEW — persistent panel (landscape/kiosk)
    │   ├── cart-badge/                  → Floating cart entry point
    │   ├── horizontal-category-menu/    → Horizontal category scroller
    │   ├── category-menu/               → Sidenav category list
    │   └── kiosk/                       → NEW — kiosk-only surfaces (Phases 6–8)
    │       ├── attract-screen/          → NEW — banner loop, "Touchez pour commander"
    │       ├── idle-warning-dialog/     → NEW — "Toujours là ?" countdown
    │       └── order-confirmation/      → NEW — full-screen order number + pay at counter
    ├── services/
    │   ├── layout.service.ts            → NEW — form factor + orientation signals
    │   └── kiosk-mode.service.ts        → NEW — kiosk activation, idle, session reset
    ├── shared/
    │   ├── components/
    │   │   ├── cart-content/            → NEW — shared cart body, extracted per FR7
    │   │   ├── add-to-cart-bar/         → Existing sticky add-to-cart bar
    │   │   └── dining-preference-selector/
    │   └── directives/
    │       └── view-transition-name.directive.ts   → NEW — replaces inline style=
    └── store/                           → NgRx (cart, auth, multi-step-product, banners)

e2e/                                     → NEW — Playwright specs
├── fixtures/                            → NEW — vendor seeding, test helpers
├── journeys/                            → NEW — full order-flow specs
└── layout/                              → NEW — per-viewport layout specs

playwright.config.ts                     → NEW — viewport projects
```

---

## Code Style

Two-space indent, single quotes, kebab-case filenames, `const` by default, no `any`.

**New and touched storefront code uses modern Angular 20 idioms.** Much of the existing storefront predates these (`*ngIf`, constructor DI, `Observable` + `async` pipe). Do not mass-migrate untouched files — but any component this work modifies gets converted.

```typescript
import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs';

import { LayoutService } from '../../services/layout.service';

@Component({
  selector: 'app-category-grid',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './category-grid.component.html',
  styleUrl: './category-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryGridComponent {
  private readonly layout = inject(LayoutService);

  protected readonly columns = computed(() => {
    switch (this.layout.formFactor()) {
      case 'phone':           return 2;
      case 'tablet-portrait': return 3;
      case 'tablet-landscape':
      case 'kiosk':           return 4;
    }
  });
}
```

```html
@if (categories(); as list) {
  <div class="category-grid" [style.--columns]="columns()">
    @for (category of list; track category.id) {
      <button
        class="category-tile"
        [appViewTransitionName]="'category-' + category.id"
        (click)="select(category)">
        <img [src]="category.image_url" [alt]="category.name" loading="lazy" />
        <span class="category-tile__label">{{ category.name }}</span>
      </button>
    } @empty {
      <app-empty-state message="Aucune catégorie disponible" />
    }
  </div>
}
```

### Conventions

- **Control flow:** `@if` / `@for` / `@switch`, never `*ngIf` / `*ngFor` in new or touched templates.
- **DI:** `inject()`, never constructor injection.
- **Change detection:** `ChangeDetectionStrategy.OnPush` on every new component.
- **State:** signals for view state; NgRx stays the source of truth for cart and auth. Bridge with `toSignal()`.
- **Colors:** Material 3 design tokens only (`var(--mat-sys-primary)`, `var(--mat-sys-surface-container)`). **Never hardcode hex values** — it breaks dark mode and per-vendor theming.
- **Spacing/radius:** M3 tokens (`--mat-sys-corner-large`) or Tailwind scale. No arbitrary pixel values.
- **View transition names:** via the `appViewTransitionName` directive, never inline `style="view-transition-name: ..."`.
- **Copy:** French, matching existing UI strings.
- **Touch targets:** ≥48px phone/tablet, ≥64px kiosk. Enforced by a shared SCSS mixin, not per-component magic numbers.

---

## Design Direction

Restyle **within** Material 3 — keep the theming API, the `mat.theme()` mixin, and light/dark support. Visual changes:

1. **Imagery-forward product cards.** Photo leads, price and name overlay or sit tight beneath. Current cards under-use product photography.
2. **Revised type scale.** Larger, tighter display sizes for category and product names; the scale steps up at the `kiosk` form factor so text is legible at ~1m viewing distance.
3. **New elevation and corner language.** Prefer M3 tonal elevation (surface-container tiers) over shadow elevation; larger, more consistent corner radii.
4. **Denser, calmer chrome.** The toolbar currently carries brand, dining preference, info, and theme toggle. On kiosk the theme toggle disappears entirely; on phone, secondary actions collapse.
5. **Per-vendor accent is a stretch goal, not in this scope.** The theme stays the rose palette; the token discipline above is what makes vendor theming possible later without a second refactor.

---

## Functional Requirements

### FR1 — Form factor system

A `LayoutService` exposes signals derived from `BreakpointObserver` plus orientation:

```typescript
type FormFactor = 'phone' | 'tablet-portrait' | 'tablet-landscape' | 'kiosk';
```

- `formFactor(): Signal<FormFactor>` — the single source of layout truth.
- `isKiosk(): Signal<boolean>`, `isLandscape(): Signal<boolean>`, `isTouch(): Signal<boolean>`.
- Six components already call `BreakpointObserver` directly (`main-layout`, `product-grid`, `category-grid`, `add-product-multi-step`, `product-option-card`, plus admin). Storefront ones migrate to `LayoutService`; the admin ones are left alone.
- `max-width: 1440px` moves off `html, body` in `src/styles.scss:29` and onto the admin shell only, so the storefront can fill wide and kiosk screens.

### FR2 — Layout per form factor

| Surface | Phone | Tablet portrait | Tablet landscape | Kiosk |
|---|---|---|---|---|
| Category grid | 2 columns | 3 columns | 4 columns | 4 columns, XL tiles |
| Product grid | 1–2 columns | 2–3 columns | 3–4 columns | 3 columns, XL cards |
| Category navigation | Horizontal scroller | Horizontal scroller | Persistent left rail | Persistent left rail |
| Cart | Bottom sheet | Bottom sheet | Persistent right panel | Persistent right panel |
| Product detail | Full-screen route | Full-screen route | Modal over grid | Modal over grid |
| Toolbar | Compact | Standard | Standard | Brand + language + cancel only |

Landscape must never require vertical scrolling to reach the primary action.

### FR3 — View transitions

- Replace inline `style="view-transition-name"` with the `appViewTransitionName` directive.
- Named transitions for the journey's key moves:
  - category tile → product grid (tile expands into the grid header)
  - product card → product detail (card image morphs into the hero image)
  - add-to-cart → cart badge (item animates toward the cart)
  - cart sheet/panel open and close
- Durations from M3 motion tokens: 200ms short, 300ms medium, 400ms long. Easing `--mat-sys-motion-easing-emphasized`.
- **`prefers-reduced-motion: reduce` disables all non-essential transitions.** This is currently missing and is an accessibility defect.
- Transitions must degrade cleanly where the View Transitions API is unavailable (older Safari) — navigation still works, it just doesn't animate.
- Skip the transition when navigating between items within the same grid (avoids a flash on category switching).

### FR4 — Kiosk mode

Kiosk is a **mode of the same component tree**, not a separate route tree.

- **Activation:** a new `vendors.kiosk_enabled boolean not null default false` column. Requires a migration and a regenerated `supabase.types.ts`. The column must be readable by the anonymous storefront role under the existing RLS policies — verify against the Phase 2 RLS lockdown before writing the policy.
- **Attract screen:** full-screen idle state driven by the existing `banners` table — a rotating loop of the vendor's promotional banners, falling back to logo-only when the vendor has none. Overlaid with "Touchez pour commander". Tapping anywhere starts a session.
- **Idle handling:** after 60s of inactivity with a non-empty cart, show a countdown dialog ("Toujours là ?", 20s); on expiry, clear the cart, reset dining preference, and return to the attract screen. Never abandon a session silently mid-payment.
- **Chrome removal:** no theme toggle, no browser-dependent affordances, no external links.
- **Sizing:** ≥64px touch targets, stepped-up type scale, generous spacing.
- **Cancel order:** an always-available cancel that confirms, then resets the session.

### FR4a — Kiosk checkout: pay at counter

Kiosk orders are **always pay-at-counter**, even when the vendor has online payments enabled.

This reuses existing machinery rather than adding any. `vendors.online_payments_enabled` already drives a pay-at-counter branch (`cart-details-sheet.component.ts:899`, `cart-details-page.component.ts:640`). Kiosk mode forces that branch on.

- **Do not modify the Stripe or PayGreen call paths.** Kiosk simply never enters them.
- The vendor's `online_payments_enabled` setting continues to govern the non-kiosk storefront unchanged.
- On confirmation, show a **full-screen order-number screen**: the existing `order_number` at display size, plus "Payez au comptoir". This is a new screen over an existing field — `orders.order_number`, `generateOrderNumber()`, the thermal ticket (`ticket-layout.ts:45`), and the public queue board (`/vendor/:slug/orders-queue`) all already exist and are unchanged.
- After a configurable delay, the confirmation screen returns to the attract screen automatically.

### FR4b — Combo builder (kiosk shell of the multi-step redesign)

The data model already supports combos: `product_steps` carries `step_type`, `is_required`, `min_selections`, `max_selections`, with `step_options` beneath it, and `MenuStepOption` exists in `product-admin.interface.ts`. **No schema change is needed.**

The interaction design lives in **FR4d** — the kiosk combo builder is its one-step-per-screen shell over the same shared step-section component, sized for kiosk:

- XL image option cards and ≥64px touch targets.
- "Étape 2 sur 4" progress with a recap strip of previous choices beneath it.
- Optional steps get an explicit "Passer"; back navigation preserves selections.

By the time this phase starts, the step-section component, validation, and constraint surfacing already exist from the FR4d work — this phase only adds the kiosk-sized shell.

### FR4c — Upsell prompts — DEFERRED, OUT OF SCOPE

Explicitly cut from this spec at the user's direction; to be specced separately later.

This is the only item from the kiosk reference list that would have been a genuinely new feature rather than a UI layer over existing machinery. Nothing in this spec depends on it — the cart extraction (FR7) leaves a natural insertion point, and `accessories-strip` already demonstrates the pattern on the product page. **Do not build upsell prompts as part of this work.**

### FR4d — Multi-step product experience redesign

Replaces the current `mat-tab-group` wizard in `add-product-multi-step` (714-line TS, tabs + a synthetic `summary` step type). **Part of the current UI redesign scope**, not the later kiosk push — only the kiosk shell waits.

**Diagnosis of the current UI:**

- Tabs afford "visit in any order" but the flow is a sequential wizard with required steps — the component polices tab clicks it shouldn't be offering.
- No progress indication ("Étape 2 sur 4"); required steps marked with a bare `*`.
- Step name duplicated (tab label + content title); total price shown in three places.
- The summary is a fake step (`stepType === 'summary'`) that occupies a tab slot and branches the state machine — and duplicates what `cart-item-steps-tree` already shows in the cart.
- Previous choices are invisible from the current step.
- The recap has flat hierarchy: numbered circles, chips, check icons, and price deltas all at equal weight.

**Target design — hybrid by form factor, one shared engine:**

| Form factor | Shell |
|---|---|
| Phone / tablet portrait | **One scrolling page.** Steps are vertical sections; a completed section collapses to its header + chosen option ("✓ Boisson — Coca-Cola"), with a "modifier" affordance. The page itself is the summary. Auto-scroll to the next incomplete section after a selection is satisfied. |
| Kiosk / tablet landscape | **One step per screen** with "Étape 2 sur 4" progress and XL image cards — the FR4b shell. A thin recap strip of previous choices sits under the progress bar. |

Both shells render the same **step-section component** (options, selection state, validation, price deltas). The `formFactor` signal from `LayoutService` picks the shell; no logic forks.

**Rules, both shells:**

- **No summary step.** Delete the `summary` step type. The recap lives in the collapsed section headers (scroll shell), the recap strip (step shell), and the cart via the existing `cart-item-steps-tree`.
- **Required is a state, not an asterisk.** Sections read `Obligatoire` / `Optionnel`; completed sections show a check. The add-to-cart bar stays disabled until required steps are satisfied, and tapping it while incomplete navigates to the first missing choice instead of doing nothing.
- **Single-select advances automatically** — picking the option moves you forward; no confirm tap.
- **Constraints surfaced upfront** ("Choisissez 2 accompagnements"), counting down as you pick ("Encore 1"), never as a post-hoc error.
- **Price shown only where it changes:** delta on the option card when non-zero, running total in the add-to-cart bar. Nowhere else.
- **One title per step.** Step name appears exactly once.
- Comment field and quantity/add-to-cart bar behavior carry over unchanged.

### FR5 — Android (Capacitor)

Browser-first, but the Android app must keep working and gain kiosk affordances:

- Lock orientation to landscape when kiosk mode is active; unlock otherwise.
- Immersive/fullscreen mode (hide status and navigation bars) in kiosk mode.
- Keep-awake while a kiosk session is active.
- Android hardware back button: navigate back within the storefront; in kiosk mode, never exit the app.
- All native calls guarded by a platform check so the web build is unaffected.

### FR6 — Purchase flow friction

- **Persistent order summary** on tablet landscape and kiosk — the cart is always visible, never hidden behind a badge.
- **Add-to-cart without leaving the grid** where the product has no customization steps.
- **Quantity adjustment inline** in the cart, no re-entry into the product page.
- **Explicit progress** through the checkout steps so the customer always knows what remains.
- **No dead ends:** every error state offers a next action.

### FR7 — Cart content extraction

`cart-details-sheet.component.ts` is 1264 lines and couples cart presentation to bottom-sheet mechanics. Tablet-landscape and kiosk need the same cart as a **persistent right panel**.

- Extract the cart body — line items, quantity controls, totals, coupon input, checkout CTA — into a shared presentational component.
- `cart-details-sheet` becomes a thin bottom-sheet wrapper around it (phone / tablet portrait).
- A new persistent panel wraps the same component (tablet landscape / kiosk).
- **Do not revive** the commented-out `CartDetailsPageComponent` (`app.routes.ts:73`) — it is a near-duplicate of the sheet and would be a third copy to maintain. Delete it once extraction is complete.
- Checkout and payment logic stays put. This is a presentation extraction, not a rewrite of the order-submission path.

### FR8 — Accessibility (WCAG 2.1 AA)

AA is a **requirement**, not best-effort.

- Contrast ≥4.5:1 for body text, ≥3:1 for large text and UI components — in **both** light and dark themes. The restyle's color choices are constrained by this.
- Every interactive element is keyboard reachable with a visible focus indicator.
- Every image has a meaningful `alt`; decorative images get `alt=""`.
- Bottom sheets and dialogs trap focus and restore it on close.
- Form errors are associated with their inputs and announced.
- Live regions announce cart changes.
- `prefers-reduced-motion` is honored (see FR3).
- Orientation is not locked in the browser build — content works in both (FR5's lock applies only to the Android kiosk).

### FR9 — Language

The storefront stays **French-only**. No language selector on the attract screen, no i18n infrastructure in this scope. Copy stays consistent with existing UI strings.

---

## Testing Strategy

### Current state

`npm test` (Karma + Jasmine) **does not compile** — pre-existing type errors in `src/app/services/product.service.spec.ts` block the whole suite. This is a known, pre-existing issue unrelated to this work.

### Approach

**1. Playwright e2e — primary safety net.** `e2e/`, config at `playwright.config.ts`, with one project per form factor:

| Project | Viewport | Represents |
|---|---|---|
| `phone-portrait` | 390×844 | iPhone 14 |
| `tablet-portrait` | 834×1194 | iPad Air portrait |
| `tablet-landscape` | 1194×834 | iPad Air landscape |
| `kiosk-landscape` | 1920×1080 | Mounted kiosk |

Coverage:
- **Journey specs** (`e2e/journeys/`) — full order flow per project: dining preference → category → product → customization → cart → checkout. Payment is stubbed at the network layer; **no test touches a live Stripe or PayGreen endpoint.**
- **Layout specs** (`e2e/layout/`) — assert column counts, cart presentation, and that no horizontal overflow or hidden primary action exists at any viewport.
- **Kiosk specs** — attract screen appears, idle countdown fires, session resets, cart clears.
- **Reduced-motion spec** — with `prefers-reduced-motion: reduce`, transitions are suppressed and navigation still completes.
- **Accessibility spec** — `@axe-core/playwright` scan of each journey screen in **both** light and dark themes, asserting zero WCAG 2.1 AA violations (FR8), plus a keyboard-only journey traversal. Adds one more dev dependency to the Ask-first list.
- **Kiosk payment spec** — assert zero network calls to Stripe/PayGreen origins during a kiosk order, even with `online_payments_enabled = true`.

**2. Unit tests (Karma) — logic only.** New specs for `LayoutService` (form factor derivation from breakpoint + orientation) and `KioskModeService` (idle timer, session reset). Do not fix the broken `product.service.spec.ts` as part of this work — it is unrelated scope. If it still blocks the suite, run new specs with `ng test --include`.

**3. Manual device verification** before each phase is called done: a real phone, a real tablet in both orientations, and the Android build.

### Coverage expectations

- Every FR above has at least one automated test.
- The complete order journey passes in all four Playwright projects.
- No coverage percentage target — coverage of the *journey* matters more than of the lines.

---

## Boundaries

### Always do

- Use Material 3 design tokens for color, elevation, and shape. Never hardcode a hex value.
- Add `ChangeDetectionStrategy.OnPush` to every new component.
- Guard every animation behind `prefers-reduced-motion`.
- Keep touch targets ≥48px (≥64px kiosk).
- Verify a change on phone **and** tablet landscape before considering it done.
- Guard Capacitor native calls with a platform check.
- Keep French copy consistent with existing UI strings.
- Run `npm run build` before committing.

### Ask first

- Installing any dependency (including the four listed above).
- Any schema change **beyond** the approved `vendors.kiosk_enabled` column.
- Changing edge functions.
- Changing checkout, payment, or order-submission **logic** — presentation changes to `cart-details-sheet` are fine, and forcing the existing pay-at-counter branch in kiosk mode is in scope, but the Stripe/PayGreen call paths are not.
- Changing routes in `app.routes.ts` — custom-domain routing and guards are subtle.
- Anything touching the admin dashboard, **except** the one settings toggle for `kiosk_enabled`.
- Introducing a recommendation engine or new suggestion table for upsells.

### Pre-approved in this spec

Normally Ask-first; explicitly approved by the answered open questions:

- **One migration** adding `vendors.kiosk_enabled boolean not null default false`, plus the RLS read policy needed for the anonymous storefront role, plus regenerating `src/app/types/supabase.types.ts`.
- **Deleting** `CartDetailsPageComponent` and its commented-out route (`app.routes.ts:73`) once FR7 extraction lands.
- **Four dependencies** listed in Tech Stack — still confirm at install time, but the decision is made.

### Never do

- Commit secrets, API keys, or Supabase service-role keys.
- Hardcode colors that bypass the theme (breaks dark mode, AA contrast, and future vendor theming).
- Remove or skip a failing test to make a build pass.
- Mass-refactor untouched components "while we're in there."
- Change order status flow, pricing logic, or **existing** RLS policies — the kiosk column gets a new policy, nothing existing is loosened.
- Route a kiosk order through Stripe or PayGreen.
- Run e2e tests against production Supabase, Stripe, or PayGreen.
- Break the Android build — `npm run android:sync` must still succeed.
- Regress an existing storefront capability (dark mode, custom domains, multi-step products, coupons, delivery address entry).
- Add a language selector or i18n scaffolding (FR9: French-only).

---

## Success Criteria

Specific and testable:

1. **Responsive** — the full order journey completes with zero horizontal overflow and no clipped primary action at 390×844, 834×1194, 1194×834, and 1920×1080. Verified by Playwright layout specs.
2. **Landscape** — on tablet landscape, category navigation, product grid, and cart are simultaneously visible without scrolling the page shell.
3. **Transitions** — the four key navigation moves in FR3 animate via named view transitions; all are suppressed under `prefers-reduced-motion: reduce`; navigation completes in a browser without View Transitions support.
4. **Kiosk** — with `vendors.kiosk_enabled = true`, a customer completes an order without instruction; the attract screen cycles the vendor's banners after 60s idle; the 20s countdown clears the session; the theme toggle is absent.
5. **Kiosk payment** — a kiosk order never reaches Stripe or PayGreen even when `online_payments_enabled = true`, and terminates on a full-screen `order_number` confirmation. Verified by an e2e spec asserting zero payment-provider network calls.
6. **Multi-step redesign** — the tab group and the synthetic `summary` step type are gone; on phone, a completed section collapses to its chosen option and the page needs no recap screen; single-select advances automatically; tapping a disabled add-to-cart navigates to the first missing choice; step name and price each appear exactly once per view.
7. **Combo builder** — a multi-step product completes on kiosk with one step per screen, visible step progress, a recap strip, enforced `min_selections`/`max_selections`, and preserved selections on back-navigation — rendered by the same step-section component as the phone shell.
8. **Cart extraction** — one shared cart component renders in both the bottom sheet and the persistent panel; `CartDetailsPageComponent` is deleted; no checkout logic changed.
9. **Fewer taps** — a no-customization product goes from category grid to cart in ≤3 taps (currently 4+).
10. **Accessibility** — automated axe scan reports zero WCAG 2.1 AA violations on the storefront journey in both light and dark themes; full journey completable by keyboard.
11. **Token discipline** — zero hardcoded hex colors in storefront component SCSS. Verified by grep in review.
12. **Android** — `npm run android:sync` succeeds; the app runs on a tablet with orientation lock, immersive mode, and keep-awake active in kiosk mode.
13. **No regressions** — dark mode, custom domains, multi-step products, coupons, and delivery address entry all still work; the non-kiosk storefront's payment behavior is byte-for-byte unchanged.
14. **Build** — `npm run build` completes with no new warnings.

---

## Implementation Phases

Detailed tasks go in `tasks/plan.md` and `tasks/todo.md` after this spec is approved. Proposed sequence:

**The UI redesign (Phases 0–4) is the current focus.** Kiosk-specific work (Phases 5–8) is specced here so the redesign is built with it in mind, but it is a later push. Upsells are cut entirely (FR4c).

### Now — UI redesign

| Phase | Content | Gate |
|---|---|---|
| **0** | Playwright setup + baseline journey specs against *current* UI | Baseline is green — we can now detect regressions |
| **1** | `LayoutService`, remove global `max-width` (`styles.scss:29`), migrate storefront breakpoint consumers | Layout specs pass; no visual regression |
| **2** | Restyle per Design Direction: type scale, imagery-forward product cards, tonal elevation, token discipline, AA contrast in both themes | Manual design review + axe scan clean |
| **3** | Responsive layouts per FR2, landscape-first | Layout specs pass in all four projects |
| **4** | View transitions per FR3 + `prefers-reduced-motion` + `appViewTransitionName` directive | Transition and reduced-motion specs pass |
| **4b** | FR4d multi-step redesign: shared step-section component + scrolling-page shell, tabs and summary step deleted | Multi-step journey specs pass; summary step type gone |

### Later — kiosk

| Phase | Content | Gate |
|---|---|---|
| **5** | FR7 cart extraction; persistent panel for landscape; delete `CartDetailsPageComponent` | Cart renders identically in sheet and panel; no checkout logic changed |
| **6** | FR4 kiosk mode: `kiosk_enabled` migration, attract screen from `banners`, idle reset, XL sizing | Kiosk specs pass; manual kiosk walkthrough |
| **7** | FR4a pay-at-counter + order-number confirmation screen; FR4b kiosk shell over the FR4d step-section component | Zero payment-provider calls in kiosk e2e |
| **8** | FR5 Capacitor affordances: orientation lock, immersive, keep-awake, back button | Verified on a real Android tablet |

Phases 2 and 3 are the riskiest — they touch the most templates. Phase 0 exists specifically to make that risk detectable. Each phase ships independently; nothing here requires a big-bang cutover.

FR6 (purchase-flow friction) is delivered incrementally across Phases 3, 5, and 7 rather than as its own phase — each item belongs to the layout or cart work it depends on.

---

## Resolved Decisions

| # | Question | Decision | Where it landed |
|---|---|---|---|
| 1 | Kiosk activation | `vendors.kiosk_enabled` column (migration approved) | FR4 |
| 2 | Attract screen content | Reuse the existing `banners` table; logo-only fallback | FR4 |
| 3 | Idle timings | 60s idle → 20s countdown → reset | FR4 |
| 4 | Cart on tablet landscape | Extract shared cart content out of `cart-details-sheet` | FR7 |
| 5 | Kiosk payment | Online normally; **kiosk always pay-at-counter** | FR4a |
| 6 | Accessibility | WCAG 2.1 AA is a requirement | FR8 |
| 7 | Language | French-only, no i18n scaffolding | FR9 |
| 8 | Kiosk references | Combo builder ✅, order-number ticket ✅, **upsells cut** | FR4b, FR4a, FR4c |
| 9 | Multi-step product UX (replace tabs + summary step) | Hybrid: scrolling page on phone/tablet-portrait, one step per screen on kiosk/landscape, one shared step-section component | FR4d |

Three of the #8 items turned out to be largely built already, which is why kiosk scope is smaller than it first looked:

- **Order numbers** — `orders.order_number`, `generateOrderNumber()`, thermal ticket printing (`ticket-layout.ts:45`), and the public queue board (`/vendor/:slug/orders-queue`) all exist. Only a confirmation *screen* is new.
- **Pay-at-counter** — `vendors.online_payments_enabled` already drives the branch at `cart-details-sheet.component.ts:899`. Kiosk forces it on; no new payment code.
- **Combo builder** — `product_steps` (`step_type`, `is_required`, `min_selections`, `max_selections`) + `step_options` + `MenuStepOption` already model combos. Only the UI is new.

---

## Open Questions

1. **Browser support floor.** There is no `.browserslistrc` and no `browserslist` key in `package.json`, so the build uses Angular 20's default target. That matters here because View Transitions need **Chrome 111+ / Safari 18+** — anything older silently falls back to un-animated navigation (which FR3 already requires). Proposal: target Angular's default and accept the fallback on older Safari. Confirm, or name a floor you need to support properly.

*(Not blocking — I can proceed on the proposal above and revisit if you have specific devices in mind.)*
