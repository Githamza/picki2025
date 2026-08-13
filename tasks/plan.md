# Implementation Plan: Qonto Payment Terminal on Kiosk

**Source spec:** `SPEC-QONTO-TERMINAL.md` (2026-08-13)
**Task list:** `tasks/todo.md`
**Replaces:** the completed Upsell plan (shipped 2026-08-09 per `SPEC-UPSELL.md`).

## Overview

Five phases along the dependency graph: data foundation (migration + types + e2e fixture) → edge functions built mock-first (`QONTO_MOCK` simulates Qonto, so every phase is fully testable with zero Qonto credentials) → admin settings slice (connect, pick terminal, toggle) → kiosk payment slice (polling service, full-screen dialog, checkout gating) → e2e journeys + hardening. The feature is invisible until a vendor connects Qonto *and* enables the toggle, so every phase can merge to `main` behind that natural gate. **Spec Phase 6 (Qonto Developer Portal registration, sandbox validation, prod smoke test) is user-gated and excluded from the autonomous run.**

## Architecture Decisions

1. **Trust boundary at the edge function.** Tokens, client secret, and the charged amount live server-side only. `create-payment` reads the amount from the order row; `get-payment` is the sole writer of payment success (order `initiated → todo`). The kiosk client never self-declares an outcome. Precedent: `confirm-payment/index.ts`.
2. **Mock-first edge functions.** `QONTO_MOCK=true` makes `qonto-terminal` simulate Qonto in-process: payments authorize after ~3 polls; a total ending in `.13` refuses (`failure_reason: 'card_declined'`); `.99` never resolves (timeout path). This gives deterministic local/CI behavior and lets the admin + kiosk slices be built and e2e-tested before any Qonto account exists.
3. **Stock release is explicit, not a trigger.** `restore_stock_for_order(p_order_id)` is an existing SECURITY DEFINER RPC called explicitly by current cancel/refuse paths (`orders.service.ts:344,400`). The `cancel-order` edge action calls the same RPC after setting `cancelled`. (Resolves spec Open Question #2.)
4. **One shared Qonto helper module** — `supabase/functions/_shared/qonto.ts` — owns base URLs, token refresh, and the mock simulator. Both functions import it; neither duplicates auth code. *(As built: refresh rotation is an atomic compare-and-swap on the refresh token — `update … where refresh_token = <old>` — instead of a row lock; the CAS loser re-reads and adopts the winner's pair. Same lost-update guarantee, no extra SQL function.)*
5. **Settings copy the `online_payments_enabled` pattern end-to-end** (column → types → `supabase-auth.service` writer → `vendor.service` facade → `paiement.component` UI → `checkout.service` runtime check). No new state pattern.
6. **The payment dialog is a full-screen MatDialog with `disableClose: true`**, like `IdleWarningDialogComponent`. Open dialogs already re-arm the kiosk idle timer (`kiosk-mode.service.ts:169-172`), so the payment can't be idle-reset mid-card; the dialog owns its own 120s timeout and cancels the order before closing on abandon.
7. **Polling lives in a dedicated `QontoTerminalService`** (RxJS: 1s × 10 then 2s, hard stop 120s) emitting a typed `TerminalPaymentState`. `checkout.service.ts` consumes phases; it never talks to the edge function directly.
8. **Retry = new payment push on the same order** with a fresh idempotency key. The order stays `initiated` across retries; only Annuler/timeout cancels it (cart preserved).
9. **Verification split by layer:** edge functions get a curl-based test script against `supabase functions serve` with `QONTO_MOCK=true` (no Deno test infra exists and none is added); Angular logic gets Karma specs (`--include` to dodge the 5 known baseline failures); journeys get Playwright with route-stubbed edge responses. CI never touches real Qonto.

## Phase Order & Parallelism

```
1: Foundation           2: Edge functions          3: Admin slice        4: Kiosk slice         5: Verification
T1 migration+types ─┬─▶ T3 qonto-terminal core ─▶ T4 get-payment ─┐
T2 e2e fixture ─────┤                             T5 cancel-order ─┼─▶ T10 polling service ─▶ T13 e2e journeys
                    └─▶ T6 qonto-oauth ─────────▶ T7 settings plumbing  T11 payment dialog      T14 hardening+docs
                                                  T8 paiement UI        T12 checkout gating
                                                  T9 oauth callback
```

T1 blocks everything (types regen). T3–T6 are sequential (shared helper evolves). The admin slice (T7–T9) and kiosk slice (T10–T12) are independent of each other and both need only Phase 2; the run executes them in listed order.

## Task List

### Phase 1: Foundation
- [ ] T1: Migration (connections table, vendor + order columns) + regenerated types
- [ ] T2: E2E fixture: enable/disable the terminal toggle on the seeded kiosk vendor

### Checkpoint: Foundation
- [ ] `supabase db reset --yes --local` green; `npm run build` green; anon can read `kiosk_terminal_enabled`, cannot read `vendor_qonto_connections`

### Phase 2: Edge functions (mock-first)
- [ ] T3: `qonto-terminal` skeleton + `_shared/qonto.ts` + mock simulator + `create-payment`
- [ ] T4: `get-payment` — poll proxy; AUTHORIZED flips order server-side
- [ ] T5: `cancel-order` — cancelled + `restore_stock_for_order`
- [ ] T6: `qonto-oauth` — authorize-url / exchange / status / disconnect + row-locked token refresh

### Checkpoint: Edge functions
- [ ] `scripts/test-qonto-functions.sh` passes end-to-end against served functions with `QONTO_MOCK=true` (incl. amount-integrity and refused/timeout mock paths)

### Phase 3: Admin slice
- [ ] T7: Vendor model + settings writers (`supabase-auth.service`, `vendor.service`)
- [ ] T8: Paiement page "Terminal de paiement (Qonto)" section (connect, dropdown, guarded toggle)
- [ ] T9: `/admin/qonto/callback` OAuth landing route

### Checkpoint: Admin slice
- [ ] Manual walkthrough on local stack with mock mode: connect → list terminals → select → enable toggle; disconnect force-disables

### Phase 4: Kiosk slice
- [ ] T10: `QontoTerminalService` polling state machine (+ fakeAsync spec)
- [ ] T11: `TerminalPaymentDialogComponent` full-screen states (+ spec)
- [ ] T12: `checkout.service.ts` gating: `useTerminal` branch, `initiated` status, dialog orchestration (+ spec)

### Checkpoint: Kiosk slice
- [ ] Manual kiosk run on local stack, mock mode: authorized → print+success; `.13` total → refused → retry; Annuler → cart intact

### Phase 5: Verification & hardening
- [ ] T13: Playwright `kiosk-terminal.spec.ts` (authorized, refused→retry, timeout, abandon) + toggle-off regression gate
- [ ] T14: Hardening + copy + spec/doc updates (success-screen variant, CLAUDE.md, spec status)

### Checkpoint: Complete
- [ ] All spec Success Criteria 1–11 except the real-terminal parts of 2 (sandbox/prod = user-gated Phase 6)
- [ ] `npm run build` clean; kiosk e2e project green

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| RLS lockdown blocks anon read of `kiosk_terminal_enabled` or leaks the connections table | High | T1 explicitly tests both directions with anon + service clients before anything builds on it |
| One-time-use refresh token lost on concurrent refresh → vendor must reconnect | High | Row-locked refresh in `_shared/qonto.ts` (T6); concurrency exercised in the test script |
| Anon `cancel-order`/`create-payment` abused against arbitrary orders | Med | Actions only accept orders that are `initiated`, belong to a terminal-enabled vendor, and (cancel) carry a known `terminal_payment_id` lineage; amounts always from DB. Rate limiting explicitly out of scope v1 |
| Karma baseline (5 pre-existing failures) muddies RED/GREEN | Med | New specs run via `ng test --include='**/qonto*' --include='**/checkout*'`; baseline failures documented, never "fixed" by deletion |
| `create_full_order` RPC may not accept `initiated` for kiosk path without side effects | Med | T12 verifies the RPC path with `initiated` locally before wiring the dialog; falls back to post-create status update only if needed (and documents it) |
| Playwright clock-mocking the 120s timeout is brittle | Low | Timeout duration is injectable (`window.__KIOSK_TERMINAL_TIMEOUT_MS__`, same pattern as `__KIOSK_IDLE_MS__`) |

## Out of Scope (this run)

- Spec Phase 6: Qonto Developer Portal registration, staging-token secrets, sandbox validation, prod pilot — **requires the user** (Qonto account ownership, production secrets).
- Webhook (`v1/terminal-payments`) hardening, tips handling, printing `card_summary` on the ticket, rate limiting.

## Open Questions

- None blocking. Spec Open Question #2 (stock release) is resolved by Architecture Decision 3; #1/#3/#4 only matter at Phase 6.
