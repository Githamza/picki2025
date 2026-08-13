# Task List: Qonto Payment Terminal on Kiosk

Source: `SPEC-QONTO-TERMINAL.md` + `tasks/plan.md`. Statuses: `[ ]` todo · `[x]` done.
Run order is top-to-bottom; dependencies noted per task.

---

## Phase 1 — Foundation

- [x] **T1: Migration + regenerated types**
  - Acceptance: one migration creates `vendor_qonto_connections` (PK `vendor_id` FK→vendors, `organization_id`, `access_token`, `access_token_expires_at`, `refresh_token`, `connected_at`, `updated_at`; RLS enabled, **zero policies**), adds `vendors.kiosk_terminal_enabled boolean not null default false`, `vendors.kiosk_terminal_id text`, `vendors.kiosk_terminal_label text`, and `orders.terminal_payment_id text`, `orders.terminal_payment_method text`, `orders.terminal_card_summary text`; `supabase.types.ts` regenerated in the same change.
  - Verify: `supabase db reset --yes --local` applies cleanly; `npm run build` compiles; SQL probe with anon key reads `kiosk_terminal_enabled` from vendors and gets **zero rows / permission denied** on `vendor_qonto_connections`; service-role reads both.
  - Files: `supabase/migrations/<ts>_add_qonto_terminal.sql`, `src/app/types/supabase.types.ts`
  - Dependencies: none · **Size: S**

- [x] **T2: E2E fixture for the terminal toggle**
  - Acceptance: an e2e helper (in `e2e/fixtures/`) can set/unset `kiosk_terminal_enabled` + `kiosk_terminal_id`/`label` on the seeded kiosk vendor via the local service-role client, and restores the previous state after the test; seed data itself stays toggle-OFF so every existing spec is untouched.
  - Verify: existing kiosk journey `npx playwright test e2e/journeys/kiosk.spec.ts` still green with the fixture merely imported.
  - Files: `e2e/fixtures/<helper>.ts`
  - Dependencies: T1 · **Size: S**

### Checkpoint — Foundation
- [ ] db reset + build green; RLS probe passes both directions; existing kiosk e2e green.

---

## Phase 2 — Edge functions (mock-first, no Qonto account needed)

- [x] **T3: `qonto-terminal` skeleton + shared helper + `create-payment`**
  - Acceptance: `_shared/qonto.ts` exports base URLs from env (`QONTO_API_BASE_URL`, `QONTO_OAUTH_BASE_URL`, `QONTO_STAGING_TOKEN`, `QONTO_MOCK`), a `qontoFetch` that injects auth + staging headers, and the mock simulator (authorize after ~3 polls; total `.13` → REFUSED `card_declined`; `.99` → stays PENDING forever). `qonto-terminal/index.ts` dispatches on `action`; `create-payment` accepts `{orderId}` only, loads the order with the service role, rejects unless the vendor has `kiosk_terminal_enabled` + `kiosk_terminal_id` + a connection (mock mode: connection check stubbed), rejects unless order status is `initiated`, computes the amount **from the order row**, sends a fresh UUID `X-Qonto-Idempotency-Key`, stores `terminal_payment_id` on the order, returns `{paymentId}`. CORS headers inlined per `confirm-payment` precedent. French error strings.
  - Verify: new `scripts/test-qonto-functions.sh` (curl against `supabase functions serve` with `QONTO_MOCK=true`) — happy path returns a paymentId; client-supplied `amount` field is ignored (asserted); wrong-status order → 4xx; unknown order → 4xx. Script is the RED test: written first, fails, then the function makes it pass.
  - Files: `supabase/functions/_shared/qonto.ts`, `supabase/functions/qonto-terminal/index.ts`, `scripts/test-qonto-functions.sh`
  - Dependencies: T1 · **Size: M**

- [x] **T4: `get-payment` — status proxy + server-side success**
  - Acceptance: `{orderId, paymentId}` → proxies status (mock: simulator). On `AUTHORIZED`: atomically updates the order (status `initiated→todo`, `payAtCheckout=false`, `terminal_payment_method`, `terminal_card_summary`) — idempotent if polled again after success. On `REFUSED`: returns `{status:'REFUSED', failureReason}`, order untouched. `PENDING` passthrough. Rejects mismatched order/payment pairs.
  - Verify: test script cases — poll loop reaches AUTHORIZED and the order row is `todo` with payment fields set (checked via SQL); `.13` order polls to REFUSED and order stays `initiated`; re-poll after AUTHORIZED returns AUTHORIZED without double-update.
  - Files: `supabase/functions/qonto-terminal/index.ts`, `scripts/test-qonto-functions.sh`
  - Dependencies: T3 · **Size: M**

