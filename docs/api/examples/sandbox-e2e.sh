#!/usr/bin/env bash
# Sandbox E2E for the Delivered (/api/v1). Run against a dev server:
#   BASE=http://localhost:3457 ADMIN_SECRET=$CRON_SECRET bash docs/api/examples/sandbox-e2e.sh
# Creates one test tenant (api-e2e@ghostforge-e2e.test) and exercises every
# sandbox endpoint + error code. Requires: curl, jq.
set -u

BASE="${BASE:-http://localhost:3000}"
ADMIN_SECRET="${ADMIN_SECRET:?set ADMIN_SECRET (ADMIN_API_SECRET/CRON_SECRET)}"
EMAIL="${E2E_EMAIL:-api-e2e@ghostforge-e2e.test}"

PASS=0
FAIL=0
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
pass() { echo "  ✓ $1"; PASS=$((PASS+1)); }
check() { # check <desc> <actual> <expected>
  if [ "$2" = "$3" ]; then pass "$1"; else fail "$1 (got: $2, want: $3)"; fi
}

echo "== 0. Admin: create tenant =="
CREATE=$(curl -s -X POST "$BASE/api/admin/api-tenants" \
  -H "x-api-secret: $ADMIN_SECRET" -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"name\": \"E2E\"}")
KEY=$(echo "$CREATE" | jq -r '.initialKey // empty')
TENANT=$(echo "$CREATE" | jq -r '.tenant.id // empty')
if [ -z "$TENANT" ]; then fail "tenant create ($CREATE)"; exit 1; fi
pass "tenant $TENANT"
if [ -z "$KEY" ]; then
  # Tenant existed from a previous run - mint a fresh test key.
  KEY=$(curl -s -X POST "$BASE/api/admin/api-tenants/$TENANT/keys" \
    -H "x-api-secret: $ADMIN_SECRET" -H "Content-Type: application/json" \
    -d '{"mode":"test","name":"e2e"}' | jq -r '.key')
fi
[ -n "$KEY" ] && pass "have test key ${KEY:0:18}…" || { fail "no key"; exit 1; }
AUTH="Authorization: Bearer $KEY"

echo "== 1. Numbers =="
FROM=$(curl -s "$BASE/api/v1/numbers" -H "$AUTH" | jq -r '.data[0].phone_number // empty')
[ -n "$FROM" ] && pass "sandbox number $FROM" || fail "no sandbox number"
AVAIL=$(curl -s "$BASE/api/v1/numbers/available?area_code=415" -H "$AUTH")
check "available count" "$(echo "$AVAIL" | jq '.data | length')" "5"
BUY=$(echo "$AVAIL" | jq -r '.data[0].phone_number')
BOUGHT=$(curl -s -X POST "$BASE/api/v1/numbers" -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"phone_number\": \"$BUY\"}")
BUY_STATUS=$(echo "$BOUGHT" | jq -r '.status // .error.code')
[ "$BUY_STATUS" = "active" ] || [ "$BUY_STATUS" = "invalid_request" ] && pass "purchase ($BUY_STATUS)" || fail "purchase ($BOUGHT)"
if [ "$BUY_STATUS" = "active" ]; then
  REL=$(curl -s -X DELETE "$BASE/api/v1/numbers/$(echo $BUY | sed 's/+/%2B/')" -H "$AUTH")
  check "release" "$(echo "$REL" | jq -r '.status')" "released"
fi

echo "== 2. Messages: happy path =="
SEND=$(curl -s -X POST "$BASE/api/v1/messages" -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"from\": \"$FROM\", \"to\": \"+15005550006\", \"body\": \"E2E hello\"}")
MSG_ID=$(echo "$SEND" | jq -r '.id // empty')
[ -n "$MSG_ID" ] && pass "sent $MSG_ID" || fail "send ($SEND)"
check "status sent" "$(echo "$SEND" | jq -r '.status')" "sent"
check "test flag" "$(echo "$SEND" | jq -r '.test')" "true"
GOT=$(curl -s "$BASE/api/v1/messages/$MSG_ID" -H "$AUTH")
check "get by id" "$(echo "$GOT" | jq -r '.id')" "$MSG_ID"
LIST=$(curl -s "$BASE/api/v1/messages?limit=5" -H "$AUTH")
[ "$(echo "$LIST" | jq '.data | length')" -ge 1 ] && pass "list has data" || fail "list empty"

