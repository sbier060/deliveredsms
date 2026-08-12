#!/usr/bin/env bash
set -u
BASE=http://localhost:3457
W=/home/alek/ghost-checkout/.claude/worktrees/ghost-api-landing-page-739936
ADMIN=$(grep '^CRON_SECRET=' $W/.env.local | cut -d= -f2- | tr -d '"')
P=0; F=0
ck(){ if [ "$2" = "$3" ]; then echo "  ✓ $1"; P=$((P+1)); else echo "  ✗ $1 (got '$2' want '$3')"; F=$((F+1)); fi; }

TN=$(curl -s -X POST $BASE/api/admin/api-tenants -H "x-api-secret: $ADMIN" -H 'Content-Type: application/json' -d "{\"email\":\"verify-$(date +%s)@ghostforge-e2e.test\"}" | jq -r '.tenant.id')
TEST=$(curl -s -X POST $BASE/api/admin/api-tenants/$TN/keys -H "x-api-secret: $ADMIN" -H 'Content-Type: application/json' -d '{"mode":"test"}' | jq -r '.key')
A="Authorization: Bearer $TEST"
PH1="+15005551111"; PH2="+15005552222"; PH3="+15005553333"; PH4="+15005554444"
echo "tenant $TN"

echo "== send =="
S=$(curl -s -X POST $BASE/api/v1/verify -H "$A" -H 'Content-Type: application/json' -d "{\"phone\":\"$PH1\"}")
ck "send returns ver_ id" "$(echo "$S" | jq -r '.id' | cut -c1-4)" "ver_"
ck "status pending" "$(echo "$S" | jq -r '.status')" "pending"
ck "charged false on send" "$(echo "$S" | jq -r '.charged')" "false"
VID=$(echo "$S" | jq -r '.id')

echo "== resend cooldown (sandbox iterates freely; magic number tests the 429) =="
ck "sandbox resend allowed" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/v1/verify -H "$A" -H 'Content-Type: application/json' -d "{\"phone\":\"$PH1\"}")" "201"
ck "magic cooldown number -> 429" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/v1/verify -H "$A" -H 'Content-Type: application/json' -d '{"phone":"+15005550003"}')" "429"
ck "429 body carries retry_after" "$(curl -s -X POST $BASE/api/v1/verify -H "$A" -H 'Content-Type: application/json' -d '{"phone":"+15005550003"}' | jq -r '.error.retry_after')" "60"
ck "to alias works (Twilio compat)" "$(curl -s -X POST $BASE/api/v1/verify -H "$A" -H 'Content-Type: application/json' -d '{"to":"+15005557001"}' | jq -r '.status')" "pending"

echo "== check: wrong then right =="
W1=$(curl -s -X POST $BASE/api/v1/verify/check -H "$A" -H 'Content-Type: application/json' -d "{\"phone\":\"$PH1\",\"code\":\"999999\"}")
ck "wrong code not verified" "$(echo "$W1" | jq -r '.verified')" "false"
ck "attempts incremented" "$(echo "$W1" | jq -r '.attempts')" "1"
ck "wrong code not charged" "$(echo "$W1" | jq -r '.charged')" "false"
OK=$(curl -s -X POST $BASE/api/v1/verify/check -H "$A" -H 'Content-Type: application/json' -d "{\"phone\":\"$PH1\",\"code\":\"111111\"}")
ck "magic 111111 verifies" "$(echo "$OK" | jq -r '.verified')" "true"
ck "status approved" "$(echo "$OK" | jq -r '.status')" "approved"
ck "sandbox never charged" "$(echo "$OK" | jq -r '.charged')" "false"

echo "== reuse blocked =="
RE=$(curl -s -X POST $BASE/api/v1/verify/check -H "$A" -H 'Content-Type: application/json' -d "{\"phone\":\"$PH1\",\"code\":\"111111\"}")
ck "approved verification cannot be reused" "$(echo "$RE" | jq -r '.error.code // .verified')" "verification_not_found"

echo "== magic outcomes =="
curl -s -X POST $BASE/api/v1/verify -H "$A" -H 'Content-Type: application/json' -d "{\"phone\":\"$PH2\"}" >/dev/null
ck "222222 -> expired" "$(curl -s -X POST $BASE/api/v1/verify/check -H "$A" -H 'Content-Type: application/json' -d "{\"phone\":\"$PH2\",\"code\":\"222222\"}" | jq -r '.status')" "expired"
curl -s -X POST $BASE/api/v1/verify -H "$A" -H 'Content-Type: application/json' -d "{\"phone\":\"$PH3\"}" >/dev/null
ck "333333 -> max_attempts" "$(curl -s -X POST $BASE/api/v1/verify/check -H "$A" -H 'Content-Type: application/json' -d "{\"phone\":\"$PH3\",\"code\":\"333333\"}" | jq -r '.status')" "max_attempts"

echo "== attempt exhaustion (5 wrong) =="
curl -s -X POST $BASE/api/v1/verify -H "$A" -H 'Content-Type: application/json' -d "{\"phone\":\"$PH4\"}" >/dev/null
LAST=""
for i in 1 2 3 4 5; do LAST=$(curl -s -X POST $BASE/api/v1/verify/check -H "$A" -H 'Content-Type: application/json' -d "{\"phone\":\"$PH4\",\"code\":\"555555\"}"); done
ck "5th wrong attempt -> max_attempts" "$(echo "$LAST" | jq -r '.status')" "max_attempts"
ck "6th check -> not_found (cleared)" "$(curl -s -X POST $BASE/api/v1/verify/check -H "$A" -H 'Content-Type: application/json' -d "{\"phone\":\"$PH4\",\"code\":\"111111\"}" | jq -r '.error.code')" "verification_not_found"

echo "== retrieve + errors =="
ck "GET /v1/verify/:id" "$(curl -s $BASE/api/v1/verify/$VID -H "$A" | jq -r '.id')" "$VID"
ck "unknown id -> 404" "$(curl -s -o /dev/null -w '%{http_code}' $BASE/api/v1/verify/ver_zzzzzzzzzzzzzzzz -H "$A")" "404"
ck "check with no send -> not_found" "$(curl -s -X POST $BASE/api/v1/verify/check -H "$A" -H 'Content-Type: application/json' -d '{"phone":"+15005559999","code":"111111"}' | jq -r '.error.code')" "verification_not_found"
ck "bad phone -> 400" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/v1/verify -H "$A" -H 'Content-Type: application/json' -d '{"phone":"nope"}')" "400"
ck "no auth -> 401" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/v1/verify -H 'Content-Type: application/json' -d '{"phone":"+15005551234"}')" "401"

echo "== events emitted =="
EV=$(curl -s "$BASE/api/v1/events?limit=30" -H "$A")
ck "verification.sent" "$(echo "$EV" | jq '[.data[]|select(.type=="verification.sent")]|length>0')" "true"
ck "verification.approved" "$(echo "$EV" | jq '[.data[]|select(.type=="verification.approved")]|length>0')" "true"

echo; echo "PASS $P FAIL $F"
[ "$F" = "0" ]
