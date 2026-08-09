# Task List: Upsell Suggestions (FR4c)

Source: `SPEC-UPSELL.md` + `tasks/plan.md`. Statuses: `[ ]` todo · `[x]` done.
Run order is top-to-bottom; dependencies noted per task.

---

## Phase A — Data foundation

- [x] **T1: `category_type` migration + regenerated types**
  - Acceptance: new migration adds nullable `categories.category_type text` with CHECK over `('entree','plat','boisson','dessert','sauce','accompagnement','autre')`; `supabase db reset --yes --local` applies cleanly; `supabase.types.ts` regenerated in the same change; no RLS policy changes needed (verify storefront still reads categories anonymously).
  - Verify: `supabase db reset --yes --local`; `npm run build` (types compile); quick storefront smoke on dev server.
  - Files: `supabase/migrations/<ts>_add_category_type.sql`, `src/app/types/supabase.types.ts`
  - Dependencies: none · **Size: S**

- [x] **T2: Seed fixtures for upsell e2e**
  - Acceptance: `seed.sql` additions only — a `boisson` category with ≥2 available drinks, a `dessert` category with ≥1 dessert, and one multi-step "menu" product whose step options include an existing simple seeded product (so convert-to-menu triggers). Existing seed rows untouched.
  - Verify: `supabase db reset --yes --local`; full existing Playwright suite still green (`npx playwright test`).
  - Files: `supabase/seed.sql`
  - Dependencies: T1 · **Size: S**

- [x] **T3: Category admin — type select**
  - Acceptance: category create/edit UI gains a required-on-create select with French labels (Entrée, Plat, Boisson, Dessert, Sauce, Accompagnement, Autre); editing an untyped category prompts for the type; category list shows a subtle hint on untyped rows; value persists through the existing category service path.
  - Verify: `npm test` (new component spec for required-on-create); manual create + edit in admin.
  - Files: category dialog/component under `src/app/components/product-manager/`, category model/service mapping (2–3 files)
  - Dependencies: T1 · **Size: M**

## Phase B — Services (parallel after T1)

- [x] **T4: Pool query + `getUpsellPool`**
  - Acceptance: `SupabaseService.getUpsellProducts(vendorId, orderType, types)` filters `is_available`, `applicable_order_types` contains orderType, category's `category_type` in the passed set, ordered by `display_order`; `ProductService.getUpsellPool(vendorId, orderType)` wraps it with the accessories-style 10-min cache and the exported `UPSELLABLE_CATEGORY_TYPES = ['boisson', 'dessert']` constant (single definition site).
  - Verify: new unit specs green; `npm test` baseline unchanged.
  - Files: `src/app/services/supabase.service.ts`, `src/app/services/product.service.ts`, `src/app/services/product.service.spec.ts`
  - Dependencies: T1 · **Size: M**

- [x] **T5: `UpsellService` — trigger logic + session state**
  - Acceptance: `cartHasPoolItem()` detects pool-category products including those nested in menu metadata (reuse the `selectCartQuantityMap` walk); one-shot signals per tier per session; both reset when the cart empties/clears; `shouldShowPoolTier()` short-circuits on empty pool; no NgRx state added.
  - Verify: new unit specs cover nested detection, one-shot behavior, reset, empty-pool short-circuit.
  - Files: `src/app/services/upsell.service.ts`, `src/app/services/upsell.service.spec.ts`
  - Dependencies: T1, T4 · **Size: M**

- [x] **T6: Menu-containment lookup (cheapest menu)**
  - Acceptance: given a simple product id, returns the cheapest available multi-step product of the same vendor whose `step_options` reference it (or null); cached like the pool; exposed via `UpsellService`.
  - Verify: unit specs — none/one/many menus, unavailable menu excluded, cheapest wins.
  - Files: `src/app/services/supabase.service.ts`, `src/app/services/upsell.service.ts` (+ spec)
  - Dependencies: T1 · **Size: M**

