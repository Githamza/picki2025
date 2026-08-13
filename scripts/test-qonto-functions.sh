#!/usr/bin/env bash
# Test harness for the qonto-terminal / qonto-oauth edge functions
# (SPEC-QONTO-TERMINAL.md T3-T6). Runs against the LOCAL stack only:
#
#   supabase start          # db + seed
#   scripts/test-qonto-functions.sh
#
# The script serves the functions itself with QONTO_MOCK=true (the in-process
# Qonto simulator: totals ending .13 refuse, .99 never resolve, anything else
# authorizes ~3s after creation). It creates throwaway orders directly in the
# local db and cleans up after itself. Never points at staging or production.
set -euo pipefail

FN_URL="http://127.0.0.1:54321/functions/v1"
REST_URL="http://127.0.0.1:54321/rest/v1"
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
# Well-known supabase-demo local JWTs (printed by `supabase status`; not secrets).
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

KIOSK_VENDOR="e2e00000-0000-4000-8000-000000000002"
TERMINAL_ID="e2e00000-0000-4000-8000-00000000t001"

PASS=0
FAIL=0
CLEANUP_ORDER_IDS=()
SERVE_PID=""

log()  { printf '%s\n' "$*"; }
ok()   { PASS=$((PASS + 1)); log "  ok: $*"; }
bad()  { FAIL=$((FAIL + 1)); log "  FAIL: $*"; }

assert_eq() { # actual expected label
  if [[ "$1" == "$2" ]]; then ok "$3"; else bad "$3 (expected '$2', got '$1')"; fi
}

sql() { psql "$DB_URL" -tA -c "$1"; }

fn() { # action body_json [key]  -> stdout: http_code + body separated by \n
  local body="$1" key="${2:-$ANON_KEY}"
  curl -s -w '\n%{http_code}' -X POST "$FN_URL/qonto-terminal" \
    -H "apikey: $key" -H "Authorization: Bearer $key" \
    -H "Content-Type: application/json" -d "$body"
}

json_field() { # json field  (empty output on non-JSON bodies)
  python3 -c "
import sys, json
try:
    print(json.loads(sys.argv[1]).get(sys.argv[2], ''))
except Exception:
    print('')" "$1" "$2"
}

create_order() { # total status -> order id on stdout
  local total="$1" status="$2"
  sql "insert into orders (order_number, customer_first_name, customer_last_name,
        customer_email, total_amount, status, order_type, vendor_id, pay_at_checkout)
       values ('QT-TEST-' || floor(random()*1000000)::text, 'Qonto', 'Test',
        'qonto-test@picki.test', $total, '$status', 'take-away', '$KIOSK_VENDOR', true)
       returning id;" | head -n 1
}

