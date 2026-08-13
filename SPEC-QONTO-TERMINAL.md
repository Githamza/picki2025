# Spec: Qonto Payment Terminal on Kiosk

**Status:** IMPLEMENTED (Phases 1–5, mock mode) — Phase 6 (Qonto Developer Portal registration, sandbox validation, prod pilot) pending, user-gated
**Date:** 2026-08-13 (implemented same day; see "As-built notes" at the end)
**Scope:** Kiosk checkout payment via a physical Qonto card terminal, plus the admin-side Qonto connection and activation settings. Non-kiosk storefront, Stripe, and PayGreen paths are untouched.
**Related specs:** `SPEC.md` FR4/FR4a (kiosk mode, pay-at-counter), `SPEC-UPSELL.md` (precedent for feature-scoped specs).

---

## Objective

Let a kiosk customer pay by card on a physical Qonto payment terminal before their order is accepted, instead of paying at the counter.

Today (FR4a) every kiosk order is forced pay-at-counter: order is created with status `todo`, the thermal ticket prints immediately, and the customer pays staff on pickup. That works, but staff must chase payment for every order. With a Qonto terminal:

- **Vendor connects their Qonto account** once from the admin dashboard (OAuth), picks which of their physical terminals the kiosk uses, and flips a toggle.
- **Toggle OFF (default):** current workflow, byte-for-byte — order validation → ticket prints → order-number screen ("Payez au comptoir").
- **Toggle ON:** order validation → amount is pushed to the terminal → customer presents card → on **approval** the ticket prints and the order-number screen shows → on **refusal/timeout** a full-screen error with a **Réessayer** button (and an explicit way to abandon).

An order paid on the terminal reaches the vendor's order board only after the card issuer approved it. An unpaid order never prints and never appears as `todo`.

### Who is the user

| User | Need |
|---|---|
| **Kiosk customer** | Pay by card without waiting at the counter; unambiguous "present your card" / "payment refused, retry" screens in French |
| **Vendor admin** | Connect Qonto once, choose the terminal, turn the feature on/off; never blocked — can turn it off and fall back to pay-at-counter instantly |
| **Staff** | Orders on the board are already paid when the terminal is active; ticket only exists for paid orders |

### Success looks like

A customer taps "Valider la commande", the terminal beeps and displays the exact order total, they tap their card, the kiosk shows the order number, and the ticket is already printing. A refused card shows a clear error and a retry that pushes the amount to the terminal again. The vendor flips one toggle to go back to pay-at-counter at any time.

---

## Qonto API facts (grounding)

Verified against docs.qonto.com, 2026-08-13:

| Fact | Detail |
|---|---|
| Auth | OAuth 2.0 only for terminal scopes (`terminal.read`, `terminal.write`); API-key auth returns `oauth_required`. Authorize at `https://oauth.qonto.com/oauth2/auth`, token exchange at `https://oauth.qonto.com/oauth2/token` |
| Tokens | Access token ~1h; refresh token 90 days and **one-time use** — every refresh invalidates the old one and returns a new pair. Refreshing must be serialized server-side |
| List terminals | `GET https://thirdparty.qonto.com/v2/terminals` (scope `terminal.read`) → `{id, poi_id (Adyen serial printed on device), created_at, updated_at}`, paginated. No online/offline status field |
| Create payment | `POST https://thirdparty.qonto.com/v2/terminals/{id}/payment` (scope `terminal.write`), body `{amount: {value: "13.30", currency: "EUR"}, metadata: {...≤1kB}}`, header `X-Qonto-Idempotency-Key` (UUID, mandatory). Returns **202 Accepted** — asynchronous; amount range 0.10–100 000.00, **EUR only** |
| Payment status | `GET https://thirdparty.qonto.com/v2/terminal_payments/{id}` (scope `terminal.read`) → `status` ∈ `PENDING` \| `AUTHORIZED` \| `REFUSED`, plus `failure_reason`, `payment_method` (visa, cartebancaire…), `card_summary` (last 4), `tip_amount`, `authorized_amount`, `authorized_at` |
| Offline terminal | Create still returns 202 but no outcome ever arrives → client-side timeout ~120s is Qonto's own recommendation |
| Webhook | `v1/terminal-payments` webhook exists; **not used in v1** (polling chosen — see Resolved Decisions) |
| Sandbox | `https://thirdparty-sandbox.staging.qonto.co` with extra header `X-Qonto-Staging-Token`; OAuth app registered on the Qonto Developer Portal |

