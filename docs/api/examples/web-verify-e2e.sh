#!/usr/bin/env bash
#
# Delivered Verify on the CONSUMER web app - end-to-end check.
#
# Exercises /api/opensms-verify/send + /api/opensms-verify/check, the first-party
# routes PhoneVerificationModal calls. The point of this script is the routing
# contract: which failures tell the client to fall back to the old Twilio route
# (`fallback: true`) and which are deliberate blocks it must NOT route around
# (`fallback: false`).
#
#   BASE=http://localhost:3007 ./docs/api/examples/web-verify-e2e.sh
#
# A live send is opt-in, because it costs money and texts a real handset:
#   LIVE_TO=+18132142204 BASE=... ./docs/api/examples/web-verify-e2e.sh
#
set -uo pipefail

BASE="${BASE:-http://localhost:3000}"
PASS=0
FAIL=0

check() { # name expected_status actual_status body grep_pattern
  local name="$1" want="$2" got="$3" body="$4" pattern="${5:-}"
  if [ "$got" = "$want" ] && { [ -z "$pattern" ] || grep -q "$pattern" <<<"$body"; }; then
    printf '  \033[32mPASS\033[0m %s\n' "$name"; PASS=$((PASS + 1))
  else
    printf '  \033[31mFAIL\033[0m %s (want %s, got %s)\n       %s\n' "$name" "$want" "$got" "$body"
    FAIL=$((FAIL + 1))
  fi
}

post() { # path json -> sets STATUS and BODY
  local out
  out=$(curl -s -w '\n%{http_code}' "$BASE$1" -X POST \
    -H 'Content-Type: application/json' -d "$2")
  STATUS="${out##*$'\n'}"
  BODY="${out%$'\n'*}"
}

echo "Delivered Verify (web app) → $BASE"
echo

echo "Routing contract"
post /api/opensms-verify/send '{}'
check "missing phone rejected" 400 "$STATUS" "$BODY"

post /api/opensms-verify/send '{"phoneNumber":"+447700900123"}'
check "international falls back" 409 "$STATUS" "$BODY" '"fallback":true'

# Caribbean NANP looks domestic to every other validator in the repo and is the
# classic SMS-pumping destination, so Delivered Verify declines it - but a real
# consumer there still needs to verify, so it must fall back, not hard-block.
post /api/opensms-verify/send '{"phoneNumber":"+18765551234"}'
check "Caribbean NANP falls back" 409 "$STATUS" "$BODY" '"fallback":true'

post /api/opensms-verify/check '{"phoneNumber":"+19995550000","code":"123456","userId":"qa_web_verify"}'
check "check with no send" 400 "$STATUS" "$BODY" 'expired'

post /api/opensms-verify/check '{"phoneNumber":"+19995550000","code":"123456"}'
check "check needs userId" 400 "$STATUS" "$BODY"

if [ -n "${LIVE_TO:-}" ]; then
  echo
  echo "Live send → $LIVE_TO"
  post /api/opensms-verify/send "{\"phoneNumber\":\"$LIVE_TO\"}"
  check "live send accepted" 200 "$STATUS" "$BODY" '"provider":"ghost"'

  # Immediately again: the per-destination cooldown is a policy decision, so it
  # must come back 429 with fallback:false. If this ever says true, the client
  # would retry on Twilio and we'd have paid to defeat our own rate limit.
  post /api/opensms-verify/send "{\"phoneNumber\":\"$LIVE_TO\"}"
  check "cooldown does NOT fall back" 429 "$STATUS" "$BODY" '"fallback":false'

  post /api/opensms-verify/check "{\"phoneNumber\":\"$LIVE_TO\",\"code\":\"000000\",\"userId\":\"qa_web_verify\"}"
  check "wrong code counts an attempt" 400 "$STATUS" "$BODY" 'attempts_remaining'

  echo
  echo "  Enter the code that arrived (or press enter to skip):"
  read -r CODE
  if [ -n "$CODE" ]; then
    post /api/opensms-verify/check "{\"phoneNumber\":\"$LIVE_TO\",\"code\":\"$CODE\",\"userId\":\"qa_web_verify\"}"
    check "correct code approves" 200 "$STATUS" "$BODY" '"verified":true'
    echo "  NOTE: remove users/qa_web_verify from RTDB when you're done."
  fi
fi

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
