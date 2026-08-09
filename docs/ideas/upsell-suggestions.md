# Upsell Suggestions

_Refined 2026-08-09 via idea-refine session. Direction: suggestion pool + two surfaces now; per-product pairings deferred._

> **Superseded 2026-08-09 by [`SPEC-UPSELL.md`](../../SPEC-UPSELL.md):** curation changed from a per-product `is_upsell` flag to a `category_type` enum on categories (v1 pool = boisson + dessert), and a convert-to-menu tier was added to the post-add screen.

## Problem Statement

How might we increase average order value by suggesting complementary items at the right moment — without adding friction for customers or setup homework for vendors?

## Recommended Direction

**One suggestion pool, two surfaces.** A product gets flagged as "suggestable" (new `is_upsell` boolean on `products`, mirroring the existing `is_accessory` mechanic), fetched through a cached `getUpsells()` just like `ProductService.getAccessories()`. Curation is hybrid: vendors tick a checkbox in the product manager; if they tick nothing, the app falls back to an automatic pick so the feature works on day one with zero vendor effort.

The pool shows up in two places:

1. **"Goes well with" strip on the product page** — reuses `AccessoriesStripComponent` (already presentational, already has add/qty controls), so this surface is mostly wiring.
2. **Post-add suggestion page** — after "Add to cart", a single focus-shell-style page ("Anything to drink? 🥤" + big "No thanks") shown *only* while the cart contains food but nothing from the suggestion pool. It's a page, not a dialog — consistent with the recorded dialog-first/focus-shell decisions (commits `bb5adae`, `efc8b25`), and it sidesteps the kiosk idle-warning's open-dialog counting (`kiosk-mode.service.ts`).

Per-product pairings (burger → these fries) wait until this simple version earns them.

### Codebase anchors

- Prior art / reuse: `accessories-strip.component.ts`, `ProductService.getAccessories()` (10-min cache), `supabase.service.ts` accessories query (`is_accessory`, `is_available`, order-type filter, `display_order`).
- Post-add hook points: `product-add.component.ts` (`addToCart` → `navigateBackToProducts()` inside `document.startViewTransition`) and `add-product-multi-step.component.ts` (post-dispatch navigation).
- Spec status: `SPEC.md` FR4c ("Upsell prompts") was deferred and explicitly named these insertion points — this document un-defers it.
- Note: there is no `/cartdetails` page anymore; the cart is a bottom sheet (`cart-details-sheet` + `cart-content`). Cart-surface upsell was considered and not chosen.

## Key Assumptions to Validate

- [ ] **The automatic fallback picks sensible items** — dry-run the rule against real vendor menus before launch; if it surfaces a €0.50 sauce as the hero, it needs a floor (cap at 3–4 items, always prefer vendor-flagged).
- [ ] **The post-add page doesn't cost completed orders** — watch kiosk sessions especially; the "No thanks" path must be one obvious tap.
- [ ] **Vendors actually flag items** — check a few weeks after rollout; if nobody curates, the auto-rule *is* the feature and deserves more investment.

## MVP Scope

**In:**

- One migration: `products.is_upsell boolean default false`.
- A "suggest as upsell" checkbox in the product manager (admin).
- `getUpsells(vendorId, orderType)` with the accessories-style cache and availability/order-type filters.
- Product-page "Goes well with" strip (reusing `AccessoriesStripComponent`).
- Post-add suggestion page with the smart trigger: show only if the cart has items but none from the suggestion pool; skip entirely if the pool is empty; session-scoped state so it never re-fires after a dismissal.

**Out:** everything below.

## Not Doing (and Why)

- **Per-product pairings** — real vendor homework plus a join table and admin UI; phase 2, only if the pool shows lift.
- **Attribution tracking** — deliberate call to keep the MVP minimal. Recorded honestly: this means the stated success metric (higher AOV) is **not measurable** at launch; success will be judged by vendor feedback. Cheap revisit path: a single `order_items` boolean marking suggestion-originated lines.
- **Upsell as a multi-step product step** — schema-free but prices the drink inside the parent line item, which breaks remove-just-the-drink UX.
- **Order-history "people also added"** — needs traffic data and an edge function we don't need yet.
- **An upsell dialog** — conflicts with both the focus-shell design language and the kiosk idle-dialog logic.

## Open Questions

- What exactly does the smart trigger check in pure-automatic mode (no vendor flags)? Matching "drink-like" categories by name is fragile — the cleanest simple rule is "no pool item in cart", which makes the auto-fallback definition the load-bearing decision.
- Does the post-add page also follow multi-step product adds, or only simple ones, for v1?