- [x] **T5: `cancel-order` — cancellation + stock release**
  - Acceptance: `{orderId}` → only orders still `initiated` (with a terminal-enabled vendor) are cancelled; sets status `cancelled` then calls the existing `restore_stock_for_order` RPC; already-`todo`/`cancelled` orders → 4xx without side effects.
  - Verify: test script — cancel a refused-payment order: status becomes `cancelled` and a stock-tracked product's quantity is restored (SQL assert); cancelling an AUTHORIZED (`todo`) order fails.
  - Files: `supabase/functions/qonto-terminal/index.ts`, `scripts/test-qonto-functions.sh`
  - Dependencies: T4 · **Size: S**

- [ ] **T6: `qonto-oauth` — connection lifecycle + row-locked refresh**
  - Acceptance: admin-JWT-authenticated actions `authorize-url` (builds oauth.qonto.com URL with scopes `terminal.read terminal.write offline_access organization.read`, signed `state` binding vendor_id), `exchange` (verifies state, exchanges code — mock mode fakes Qonto's token response — upserts `vendor_qonto_connections`, never returns tokens), `status`, `disconnect` (deletes row). `_shared/qonto.ts` gains `getValidAccessToken(vendorId)`: refreshes when expired under `select … for update`, persists the new access+refresh pair atomically; `qonto-terminal` switches to it (mock mode: bypass).
  - Verify: test script — full mock connect: authorize-url contains client_id/scopes/state; exchange with valid state creates the row (SQL assert), bad state → 4xx; status flips connected true/false around disconnect; unauthenticated (anon) calls → 401. Two parallel `getValidAccessToken` calls on an expired token leave exactly one valid refresh token (no lost update).
  - Files: `supabase/functions/qonto-oauth/index.ts`, `supabase/functions/_shared/qonto.ts`, `scripts/test-qonto-functions.sh`
  - Dependencies: T3 · **Size: M**

### Checkpoint — Edge functions
- [ ] `scripts/test-qonto-functions.sh` fully green against served functions, `QONTO_MOCK=true`.

---

## Phase 3 — Admin slice

- [ ] **T7: Vendor model + settings writers**
  - Acceptance: `kiosk_terminal_enabled/_id/_label` flow through the vendor select list + model (`supabase-auth.service.ts:153,182` pattern); new writer `updateVendorKioskTerminal(...)` modeled on `updateVendorOnlinePaymentsEnabled` (`:463-480`); `vendor.service.ts` facade options extended (`saveRestaurantInfo`, `:621-634`) with store refresh.
  - Verify: `ng test --include='**/vendor*'` (new focused spec for the writer mapping) or build + manual SQL check that a save round-trips all three columns.
  - Files: `src/app/services/supabase-auth.service.ts`, `src/app/services/vendor.service.ts`, `src/app/models/*` (vendor interface)
  - Dependencies: T1 · **Size: M**

- [ ] **T8: Paiement page — "Terminal de paiement (Qonto)" section**
  - Acceptance: new section in `paiement.component`: connection status via `qonto-oauth/status`; **Connecter** opens the `authorize-url` in the same tab; **Déconnecter** confirms then calls `disconnect` and force-disables the toggle (server value saved); terminal dropdown populated via `qonto-terminal/list-terminals` (id + poi_id label) only when connected; activation toggle disabled unless connected ∧ terminal selected ∧ vendor currency EUR, with French helper text per blocked reason; save persists via T7 writer + snackbar, matching the existing section UX (`:1049-1054` pattern).
  - Verify: `ng test --include='**/paiement*'` for the guard logic (toggle-disabled truth table); manual walkthrough with mock mode on local stack.
  - Files: `src/app/components/restaurant-info-admin/children/paiement/paiement.component.{ts,html,scss}`
  - Dependencies: T6, T7 · **Size: M**

- [ ] **T9: OAuth callback route**
  - Acceptance: `/admin/qonto/callback` (admin-guarded, standalone component) reads `?code&state`, invokes `qonto-oauth/exchange`, shows success/error state in French, then routes back to the Paiement page; on error offers "Réessayer" (restarts authorize-url flow).
  - Verify: `ng test --include='**/qonto-callback*'` (exchange invoked with code+state; error path renders retry); manual mock walkthrough.
  - Files: `src/app/components/admin/qonto-callback/qonto-callback.component.ts`, `src/app/app.routes.ts` (admin children)
  - Dependencies: T6 · **Size: S**

### Checkpoint — Admin slice
- [ ] Mock-mode walkthrough: connect → dropdown lists mock terminals → select + enable → disconnect force-disables. `npm run build` green.

---

## Phase 4 — Kiosk slice

- [ ] **T10: `QontoTerminalService` polling state machine**
  - Acceptance: `startPayment(orderId)` emits `TerminalPaymentState` phases (`pushing → waiting-card → authorized | refused | timeout`), polling `get-payment` at 1s × 10 then 2s, hard stop at 120s (overridable via `window.__KIOSK_TERMINAL_TIMEOUT_MS__`, same pattern as `__KIOSK_IDLE_MS__`); `cancelOrder(orderId)` wraps the edge action; errors from `create-payment` surface as `refused` with a generic French reason.
  - Verify: RED-first Karma spec with `fakeAsync` — phase sequences for authorized/refused/timeout, backoff timing, unsubscribe stops polling. `ng test --include='**/qonto-terminal*'`.
  - Files: `src/app/services/qonto-terminal.service.ts`, `src/app/services/qonto-terminal.service.spec.ts`
  - Dependencies: T4 · **Size: M**

- [ ] **T11: `TerminalPaymentDialogComponent`**
  - Acceptance: full-screen MatDialog (`disableClose: true`), kiosk-sized (≥64px targets, M3 tokens, French copy): waiting state shows amount + "Présentez votre carte sur le terminal" + animated indicator; refused/timeout state shows reason + **Réessayer** (restarts `startPayment` on the same order) + **Annuler** (calls `cancelOrder`, closes with `{outcome:'cancelled'}`); authorized closes with `{outcome:'authorized'}`; timeout auto-transitions to the error state (order not yet cancelled — cancel happens on Annuler or on dialog-level abandon per T12).
  - Verify: RED-first component spec — state rendering per phase, Réessayer re-invokes, Annuler cancels then closes. `ng test --include='**/terminal-payment*'`.
  - Files: `src/app/components/kiosk/terminal-payment-dialog/terminal-payment-dialog.component.{ts,html,scss,spec.ts}`
  - Dependencies: T10 · **Size: M**

- [ ] **T12: Checkout gating in `checkout.service.ts`**
  - Acceptance: in the pay-at-checkout branch (`:406-427`), `useTerminal = kioskMode.active() && vendor.kiosk_terminal_enabled`; order created with status `initiated` when true (`todo` unchanged when false — toggle-OFF path byte-for-byte identical); on true, opens the dialog and on `{outcome:'authorized'}` runs the exact existing success sequence (print fire-and-forget → clearCart → reset preference → navigate `successPayment`); on `{outcome:'cancelled'}` the cart is **kept** and the user returns to the cart view; success screen shows "Paiement accepté" instead of "Payez au comptoir" for terminal-paid orders. Verify locally that `create_full_order` accepts `initiated` on this path (fallback per plan risk table if not).
  - Verify: RED-first spec for the branch truth table (kiosk × toggle → status + dialog opened y/n) with dialog/service mocked. `ng test --include='**/checkout*'` (new spec only; baseline failures untouched).
  - Files: `src/app/services/checkout.service.ts`, `src/app/services/checkout.service.qonto.spec.ts`, `src/app/components/payment-success/payment-success.component.ts` (copy variant)
  - Dependencies: T10, T11 · **Size: M**

### Checkpoint — Kiosk slice
- [ ] Manual kiosk run, mock mode: normal total → authorized → print + order-number screen; `.13` total → refused → Réessayer works; Annuler → cart intact, order `cancelled` in DB.

---

## Phase 5 — Verification & hardening

- [ ] **T13: Playwright `kiosk-terminal.spec.ts`**
  - Acceptance: kiosk-landscape project, edge responses stubbed via route interception on `/functions/v1/qonto-terminal`; scenarios: (a) toggle OFF → existing `kiosk.spec.ts` journey passes unchanged **and** zero qonto-terminal network calls; (b) authorized → waiting state visible → success screen, print path reached only after authorized stub; (c) refused → French error + Réessayer → authorized → success; (d) timeout (timeout override + stub stuck on PENDING) → error state → cancel-order fired → cart still populated; (e) Annuler → back at cart, cart intact.
  - Verify: `npx playwright test --project=kiosk-landscape` green.
  - Files: `e2e/journeys/kiosk-terminal.spec.ts`, `e2e/fixtures/<helper>.ts` (from T2)
  - Dependencies: T2, T12 · **Size: M**

- [ ] **T14: Hardening, copy, docs**
  - Acceptance: French copy pass on all new surfaces; `SPEC-QONTO-TERMINAL.md` updated (status → implemented-pending-Phase-6, Open Question #2 marked resolved); `CLAUDE.md` edge-function table + key-services list gain the two functions and `QontoTerminalService`; `scripts/test-qonto-functions.sh` documented in the spec Commands section; no TODOs left in new code.
  - Verify: `npm run build` clean; full kiosk e2e project green; grep for stray `TODO|FIXME` in new files empty.
  - Files: `SPEC-QONTO-TERMINAL.md`, `CLAUDE.md`, misc copy touch-ups
  - Dependencies: T13 · **Size: S**

### Checkpoint — Complete
- [ ] Spec Success Criteria 1, 3–11 verified locally (mock); criterion 2 verified except the physical-terminal part (user-gated Phase 6).

---

## Excluded from this run (user-gated — spec Phase 6)

- Qonto Developer Portal app registration, `QONTO_CLIENT_ID/SECRET` + staging-token secrets on staging/prod, sandbox validation, real-terminal pilot. Blocked on the user owning the Qonto relationship; nothing above depends on it thanks to mock mode.