cleanup() {
  set +e
  for id in "${CLEANUP_ORDER_IDS[@]:-}"; do
    [[ -n "$id" ]] && sql "delete from orders where id = '$id';" > /dev/null
  done
  sql "update vendors set kiosk_terminal_enabled = false, kiosk_terminal_id = null,
       kiosk_terminal_label = null where id = '$KIOSK_VENDOR';" > /dev/null
  sql "delete from vendor_qonto_connections where vendor_id = '$KIOSK_VENDOR';" > /dev/null
  [[ -n "$SERVE_PID" ]] && kill "$SERVE_PID" 2> /dev/null && wait "$SERVE_PID" 2> /dev/null
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Serve the functions with the mock enabled
# ---------------------------------------------------------------------------
ENV_FILE="$(mktemp)"
cat > "$ENV_FILE" <<EOF
QONTO_MOCK=true
QONTO_API_BASE_URL=https://thirdparty-sandbox.staging.qonto.co
QONTO_OAUTH_BASE_URL=https://oauth.qonto.com
QONTO_CLIENT_ID=mock-client-id
QONTO_CLIENT_SECRET=mock-client-secret
QONTO_STATE_SECRET=mock-state-secret
EOF

log "Serving edge functions (QONTO_MOCK=true)..."
supabase functions serve --env-file "$ENV_FILE" > /tmp/qonto-fn-serve.log 2>&1 &
SERVE_PID=$!
for _ in $(seq 1 30); do
  # Probe a long-standing function: proves the runtime is up even while the
  # qonto functions are still being written (RED phase).
  code=$(curl -s -o /dev/null -w '%{http_code}' -X OPTIONS "$FN_URL/confirm-payment" || true)
  [[ "$code" == "200" ]] && break
  sleep 1
done
[[ "${code:-}" == "200" ]] || { log "functions never came up (see /tmp/qonto-fn-serve.log)"; exit 1; }

# Vendor setup: terminal enabled + bound
sql "update vendors set kiosk_terminal_enabled = true, kiosk_terminal_id = '$TERMINAL_ID',
     kiosk_terminal_label = 'S1F2-MOCK' where id = '$KIOSK_VENDOR';" > /dev/null

# ---------------------------------------------------------------------------
# T3 — create-payment
# ---------------------------------------------------------------------------
log "T3: create-payment"

ORDER=$(create_order 12.50 initiated); CLEANUP_ORDER_IDS+=("$ORDER")
RES=$(fn "{\"action\":\"create-payment\",\"orderId\":\"$ORDER\"}")
CODE=$(tail -n1 <<< "$RES"); BODY=$(sed '$d' <<< "$RES")
assert_eq "$CODE" "200" "happy path returns 200"
PAYMENT_ID=$(json_field "$BODY" paymentId)
[[ -n "$PAYMENT_ID" ]] && ok "returns a paymentId" || bad "no paymentId in: $BODY"
assert_eq "$(json_field "$BODY" amount)" "12.50" "amount computed from the order row"
assert_eq "$(sql "select terminal_payment_id from orders where id = '$ORDER';")" "$PAYMENT_ID" \
  "terminal_payment_id stored on the order"

# Client-supplied amount must be ignored
ORDER2=$(create_order 9.90 initiated); CLEANUP_ORDER_IDS+=("$ORDER2")
RES=$(fn "{\"action\":\"create-payment\",\"orderId\":\"$ORDER2\",\"amount\":{\"value\":\"0.01\",\"currency\":\"EUR\"}}")
BODY=$(sed '$d' <<< "$RES")
assert_eq "$(json_field "$BODY" amount)" "9.90" "client-supplied amount is ignored"

# Wrong status
ORDER3=$(create_order 5.00 todo); CLEANUP_ORDER_IDS+=("$ORDER3")
RES=$(fn "{\"action\":\"create-payment\",\"orderId\":\"$ORDER3\"}")
assert_eq "$(tail -n1 <<< "$RES")" "409" "non-initiated order is rejected (409)"

# Unknown order
RES=$(fn '{"action":"create-payment","orderId":"00000000-0000-4000-8000-000000000000"}')
assert_eq "$(tail -n1 <<< "$RES")" "404" "unknown order is rejected (404)"

# Toggle off
sql "update vendors set kiosk_terminal_enabled = false where id = '$KIOSK_VENDOR';" > /dev/null
ORDER4=$(create_order 5.00 initiated); CLEANUP_ORDER_IDS+=("$ORDER4")
RES=$(fn "{\"action\":\"create-payment\",\"orderId\":\"$ORDER4\"}")
assert_eq "$(tail -n1 <<< "$RES")" "403" "terminal-disabled vendor is rejected (403)"
sql "update vendors set kiosk_terminal_enabled = true where id = '$KIOSK_VENDOR';" > /dev/null

# ---------------------------------------------------------------------------
# T4 — get-payment
# ---------------------------------------------------------------------------
log "T4: get-payment"

poll_until_settled() { # orderId paymentId -> last body on stdout
  local body status
  for _ in $(seq 1 20); do
    local res
    res=$(fn "{\"action\":\"get-payment\",\"orderId\":\"$1\",\"paymentId\":\"$2\"}")
    body=$(sed '$d' <<< "$res")
    status=$(json_field "$body" status)
    [[ "$status" != "PENDING" && -n "$status" ]] && break
    sleep 0.5
  done
  printf '%s' "$body"
}

# Happy path: the T3 order (12.50) authorizes ~3s after creation.
BODY=$(poll_until_settled "$ORDER" "$PAYMENT_ID")
assert_eq "$(json_field "$BODY" status)" "AUTHORIZED" "payment authorizes"
assert_eq "$(sql "select status from orders where id = '$ORDER';")" "todo" \
  "order flips initiated -> todo on AUTHORIZED"
assert_eq "$(sql "select pay_at_checkout from orders where id = '$ORDER';")" "f" \
  "pay_at_checkout cleared on AUTHORIZED"
assert_eq "$(sql "select terminal_payment_method from orders where id = '$ORDER';")" \
  "cartebancaire" "payment method recorded"
assert_eq "$(sql "select terminal_card_summary from orders where id = '$ORDER';")" \
  "4242" "card summary recorded"

# Idempotent re-poll after success
RES=$(fn "{\"action\":\"get-payment\",\"orderId\":\"$ORDER\",\"paymentId\":\"$PAYMENT_ID\"}")
CODE=$(tail -n1 <<< "$RES"); BODY=$(sed '$d' <<< "$RES")
assert_eq "$CODE" "200" "re-poll after success returns 200"
assert_eq "$(json_field "$BODY" status)" "AUTHORIZED" "re-poll still AUTHORIZED"
assert_eq "$(sql "select status from orders where id = '$ORDER';")" "todo" \
  "re-poll does not re-update the order"

# Refused path: total ending .13 refuses ~2s in; order stays initiated.
ORDER_REFUSED=$(create_order 7.13 initiated); CLEANUP_ORDER_IDS+=("$ORDER_REFUSED")
RES=$(fn "{\"action\":\"create-payment\",\"orderId\":\"$ORDER_REFUSED\"}")
REFUSED_PAYMENT=$(json_field "$(sed '$d' <<< "$RES")" paymentId)
BODY=$(poll_until_settled "$ORDER_REFUSED" "$REFUSED_PAYMENT")
assert_eq "$(json_field "$BODY" status)" "REFUSED" "declined card reports REFUSED"
assert_eq "$(json_field "$BODY" failureReason)" "card_declined" "failure reason surfaced"
assert_eq "$(sql "select status from orders where id = '$ORDER_REFUSED';")" "initiated" \
  "refused order stays initiated"

# Mismatched order/payment pair
RES=$(fn "{\"action\":\"get-payment\",\"orderId\":\"$ORDER_REFUSED\",\"paymentId\":\"$PAYMENT_ID\"}")
assert_eq "$(tail -n1 <<< "$RES")" "409" "mismatched order/payment pair is rejected (409)"

# ---------------------------------------------------------------------------
log ""
log "Results: $PASS passed, $FAIL failed"
[[ "$FAIL" == "0" ]]