---

## Tech Stack

Existing, unchanged: Angular 20 standalone + signals, Angular Material M3, NgRx, Supabase (Postgres + Edge Functions/Deno), Capacitor 8 Android shell. **No new npm dependency is expected.** Polling uses RxJS already in the app; edge functions use `fetch` and the pinned `supabase-js@2.111.0` (esm.sh pin, see project memory).

---

## Commands

```bash
# Development
npm start                          # ng serve --port 4300
npm run build                      # production build — must pass before commit

# Tests
npx playwright test --project=kiosk-landscape        # kiosk e2e (terminal flow mocked at network layer)
npx playwright test e2e/journeys/kiosk.spec.ts
ng test --include='**/qonto*'                        # new unit specs (Karma baseline has 5 known failures)

# Supabase
supabase start                                       # local stack
supabase db reset --yes --local                      # replay migrations
supabase functions serve                             # local edge functions (use http://kong:8000 internally)
supabase functions deploy qonto-oauth qonto-terminal # deploy (staging first, then prod)
supabase gen types typescript --local > src/app/types/supabase.types.ts

# Android (kiosk APK loads the hosted site — no APK rebuild needed for this feature)
npm run android:sync
```

---

## Architecture

### Trust model — the one non-negotiable

Qonto OAuth tokens (and the client secret) never reach the browser or the APK. Everything that talks to Qonto lives in **edge functions** using the service role. The kiosk (anonymous client) only ever calls our edge functions with an `order_id`; the **amount pushed to the terminal is read server-side from the order row**, never from the client payload. The precedent is `confirm-payment/index.ts` (service-role function that flips orders to `paid`).

### Data model (migration, ask-first — approved by this spec once reviewed)

```sql
-- 1. Qonto connection: one per vendor, tokens server-side only
create table vendor_qonto_connections (
  vendor_id uuid primary key references vendors(id) on delete cascade,
  organization_id text,
  access_token text not null,           -- ~1h lifetime
  access_token_expires_at timestamptz not null,
  refresh_token text not null,          -- 90d, ONE-TIME USE
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table vendor_qonto_connections enable row level security;
-- NO policies: service-role only. Neither anon nor authenticated may read tokens.

-- 2. Vendor settings (per-vendor terminal binding — Resolved Decision #1)
alter table vendors
  add column kiosk_terminal_enabled boolean not null default false,
  add column kiosk_terminal_id text,          -- Qonto terminal UUID
  add column kiosk_terminal_label text;       -- poi_id / human label shown in admin

-- 3. Order ↔ terminal payment reconciliation
alter table orders
  add column terminal_payment_id text,        -- Qonto terminal_payment UUID
  add column terminal_payment_method text,    -- visa, cartebancaire…
  add column terminal_card_summary text;      -- last 4 digits, for the ticket/receipt
```

RLS notes:
- `vendors.kiosk_terminal_enabled` must be readable by the **anon storefront role** (the kiosk decides its flow from it). `kiosk_terminal_id` is *not* needed client-side — the edge function reads it — but it sits on `vendors`; verify what the Phase-2 RLS lockdown exposes on the vendors anon-read policy and, if it's column-safe, leave it (a terminal UUID is not a secret; it is unusable without tokens).
- `orders.terminal_*` columns are written only by the edge function (service role).
- After the migration: regenerate `src/app/types/supabase.types.ts`.

### Edge functions (2 new)

**`qonto-oauth`** — admin-authenticated (JWT). Actions:
| Action | Behavior |
|---|---|
| `authorize-url` | Returns the Qonto authorize URL: `client_id`, `redirect_uri` (registered admin route `/admin/qonto/callback`), `scope=terminal.read terminal.write offline_access organization.read`, `state` = signed nonce binding the vendor_id (CSRF) |
| `exchange` | Verifies `state`, exchanges `code` at the token endpoint (client_secret lives here), upserts `vendor_qonto_connections`, returns `{connected: true, organization_id}` — never the tokens |
| `status` | `{connected, connected_at, organization_id}` for the admin UI |
| `disconnect` | Deletes the connection row (and best-effort revokes the consent) |

