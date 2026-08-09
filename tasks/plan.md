# Implementation Plan: Upsell Suggestions (FR4c)

**Source spec:** `SPEC-UPSELL.md` (approved 2026-08-09)
**Task list:** `tasks/todo.md`
**Replaces:** the completed Storefront UI Redesign plan (all its phases shipped per `SPEC.md`).

## Overview

Five phases along the dependency graph: data foundation (migration + seed + admin) → services (pool, trigger, menu-containment) → surfaces (strip, upsell page) → wiring (post-add hooks) → e2e + gates. Each phase is independently verifiable; nothing customer-visible ships until Phase C, and until a vendor types a category the entire feature is invisible by design — so every phase can merge to `main` behind that natural gate without a feature flag.

## Architecture Decisions

1. **`category_type` is `text` + CHECK constraint, nullable, no backfill.** Untyped categories never enter the pool: the failure mode is "no upsell", never "wrong upsell". Extending the enum later is a constraint swap, not a type migration.
2. **The upsellable set is one exported constant** — `UPSELLABLE_CATEGORY_TYPES = ['boisson', 'dessert']` — referenced by the pool query only through the service layer. Making it vendor-configurable later means swapping the constant for a vendor setting at exactly one call site.
3. **A new `UpsellService` owns trigger logic and session state** (signals, not NgRx). The cart stays NgRx; upsell session state ("convert tier shown", "pool tier shown") is ephemeral UI flow state, same category as what `CheckoutService` already owns. It resets on `clearCart` (subscribe to the action stream or watch the cart-empty selector).
4. **Nested-aware pool detection reuses the `selectCartQuantityMap` walk** (it already counts products inside multi-step menus) rather than reimplementing metadata traversal. A drink inside a purchased menu counts as "cart has a drink".
5. **Post-add is a routed page inside the vendor context** (`.../upsell`), navigated to inside the same `document.startViewTransition` that today goes straight back to the grid. Never a dialog (kiosk idle-warning counts open dialogs; focus-shell design language).
6. **Convert-to-menu preselection is best-effort, contained.** Preselect only when exactly one option in a single-select step matches the product; otherwise enter the menu flow unselected. If preselection turns out to fight the focus-shell's `offeredStepIds` edit-awareness, ship the fallback and file a follow-up — it must not block the phase.
7. **E2E over manual.** The Playwright suite (four viewports, seeded local Supabase, pay-at-counter vendor) is the verification harness; `supabase/seed.sql` gains typed categories and a menu that contains a simple product. Only the kiosk idle-timer interplay stays manual.

## Phase Order & Parallelism

```
A: Data foundation        B: Services              C: Surfaces        D: Wiring          E: Verification
T1 migration+types ──┬──▶ T4 pool query/service ─▶ T7 strip ────────┐
T2 seed fixtures ────┤    T5 UpsellService ──────▶ T8 upsell page ──┼─▶ T9 simple wiring ─▶ T11 e2e journeys
T3 category admin ───┘    T6 menu containment ───────────────────────┘   T10 menu wiring     T12 gates+SPEC note
```

- T1 blocks everything (types regen). T2 and T3 can proceed in parallel with Phase B once T1 lands.
- T4/T5/T6 are mutually independent. T7 needs T4; T8 needs T4+T5+T6.
- T9 is the riskiest task (preselection, cart mutation, view transition) — everything else is deliberately de-risked before it starts.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Convert-to-menu preselection fights the focus-shell step machinery | Decision 6: unambiguous-only, documented fallback, follow-up ticket instead of scope creep |
| Post-add route breaks the view-transition polish from the redesign | T9 acceptance explicitly includes transition continuity; e2e asserts no dead-end navigation |
| Seed changes destabilize the existing e2e baseline | T2 only *adds* rows (new categories, one new menu); run the full existing suite as its verify step |
| Session state leaks across orders | Reset tied to cart-clear in `UpsellService`; unit-tested in T5 |
| Untyped-category day-one regression for live vendors | Success criterion 4 has its own e2e run (no typed categories → zero upsell UI) |

## Verification Checkpoints

- **After Phase A:** `supabase db reset --yes --local` clean; existing Playwright suite green (seed additions are non-breaking); category create requires a type.
- **After Phase B:** new unit specs green; `npm test` failure count unchanged from the 5-spec baseline.
- **After Phase C:** strip and page render against seeded data in the dev server; still zero behavior change for untyped vendors.
- **After Phase D:** full journey works by hand on the dev server (phone viewport).
- **Phase E:** new e2e journeys green on all four viewport projects; `npm run build` clean; kiosk idle manual check; `SPEC.md` FR4c note flipped to point here.
