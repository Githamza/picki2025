# Implementation Plan: Storefront UI Redesign (SPEC.md Phases 0–4b)

**Source spec:** `SPEC.md` (Phases 0, 1, 2, 3, 4, 4b — the "Now" scope)
**Out of scope here:** kiosk phases 5–8, upsells (cut per FR4c)
**Task list:** `tasks/todo.md`

## Overview

Six phases, each independently shippable, each gated by the Playwright suite built in Phase 0. Order follows the dependency graph: e2e safety net → layout foundation (`LayoutService`, kill the global `max-width`) → restyle within M3 → responsive layouts per form factor → view transitions → multi-step product redesign (FR4d).

## Architecture Decisions

1. **E2E runs against local Supabase, not stubs.** The app's data flow (PostgREST + realtime + edge functions) is too wide to stub credibly. Playwright's `webServer` runs `ng serve --configuration e2e`; a new `environment.e2e.ts` (fileReplacement) points at `http://127.0.0.1:54321`. `supabase/config.toml` already references `./seed.sql` — the file doesn't exist yet; we create it with a deterministic test vendor. **No e2e traffic ever reaches production** (SPEC Never-do).
2. **The e2e test vendor has `online_payments_enabled = false`**, so the baseline journey completes an order through the existing pay-at-counter branch without touching Stripe/PayGreen. Payment-provider origins are additionally blocked at the Playwright network layer.
3. **Baseline specs are behavioral, not pixel.** They assert journey completion, element visibility, column counts, and no horizontal overflow. Pixel-diff screenshots would fail on the intentional Phase 2 restyle; behavioral specs survive it. Targeted screenshots may be added *after* Phase 2 as the new visual baseline.
4. **`LayoutService` wraps `BreakpointObserver` + orientation into one `formFactor` signal** (`phone | tablet-portrait | tablet-landscape | kiosk`). Storefront components consume only this; direct `BreakpointObserver` use remains in admin components (untouched). The `kiosk` value is wired but always false until Phase 6 (kiosk detection lands later; the enum existing now prevents rework).
5. **Grid columns via CSS custom property** (`--columns`) set from the `formFactor` signal, replacing `repeat(auto-fill, minmax(230px, 1fr))` (product-grid) and hardcoded breakpoint queries (category-grid). One mechanism for both grids.
6. **Restyle is token-only.** Seven storefront files contain hardcoded hex (`product-grid`, `product-add`, `regular-product-view`, `add-product-multi-step`, `product-option-card`, `cart-details-sheet`, `product-details-sheet`). All move to `--mat-sys-*` tokens. Grep gate: zero hex in storefront SCSS.
7. **Product-detail-as-modal on landscape (FR2) is deferred to Phase 5** (cart panel work). It likely needs an `app.routes.ts` change (Ask-first boundary) and pairs naturally with the persistent-panel layout. Phase 3 delivers the left rail + grid/column behavior; the detail view stays a full-screen route on all form factors for now. *Deviation from FR2 noted — approved scope for "Now" phases.*
8. **FR4d deletes the `summary` step type end-to-end.** It is synthesized in `multi-step-product.effects.ts:314` and `multi-step-product.reducer.ts:102` (text-input steps are also mapped to `summary` — that mapping must be untangled, they become their own step type). The recap becomes ambient: collapsed section headers on the scroll shell.
9. **Unit tests run via `ng test --include`** for new specs (`LayoutService`, reducer changes) because the suite-wide run is blocked by pre-existing errors in `product.service.spec.ts` (known issue, out of scope).

## Dependency Graph

```
T1–T5 (Playwright + env + seed + baseline)
    │
    T6 (LayoutService) ──────────────┐
    │                                │
    T7 (kill max-width)              │
    │                                │
    T8–T9 (migrate breakpoint consumers)
    │
    T10–T14 (restyle: tokens → chrome → cards → tiles → axe)
    │
    T15–T17 (responsive shell → grid columns → landscape specs)
    │
    T18–T20 (transition directive → named moves → specs)
    │
    T21–T24 (step-section → scroll shell → summary removal → specs)
```

Phases 2–4 depend on Phase 1 but not on each other's *internals* — however they touch the same templates, so they run sequentially to keep diffs reviewable.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Local Supabase stack drift (migrations vs. prod) | Med | `supabase db reset --yes --local` from repo migrations before every e2e run; seed is idempotent |
| Baseline specs flaky (realtime subscriptions, timing) | High | Phase 0 gate includes 3 consecutive green runs; no arbitrary sleeps, only Playwright auto-wait |
| Restyle regresses dark mode | Med | Token-only rule + axe scan in both themes (T14) |
| `summary` removal breaks text-input steps | High | Effects map text-input → `summary` today; T23 gives text-input its own step type with its own reducer path, covered by unit spec before the UI switch |
| Phase 3 landscape shell destabilizes phone layout | Med | Baseline journey spec runs on every phase gate in all four viewports |
| View-transition flake in Playwright (Chromium timing) | Low | Transition specs assert class/pseudo-element presence, not animation frames |
| Karma suite still broken | Low | New specs run with `--include`; suite repair is explicitly out of scope |

## Phase Gates (checkpoints)

- **Gate 0 (after T5):** baseline journey green 3× in all four viewport projects; `npm run build` clean. **Human review before Phase 1.**
- **Gate 1 (after T9):** baseline still green; storefront fills 1920×1080 (no letterbox); zero storefront `BreakpointObserver` imports outside `LayoutService`.
- **Gate 2 (after T14):** grep gate zero hex; axe zero AA violations both themes; **manual design review — screenshots of every storefront screen, phone + landscape, light + dark.**
- **Gate 3 (after T17):** layout specs green in all four projects; FR2 table satisfied (minus deferred detail-modal).
- **Gate 4 (after T20):** transition + reduced-motion specs green.
- **Gate 4b (after T24):** full suite green; `grep -rn "'summary'" src/app` returns nothing; `npm run android:sync` succeeds. **Human review — redesign complete.**

