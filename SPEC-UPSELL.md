# Spec: Upsell Suggestions (FR4c, un-deferred)

**Status:** IMPLEMENTED 2026-08-09 (T1–T12) — success criteria 1–5 and 7 verified by unit + e2e suites; criterion 6's kiosk idle-warning interplay needs one manual walkthrough. The migration is applied **locally only** — prod deploy needs explicit approval.
**Supersedes:** the curation model in `docs/ideas/upsell-suggestions.md` (per-product `is_upsell` flag → category-type-driven pool, decided 2026-08-09)
**Relates to:** `SPEC.md` FR4c (deferred there; specced here separately, as that document intended)

## Objective

Increase average order value by suggesting complementary items at the right moment, with near-zero vendor setup and a calm customer flow.

Two mechanisms, one shared data foundation:

1. **Category types.** Every category gets a `category_type` from a fixed enum (`entree`, `plat`, `boisson`, `dessert`, `sauce`, `accompagnement`, `autre`). The upsell pool = available products in categories whose type is in the *upsellable set*. **v1 hardcodes the upsellable set to `['boisson', 'dessert']`**; making it vendor-configurable (and later AI-assisted, cross-vendor) is explicitly out of scope for v1 but must not be structurally precluded.
2. **Convert-to-menu.** When a customer adds a *simple* product that also exists as a `step_option` inside a multi-step product (a menu), the post-add screen first offers upgrading to that menu instead of showing pool suggestions.

### User stories

- As a customer, after adding a burger that exists in "Menu Burger", I'm offered "Et si vous en faisiez un menu ?" with one obvious accept and one obvious decline.
- As a customer, after adding an item with no menu counterpart, when my cart has no drink or dessert, I see a one-screen "Une petite soif ? 🥤" page with 3–4 items I can add in one tap, and a prominent "Non merci".
- As a customer on a product page, I see a "Pour accompagner" strip of drinks/desserts I can add without leaving the page.
- As a vendor, when I create or edit a category, I pick its type from a short fixed list — that is my entire upsell setup.
- As a kiosk customer, I get the same post-add screen (page, not dialog — it must not interact with the idle-warning dialog counting).

### Surfaces (recap from ideation)

| Surface | Content | Trigger |
|---|---|---|
| Product page strip | Pool items (drinks/desserts) | **Simple product pages only** (menu pages carry their own steps); shown when pool is non-empty; reuses `AccessoriesStripComponent` pattern |
| Post-add page — convert-to-menu | The containing menu | Simple product added AND product is an option in ≥1 available multi-step product |
| Post-add page — pool suggestions | Pool items | Any product added AND cart contains no pool-category item (counting products nested inside menus, via the `selectCartQuantityMap`-style nested walk) AND pool is non-empty |

Post-add page frequency: at most once per order session per tier (a dismissed screen never re-fires this session; convert-to-menu decline does not block a later pool suggestion, but the whole post-add mechanism fires at most twice per session total). Session-scoped state, reset with `clearCart`.

### Convert-to-menu accept behavior (v1)

When several menus contain the product, offer the **cheapest available** one. On accept: remove the just-added simple item from the cart, navigate into the menu product's focus-shell flow with the matching step option **preselected when unambiguous** (exactly one matching option in a single-select step); otherwise enter the flow unselected. On decline: plain "Non merci", continue to the product grid — and the pool-suggestion tier is *not* shown on the same add (one screen per add, maximum).

## Tech Stack

Angular 20 (standalone components, `inject()`, signals + NgRx where the cart already uses it), Angular Material, TailwindCSS, Supabase (PostgreSQL). No new dependencies expected — adding any requires approval.

## Commands

```
Dev server:      npm start
Build:           npm run build
Tests:           npm test                          # Karma/Jasmine — 5 pre-existing runtime failures are baseline, do not chase them
Local Supabase:  supabase start
DB reset:        supabase db reset --yes --local   # applies all migrations locally
Types:           supabase gen types typescript --local   # regenerate src/app/types/supabase.types.ts after the migration
```

## Project Structure (touched areas)

```
supabase/migrations/                       → new migration: categories.category_type
src/app/types/supabase.types.ts            → regenerated after migration
src/app/services/product.service.ts        → getUpsellPool(vendorId, orderType) beside getAccessories()
src/app/services/supabase.service.ts       → pool query (category_type IN upsellable set, is_available, order type, display_order)
src/app/services/                          → new upsell.service.ts (trigger logic, session state, menu-containment lookup)
src/app/components/product-add/            → post-add navigation hook (simple products)
src/app/components/add-product-multi-step/ → post-add navigation hook (menus)
src/app/components/upsell-page/            → new post-add focus-shell page (both tiers)
src/app/components/product-manager/        → category create/edit: required type select
src/app/components/accessories-strip/      → reused (or minimally generalized) for the product-page strip
```

## Data Model

Migration (one file):