echo "== 3. Magic numbers =="
FAILED=$(curl -s -X POST "$BASE/api/v1/messages" -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"from\": \"$FROM\", \"to\": \"+15005550002\", \"body\": \"should fail\"}")
check "magic fail" "$(echo "$FAILED" | jq -r '.status')" "failed"
QUEUED=$(curl -s -X POST "$BASE/api/v1/messages" -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"from\": \"$FROM\", \"to\": \"+15005550001\", \"body\": \"stuck\"}")
check "magic queued" "$(echo "$QUEUED" | jq -r '.status')" "queued"

echo "== 4. Idempotency =="
IDEM="e2e-$(date +%s)"
FIRST=$(curl -s -X POST "$BASE/api/v1/messages" -H "$AUTH" -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEM" \
  -d "{\"from\": \"$FROM\", \"to\": \"+15005550006\", \"body\": \"idem\"}")
REPLAY=$(curl -s -X POST "$BASE/api/v1/messages" -H "$AUTH" -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEM" \
  -d "{\"from\": \"$FROM\", \"to\": \"+15005550006\", \"body\": \"idem\"}")
check "replay same id" "$(echo "$REPLAY" | jq -r '.id')" "$(echo "$FIRST" | jq -r '.id')"
CONFLICT=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/messages" -H "$AUTH" \
  -H "Content-Type: application/json" -H "Idempotency-Key: $IDEM" \
  -d "{\"from\": \"$FROM\", \"to\": \"+15005550006\", \"body\": \"DIFFERENT\"}")
check "conflict 409" "$CONFLICT" "409"

echo "== 5. Inbound + events =="
INB=$(curl -s -X POST "$BASE/api/v1/test/inbound" -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"to\": \"$FROM\", \"from\": \"+14155550132\", \"body\": \"reply!\"}")
check "inbound received" "$(echo "$INB" | jq -r '.status')" "received"
EVENTS=$(curl -s "$BASE/api/v1/events?limit=20" -H "$AUTH")
for TYPE in message.sent message.delivered message.failed message.received; do
  COUNT=$(echo "$EVENTS" | jq "[.data[] | select(.type == \"$TYPE\")] | length")
  [ "$COUNT" -ge 1 ] && pass "event $TYPE" || fail "event $TYPE missing"
done

echo "== 6. Lookup =="
LOOK=$(curl -s "$BASE/api/v1/lookup/%2B14155550132" -H "$AUTH")
check "lookup valid" "$(echo "$LOOK" | jq -r '.valid')" "true"
SPAM=$(curl -s "$BASE/api/v1/lookup/%2B14155550199/spam" -H "$AUTH")
[ "$(echo "$SPAM" | jq -r '.spam_score')" -gt 0 ] && pass "spam fixture scored" || fail "spam fixture ($SPAM)"

echo "== 7. Error codes =="
check "no auth 401"  "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/v1/messages")" "401"
check "bad key 401"  "$(curl -s -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer ghost_sk_test_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' "$BASE/api/v1/messages")" "401"
check "bad e164 400" "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/messages" -H "$AUTH" -H 'Content-Type: application/json' -d "{\"from\": \"$FROM\", \"to\": \"nope\", \"body\": \"x\"}")" "400"
check "from not owned 403" "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/messages" -H "$AUTH" -H 'Content-Type: application/json' -d '{"from": "+15005559999", "to": "+15005550006", "body": "x"}')" "403"
check "unknown msg 404" "$(curl -s -o /dev/null -w '%{http_code}' -H "$AUTH" "$BASE/api/v1/messages/msg_zzzzzzzzzzzzzzzz")" "404"

echo "== 8. Rate limit (60/min) =="
# The limiter uses a fixed 60s window. One curl process per request is slow
# enough that a 70-request loop can straddle a window boundary and never
# accumulate 60 in either half - so hammer well past the limit (130) to stay
# deterministic on a cold server.
CODE=200
for i in $(seq 1 130); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -H "$AUTH" "$BASE/api/v1/numbers")
  [ "$CODE" = "429" ] && break
done
check "eventually 429" "$CODE" "429"

echo ""
echo "PASS: $PASS  FAIL: $FAIL"
[ "$FAIL" = "0" ]