## Phase C — Surfaces

- [x] **T7: "Pour accompagner" strip on simple product pages**
  - Acceptance: strip renders below the description on simple product pages only (never multi-step), reusing `AccessoriesStripComponent`; hidden entirely when pool is empty or product itself is in the pool; adding from the strip dispatches a normal `addToCart` line at normal price; layout matches the flat calm card recipe.
  - Verify: component spec (hidden-when-empty, add dispatches); visual check on dev server.
  - Files: `src/app/components/product-add/regular-product-view/*` (component + template), possibly `accessories-strip.component.ts` (new inputs only)
  - Dependencies: T4 · **Size: M**

- [x] **T8: Upsell page (focus shell) + route**
  - Acceptance: routed page under the vendor context (`.../upsell`) rendering either tier — convert-to-menu ("Et si vous en faisiez un menu ?", menu card, accept/decline) or pool suggestions ("Une petite soif ? 🥤", 3–4 pool items with add controls, prominent "Non merci"); focus-shell styling (centered title, one decision per screen, no shadows/accent borders); guards redirect to the grid if entered with nothing to show.
  - Verify: component spec for both tiers + empty-state redirect; visual check both tiers.
  - Files: `src/app/components/upsell-page/upsell-page.component.ts` (+ template/styles if split), `src/app/app.routes.ts`
  - Dependencies: T4, T5, T6 · **Size: M**

## Phase D — Wiring

- [x] **T9: Post-add wiring — simple products (both tiers)**
  - Acceptance: after `addToCart` in `product-add`, navigation goes grid → upsell page when a tier should fire (inside the existing `document.startViewTransition`), else straight to grid as today; decline → grid, no second prompt on the same add; convert accept → simple item removed from cart, cheapest menu flow entered with the matching option preselected when unambiguous (single matching option in a single-select step), otherwise unselected — fallback documented in code if preselection is cut per plan decision 6.
  - Verify: unit spec for the routing decision; hand-run the full journey on dev server (phone viewport).
  - Files: `src/app/components/product-add/product-add.component.ts`, `src/app/services/upsell.service.ts`, `src/app/components/add-product-multi-step/add-product-multi-step.component.ts` (preselect entry only), max 2 more
  - Dependencies: T5, T6, T8 · **Size: L (riskiest — everything else lands first)**

- [ ] **T10: Post-add wiring — multi-step adds (pool tier only)**
  - Acceptance: after a menu is added, pool tier fires only if the cart (nested-aware) still lacks a pool item; never offers convert-to-menu; same one-shot session rule.
  - Verify: unit spec; hand-run menu-with-drink (no prompt) vs menu-without-drink (prompt).
  - Files: `src/app/components/add-product-multi-step/add-product-multi-step.component.ts`
  - Dependencies: T9 · **Size: S**

## Phase E — Verification

- [ ] **T11: E2E journeys**
  - Acceptance: new spec(s) in `e2e/journeys/` — (a) full upsell journey: add menu-contained simple product → convert offer → decline → add other item → pool offer → accept drink → checkout completes; (b) untyped-categories run asserts zero upsell UI anywhere. Green on all four viewport projects.
  - Verify: `npx playwright test` fully green.
  - Files: `e2e/journeys/upsell.spec.ts`, possibly `e2e/fixtures/*`
  - Dependencies: T2, T9, T10 · **Size: M**

- [ ] **T12: Final gates + spec bookkeeping**
  - Acceptance: `npm run build` clean; `npm test` at 5-failure baseline; manual kiosk idle-warning check on the upsell page done; `SPEC.md` FR4c note updated to point at `SPEC-UPSELL.md` (deferral lifted); `SPEC-UPSELL.md` success criteria 1–7 each checked off.
  - Verify: all listed commands + the success-criteria checklist itself.
  - Files: `SPEC.md`, `SPEC-UPSELL.md`
  - Dependencies: everything · **Size: S**