## Findings from Phase 0 (feed into later phases)

Discovered while building the baseline against the running app:

1. **`diningPreferenceGuard` always returns `true`** (`dining-preference.guard.ts`) — the welcome screen is never enforced; landing goes straight to the category grid and the preference is collected inside the checkout dialog (`needsPreferenceStep`). SPEC's journey description assumed the welcome screen was a gate; the baseline encodes the real flow. Worth an explicit decision in Phase 3: keep dialog-first, or make the welcome screen the real entry.
2. **Checkout dialog label says "Continuer vers le paiement" even for pay-at-counter vendors** — misleading copy for the counter branch. Fix in Phase 2 chrome/copy pass (FR6 no-dead-ends spirit).
3. **User-info dialog form fields render the floating label over the filled value, and labels show doubled asterisks ("Nom \*\*")** — visible in probe screenshots. Material form-field styling defect; fix in Phase 2.
4. **The e2e banner title initially collided with the welcome `h1`** (strict-mode flake) — locators now pin heading level. Keep seeded strings distinct from UI strings when extending the seed.
5. **PRODUCTION BUG (FIXED 2026-08-07) — order-number collisions.** `generateOrderNumber()` produced `YYMMDD-` + a 3-digit random against the `orders.order_number` unique constraint; same-day collisions silently killed checkouts. **Fix (user-approved):** suffix widened to 6 digits and both duplicated implementations replaced by the shared `src/app/shared/utils/order-number.util.ts` (5 unit tests). Residual daily-collision odds at 500 orders/day: ~0.01% per order. E2e still truncates orders per run (`e2e/global-setup.ts`) for determinism.
6. **Karma suite compiles again** — `product.service.spec.ts` type errors repaired (typed-mock casts). 52 tests: 47 pass, 5 pre-existing runtime failures in component `should create` specs that hit real Supabase/fetch (unmocked TestBed) — out of scope, listed for a later cleanup.

7. **RESOLVED (2026-08-08): the "load flake" root cause.** The e2e anon key was the CLI's `sb_publishable_*` form, which this stack's edge runtime rejects ("Invalid JWT") — so `functions.invoke` calls (order status on the success page, confirmation email during checkout) failed or retried, producing the intermittent successPayment timeouts and slow checkouts blamed on machine load. environment.e2e.ts now uses the legacy local anon JWT; two consecutive full runs at 142/142 with zero flaky. The click-swallowed-by-view-transition hardening (openProduct toPass loop) stays — that one was real.
8. **Watch item (superseded by #7) — rare a11y flake under load.** After transition-freeze + networkidle settling, ~1 run in 7 still failed one a11y scan (details lost with cleared test-results). If it recurs, capture `error-context.md` before re-running; suspect image-load timing on the product grid.

## Open Questions

- Browser support floor (SPEC Open Question 1) — proceeding on Angular defaults; un-animated fallback for older Safari.
- Gate 2 design review medium: screenshots in the PR, or a live walkthrough?

---

## Extension: Kiosk push (SPEC.md Phases 5–8), added 2026-08-08

Task numbering continues from T24. Same gates discipline; per-task commits.

**Stated assumption (flagged for user veto):** SPEC decides kiosk activation
via `vendors.kiosk_enabled`, but doesn't say what a kiosk-enabled vendor's
*phone* customers see. Interpretation implemented: kiosk mode activates only
when `kiosk_enabled = true` AND the device form factor is landscape
(mounted-tablet posture). Phones and portrait tablets always get the normal
storefront.

### Phase 5 — cart extraction + persistent panel (FR7)
- T25: `shared/components/cart-content` extracted from the sheet's inline
  template (items, qty controls, accessories, coupon, totals, CTA as
  outputs); sheet becomes a thin wrapper. Suite green = no behavior change.
- T26: `CheckoutService` — checkout()/processPayment moved verbatim out of
  the sheet so both wrappers can submit; sheet delegates. Payment call
  paths untouched (boundary).
- T27: ~~Persistent cart panel~~ — built, then REVERTED on user review
  (2026-08-08): badge + bottom sheet on every form factor, kiosk included.
  cart-content/CheckoutService extraction (T25/T26) retained and shared.
- T28: Delete CartDetailsPageComponent + its commented route (pre-approved).

### Phase 6 — kiosk mode (FR4)
- T29: Migration `vendors.kiosk_enabled boolean not null default false` +
  regenerated types + seeded kiosk vendor (`e2e-kiosk`, online payments ON
  to later prove the counter-forcing) + admin toggle in restaurant-info.
  Anon read already covered by the existing "active vendors" policy.
- T30: KioskModeService (activation per assumption above; session state;
  wires LayoutService.kioskMode + .kiosk-mode root class) + kiosk chrome
  (no theme toggle, cancel-order affordance).
- T31: Attract screen (banners loop, "Touchez pour commander") + 60s idle →
  20s countdown dialog → cart clear + reset. Never during checkout dialog.

### Phase 7 — counter checkout + combo shell (FR4a, FR4b)
- T32: Kiosk checkout forces pay-at-counter even with online payments
  enabled; full-screen order-number confirmation with auto-return to
  attract; e2e asserts zero payment-provider calls for the kiosk vendor.
- T33: Kiosk multi-step shell: one step-section per screen, "Étape X sur
  N" progress, recap strip, explicit "Passer" on optional steps.

### Phase 8 — Capacitor (FR5)
- T34: @capacitor/screen-orientation + keep-awake + status-bar (platform-
  guarded), Android back-button policy. Device verification is manual —
  flagged to user at the end.