```sql
alter table categories add column category_type text
  check (category_type in ('entree','plat','boisson','dessert','sauce','accompagnement','autre'));
```

- Nullable, no default: existing categories are untyped until the vendor edits them. Untyped categories simply never enter the pool — the feature degrades to invisible, never to wrong.
- Admin makes the field required on category **create**, and nudges (non-blocking chip/hint) on existing untyped categories.
- Text + CHECK rather than a Postgres enum, so extending the list later is a constraint swap, not a type migration.
- No RLS policy changes expected (column rides existing `categories` policies) — verify with `supabase db reset` + a storefront smoke test before calling the migration done.

Menu-containment lookup: "simple product P is in menu M" ⇔ M is multi-step, available, same vendor, and some `step_options` row of M has `product_id = P.id`. Implemented as a cached service query (same 10-min cache style as `getAccessories`).

## Code Style

Follow the accessories precedent exactly — this is the house style for this feature:

```typescript
// product.service.ts — mirror getAccessories()
getUpsellPool(vendorId: number, orderType: OrderType): Observable<Product[]> {
  const cacheKey = `${vendorId}:${orderType}`;
  const cached = this.upsellCache.get(cacheKey);
  if (cached && Date.now() - cached.at < UPSELL_CACHE_TTL_MS) {
    return of(cached.products);
  }
  return this.supabaseService.getUpsellProducts(vendorId, orderType, UPSELLABLE_CATEGORY_TYPES) // ['boisson', 'dessert'] — v1 constant
    .pipe(tap((products) => this.upsellCache.set(cacheKey, { products, at: Date.now() })));
}
```

Conventions: standalone components, `inject()`, single quotes, 2-space indent, no `any`, French customer-facing copy, kebab-case filenames. The post-add page follows the focus-shell recipe (centered title, one decision per screen, flat calm surfaces per the recent design commits — no shadows, no accent borders).

## Testing Strategy

Karma/Jasmine, colocated `.spec.ts`. The 5 pre-existing unmocked-component failures are baseline; new specs must pass and must not add to the baseline.

- **Unit (required):** upsell trigger logic (pool-item-in-cart detection including nested menu products; session-state one-shot behavior; empty-pool short-circuit), menu-containment lookup, pool query filters (type set, availability, order type).
- **Component (required):** upsell page renders both tiers correctly; "Non merci" emits/navigates; admin category form requires type on create.
- **E2E (required):** a Playwright journey spec in `e2e/journeys/` riding the existing four-viewport suite — add simple product contained in a menu (convert offer shown), decline, add another item (pool offer shown), accept a drink, complete checkout; plus a no-typed-categories run asserting zero upsell UI. `supabase/seed.sql` gains typed categories (boisson/dessert) and a menu containing a simple product.
- **Manual (required before merge):** kiosk-only check — idle-warning countdown still fires and resets normally while the upsell page is open.

## Boundaries

- **Always:** migration applied and tested locally first (`supabase db reset`); regenerate `supabase.types.ts` in the same change as the migration; French copy on customer surfaces; post-add surface is a routed page, never a dialog; prefer reusing `AccessoriesStripComponent` over forking it; run `npm test` and `npm run build` before each commit.
- **Ask first:** applying the migration to the remote/prod project; any new dependency; any change to `checkout.service.ts` flow; generalizing/renaming shared components beyond adding inputs; edits to `SPEC.md` beyond flipping the FR4c deferral note.
- **Never:** attribution columns or analytics in v1 (recorded trade-off — AOV is unmeasurable at launch by choice); upsell dialogs; storing upsell config in `vendor_metadata`; removing or weakening existing RLS policies; deleting failing tests to go green.

## Success Criteria

1. A vendor can assign a type to a category at create/edit; create requires it; the enum list matches the seven values above.
2. With ≥1 available product in a `boisson`/`dessert` category: the product page shows the strip; adding a non-pool product with a pool-free cart routes through the suggestion page exactly once per session; adding a suggested item from either surface puts it in the cart as a normal line item at its normal price.
3. Simple product contained in a menu → post-add offers convert-to-menu; accept lands in the menu flow (option preselected when unambiguous) with the simple item removed from the cart; decline continues to the grid with no second prompt on that add.
4. With no typed categories (all existing vendors, day one): zero upsell UI appears anywhere — no empty strips, no blank pages.
5. Cart already contains a drink (including one nested inside a menu) → no pool suggestion page.
6. Kiosk: same behavior; idle-warning countdown still triggers and resets correctly on the upsell page.
7. `npm run build` clean; `npm test` green minus the 5 baseline failures; existing accessories behavior unchanged.

## Open Questions

- The exact French copy for the two post-add tiers (placeholder: "Et si vous en faisiez un menu ?" / "Une petite soif ?") — vendor-visible wording, worth a native check before launch.

## Resolved Decisions (2026-08-09 review)

- Multiple menus contain the added product → offer the **cheapest** available menu only.
- Product-page strip on **simple product pages only**; menu pages stay clean.