**`qonto-terminal`** — actions:
| Action | Caller | Behavior |
|---|---|---|
| `list-terminals` | Admin (JWT) | Proxies `GET /v2/terminals` with the vendor's token → `[{id, poi_id}]` for the terminal dropdown |
| `create-payment` | Kiosk (anon) | Input `{orderId}`. Loads the order (must belong to a vendor with `kiosk_terminal_enabled`, status `initiated`, not already authorized). **Amount = order total from DB.** Pushes `POST /v2/terminals/{kiosk_terminal_id}/payment` with a fresh UUID idempotency key and `metadata: {order_id, vendor_slug, attempt}`. Stores `terminal_payment_id` on the order. Returns `{paymentId}` |
| `get-payment` | Kiosk (anon) | Input `{orderId, paymentId}`. Proxies the status endpoint. On `AUTHORIZED`: **server-side** updates the order → status `todo`, `payAtCheckout=false`, records `terminal_payment_method`, `terminal_card_summary`. On `REFUSED`: returns `{status: 'REFUSED', failureReason}`. Response is what the kiosk trusts — the client never self-declares success |
| `cancel-order` | Kiosk (anon) | Input `{orderId}`. Only for orders still `initiated` with an unauthorized/refused payment: sets status `cancelled` (stock release must follow the existing cancelled-order path — verify, see Open Questions #2) |

Shared plumbing inside the functions:
- **Token refresh** with serialization: `select … for update` on the connection row before refreshing; on success persist the **new** access+refresh pair atomically (one-time-use refresh tokens make a lost update fatal — the vendor would have to reconnect).
- Env vars (Supabase secrets, staging first): `QONTO_CLIENT_ID`, `QONTO_CLIENT_SECRET`, `QONTO_OAUTH_BASE_URL`, `QONTO_API_BASE_URL`, `QONTO_STAGING_TOKEN` (sandbox only), `QONTO_MOCK` (see Testing). `LOCALLY` toggle pattern as in `stuart-delivery/index.ts:83-87`.
- CORS headers inlined per function, matching `confirm-payment/index.ts:22-28`.

### Frontend

```
src/app/
├── services/
│   └── qonto-terminal.service.ts        → NEW — invokes qonto-terminal edge fn; exposes
│                                          startPayment(orderId) → Observable<TerminalPaymentState>
│                                          (create + poll 1s → backoff 2s, hard stop 120s)
├── components/kiosk/
│   └── terminal-payment-dialog/         → NEW — full-screen MatDialog, disableClose: true
│       ├── state: pushing → waiting-card → success | refused | timeout
│       └── actions: Réessayer (new create-payment on same order) · Annuler (cancel-order)
├── components/restaurant-info-admin/children/paiement/
│   └── (extended)                       → "Terminal de paiement (Qonto)" section:
│                                          Connecter/Déconnecter, statut, terminal dropdown,
│                                          activation toggle
├── components/admin/qonto-callback/     → NEW — OAuth redirect landing: reads ?code&state,
│                                          invokes qonto-oauth/exchange, routes back to Paiement
└── services/checkout.service.ts         → MODIFIED — the only touched checkout code (see below)
```

**Checkout flow change** — surgical, at the existing insertion point `checkout.service.ts:406-427`:

```
payAtCheckout branch (kiosk):
  const useTerminal = kioskMode.active() && vendor.kiosk_terminal_enabled;
  create order via create_full_order RPC
      status: useTerminal ? 'initiated' : 'todo'     // today: always 'todo' on kiosk
  if (!useTerminal):                                  // ← EXACT current behavior, untouched
      printKioskOrderTicket(order); clearCart(); navigate successPayment
  else:
      open TerminalPaymentDialog(order)
      on AUTHORIZED (confirmed by get-payment server-side):
          printKioskOrderTicket(order)               // fire-and-forget, as today
          clearCart(); reset dining preference; navigate successPayment
      on REFUSED / timeout:
          dialog shows error + failure reason (French) + [Réessayer] [Annuler]
          Réessayer → qonto-terminal/create-payment again (new idempotency key, same order)
          Annuler   → qonto-terminal/cancel-order → close dialog → CART IS KEPT → back to cart
```

Kiosk-mode interplay (all existing behavior, verified in code):
- The idle timer re-arms while any MatDialog is open (`kiosk-mode.service.ts:169-172`, `:178-190`) — the payment dialog therefore blocks idle reset, honoring FR4's "never abandon a session silently mid-payment". The dialog itself owns the 120s payment timeout.
- If the customer walks away on the error screen, the idle countdown eventually fires **after the dialog closes on timeout**: closing the dialog on timeout calls `cancel-order` first, so the abandoned order is cancelled, then the normal idle reset clears the cart.
- The order-number confirmation screen (`payment-success.component.ts:40-46`) is reused as-is; copy switches from "Payez au comptoir" to "Paiement accepté" when the order was terminal-paid.

**Order status flow with terminal ON:** `initiated → todo` (set server-side on AUTHORIZED) `→ ongoing → done → picked`; abandoned: `initiated → cancelled`. With terminal OFF nothing changes (`todo` at creation).

### Admin settings (copy the `online_payments_enabled` pattern end-to-end)

DB column → `supabase.types.ts` → select list + writer in `supabase-auth.service.ts` (new `updateVendorKioskTerminal…`, modeled on `:463-480`) → facade in `vendor.service.ts` (`saveRestaurantInfo` options, `:621-634`) → UI in `paiement.component.ts` → runtime check in `checkout.service.ts`.

UI rules:
- Toggle is **disabled** until a Qonto connection exists *and* a terminal is selected; helper text explains why.
- Toggle is disabled with an explanatory message when the vendor currency is not EUR (Qonto terminals are EUR-only).
- Disconnecting Qonto force-disables the toggle (server-side too: `create-payment` re-checks the connection).

---

## Code Style

Existing conventions apply unchanged (see `SPEC.md` Code Style): standalone components, `inject()`, OnPush, signals for view state, `@if/@for`, M3 tokens only, French copy, ≥64px kiosk touch targets, two-space indent, single quotes, no `any`.

Example of the polling service surface:

```typescript
export type TerminalPaymentState =
  | { phase: 'pushing' }
  | { phase: 'waiting-card'; paymentId: string }
  | { phase: 'authorized'; paymentId: string }
  | { phase: 'refused'; paymentId: string; failureReason: string | null }
  | { phase: 'timeout' };

@Injectable({ providedIn: 'root' })
export class QontoTerminalService {
  private readonly supabase = inject(SupabaseService);

  startPayment(orderId: string): Observable<TerminalPaymentState> {
    // create-payment, then poll get-payment: 1s × 10, then 2s, hard stop at 120s.
    // Emits each phase; completes on authorized/refused/timeout.
  }
}
```

Edge functions follow the existing Deno style: single `index.ts`, action-dispatch on the request body, inlined CORS, `Deno.env.get` with the `LOCALLY` pattern, French user-facing error strings passed back to the client.

---

## Testing Strategy

**Never against real Qonto in CI.** Three layers:

1. **Playwright e2e (primary)** — `e2e/journeys/kiosk-terminal.spec.ts`, kiosk-landscape project, edge-function responses stubbed at the network layer (route interception on `/functions/v1/qonto-terminal`):
   - Toggle OFF → the existing `kiosk.spec.ts:184-235` journey passes **unchanged** (regression gate: order goes straight to print/confirmation, zero qonto calls).
   - Toggle ON, authorized → dialog shows waiting state → success → order-number screen; assert the print path was reached *after* authorization, never before.
   - Toggle ON, refused → error screen with French message + Réessayer + Annuler; retry → authorized → success.
   - Toggle ON, timeout (no outcome) → timeout state at 120s (clock-mocked) → cancel-order fired → cart still populated.
   - Abandon → Annuler → back at cart, cart intact, order cancelled.
2. **Unit (Karma)** — `QontoTerminalService` polling/backoff/timeout with `fakeAsync`; `checkout.service` branch selection (`useTerminal` truth table: kiosk × toggle × connection). Baseline has 5 known unrelated failures; run new specs with `--include` if needed.
3. **Edge function tests + sandbox** — `QONTO_MOCK=true` makes `qonto-terminal` simulate Qonto (authorize after N polls, or refuse via magic amounts, e.g. cents `.13` → REFUSED) so local/staging work end-to-end with no Qonto account. Once Developer Portal credentials exist: manual run against the sandbox (`X-Qonto-Staging-Token`) on staging, then a real-terminal smoke test in prod behind the per-vendor toggle.

Amount-integrity test (unit, edge function): `create-payment` ignores any client-supplied amount and reads the order total from DB.

---

## Boundaries

### Always do
- Compute the terminal amount **server-side from the order row**; treat every client payload as untrusted.
- Send a fresh UUID `X-Qonto-Idempotency-Key` per payment attempt; reuse the same key only when retrying the *same* attempt after a network error.
- Serialize token refresh (`for update` row lock) and persist the new refresh token atomically.
- Keep the toggle-OFF path byte-for-byte identical to today's kiosk flow.
- French customer-facing copy; ≥64px touch targets in the payment dialog.
- Run `npm run build` and the kiosk e2e project before committing.
- Deploy migrations + functions to **staging first** (Coolify/staging Supabase), prod second.

### Ask first
- The migration above (one-time approval on spec review), and any schema change beyond it.
- Registering the OAuth app on the Qonto Developer Portal (needs the owner's Qonto/business context).
- Setting production Supabase secrets (`QONTO_CLIENT_SECRET` etc.).
- Touching Stripe/PayGreen code, `create_full_order`, or the RLS policies from the Phase-2 lockdown.
- Adding any npm dependency.

### Never do
- Ship Qonto tokens, `client_secret`, or the staging token to the browser/APK, commit them, or expose them via an RLS policy.
- Trust a client-declared payment success — order status changes only on a server-side Qonto status read.
- Print the ticket or set the order to `todo` before `AUTHORIZED` when the terminal is active.
- Route a kiosk order through Stripe/PayGreen (still FR4a law).
- Let e2e/CI touch real Qonto endpoints.
- Auto-enable the feature for any vendor: default is OFF, forever opt-in.

---

## Success Criteria

1. **Toggle OFF (default):** kiosk flow is unchanged — order created as `todo`, ticket prints immediately, confirmation screen shows "Payez au comptoir". Existing kiosk e2e passes without modification.
2. **Toggle ON, happy path:** validating a kiosk order pushes the exact order total (EUR) to the vendor's selected terminal; the kiosk shows a full-screen "Présentez votre carte" state; on issuer approval the order flips to `todo` server-side, the ticket prints, and the order-number screen shows — in that order.
3. **Refusal:** a refused card shows a full-screen French error (with Qonto's `failure_reason` when available) and a **Réessayer** button that pushes a new payment for the same order; no ticket, order stays `initiated`.
4. **Timeout:** no outcome within 120s → same error surface as refusal; the abandoned order ends `cancelled` and the cart is preserved.
5. **Abandon:** Annuler cancels the order (stock released), keeps the cart, and returns to it.
6. **No phantom orders:** an order that never reached `AUTHORIZED` never appears as `todo` on the vendor order board and never prints.
7. **Connection flow:** admin connects Qonto via OAuth from the Paiement page, sees connection status, picks a terminal from the live list, and can disconnect; tokens are never visible in any client payload (verified in devtools/network).
8. **Amount integrity:** tampering with the client request cannot change the charged amount (edge function unit test).
9. **Token refresh:** a connection older than 1h still processes payments (refresh works); two concurrent payments don't corrupt the refresh token.
10. **Settings safety:** toggle cannot be enabled without a connection + selected terminal + EUR currency.
11. **Build & regression:** `npm run build` clean; non-kiosk storefront and Stripe/PayGreen flows byte-for-byte untouched.

---

## Implementation Phases

Task breakdown goes to `tasks/plan.md` / `tasks/todo.md` after spec approval. Proposed sequence — each phase ships independently behind the OFF-by-default toggle:

| Phase | Content | Gate |
|---|---|---|
| **1** | Migration (3 parts) + regenerate types + RLS verification against the lockdown | `supabase db reset` green locally; anon can read `kiosk_terminal_enabled`, cannot read connections |
| **2** | `qonto-oauth` + `qonto-terminal` edge functions with `QONTO_MOCK` mode | Functions pass local curl tests incl. amount-integrity and refused/authorized mock paths |
| **3** | Admin Paiement section: connect/disconnect, terminal dropdown, toggle (+ callback route) | Manual walkthrough on staging with mock mode |
| **4** | `QontoTerminalService` + `TerminalPaymentDialog` + `checkout.service.ts` gating | Kiosk e2e: authorized, refused→retry, timeout, abandon — all green with stubs |
| **5** | Hardening: token-refresh serialization test, cancelled-order stock release verification, copy pass | Success criteria 4, 5, 6, 9 verified |
| **6** | Qonto Developer Portal registration → sandbox validation on staging → real-terminal smoke test in prod (one pilot vendor) | A real card payment on a real terminal prints a real ticket |

Phases 1–5 need no Qonto account at all (mock mode) — Phase 6 is the only externally-blocked step.

---

## Resolved Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Terminal↔kiosk binding | **Per-vendor** in admin settings (`vendors.kiosk_terminal_id`); all kiosks of a vendor share one terminal. Revisit per-device binding (à la printer settings) only if a vendor actually runs multiple kiosks with multiple terminals |
| 2 | Payment outcome signal | **Polling** via `qonto-terminal/get-payment` (1s → 2s backoff, 120s hard stop). The `v1/terminal-payments` webhook is a later hardening option, not v1 |
| 3 | Failure/abandon | **Cancel order, keep cart.** Retry re-pushes on the same order; abandonment cancels the order and releases stock; the cart survives so the customer/staff can retry. No pay-at-counter fallback button in v1 (vendor can disable the toggle instead) |
| 4 | Qonto access | **Sandbox-first.** No credentials exist yet; everything is built against `QONTO_MOCK` + the sandbox, with Developer Portal registration as the final phase |

---

## Open Questions

1. **Qonto Developer Portal access** — registering the OAuth app requires a Qonto business account. Who owns it (Picki as a platform integrator, or the pilot vendor)? Qonto's model is "POS vendor" = platform, so likely a Picki-owned app serving all vendors — confirm before Phase 6.
2. ~~**Stock release on `cancelled`**~~ — RESOLVED during planning: release is the existing explicit SECURITY DEFINER RPC `restore_stock_for_order` (no trigger); `cancel-order` calls it after setting `cancelled`, mirroring `orders.service.ts:344,400`.
3. **Tips** — Qonto reports `tip_amount`/`authorized_amount` (may exceed the order total). v1 proposal: leave terminal tipping disabled/ignored, record `authorized_amount` for accounting only. Confirm.
4. **Receipt** — the card receipt is the terminal's business; our thermal ticket stays the kitchen/pickup ticket. Should the last-4 (`card_summary`) be printed on the ticket? v1 proposal: no.

*(None of these block Phases 1–5.)*

---

## As-built notes (2026-08-13)

Deviations from the letter of the spec, none from its intent:

- **Refresh serialization is a CAS, not a row lock.** `getValidAccessToken` rotates the one-time refresh token with `update … where refresh_token = <old>`; the loser of a concurrent refresh re-reads and adopts the winner's pair. Same lost-update guarantee, no extra SQL function. Concurrency is asserted by the test harness.
- **`list-terminals` lives in `qonto-terminal`** (admin-JWT-guarded action) rather than `qonto-oauth`, and deliberately goes through the token path even in mock mode so the refresh rotation is exercised end-to-end.
- **Terminal orders are created with `pay_at_checkout = false`** (they are paid before pickup); the kiosk confirmation screen recognizes them via `orders.terminal_payment_id` (`Order.terminalPaymentId`) and swaps the counter copy for "Paiement accepté".
- **E2E enables the toggle by rewriting the vendors REST response per page** instead of mutating the shared local db — the db toggle would race the parallel toggle-OFF kiosk journeys. The edge-function stub applies the real function's db writes so assertions read real rows.
- **Verification harness:** `scripts/test-qonto-functions.sh` (48 assertions, serves the functions itself with `QONTO_MOCK=true`), 35 Karma specs (`--include='**/qonto*' --include='**/vendor.service*' --include='**/checkout.service.qonto*' --include='**/terminal-payment-dialog*' --include='**/qonto-callback*'`), and `e2e/journeys/kiosk-terminal.spec.ts` (5 journeys on kiosk-landscape).
- **Still pending besides Phase 6:** an in-browser manual walkthrough of the admin Paiement section against locally served mock functions (the section's logic is spec-covered; the walkthrough needs `supabase functions serve` + an admin login).
