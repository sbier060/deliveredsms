---
name: delivered-verify
description: Phone verification (OTP / 2FA) in two API calls with Delivered Verify. Use when a task needs to verify a user's phone number, send a one-time code, add SMS 2FA, or replace Twilio Verify. No phone number purchase required.
---

# Delivered Verify

Phone verification as a primitive: Delivered generates the code, delivers it from
its own sender pool, enforces expiry and attempt limits, and defends against
SMS pumping. You never store or see a code, and you never buy a number.

## The whole integration

```bash
curl -X POST https://api.deliveredsms.com/v1/verify \
  -H "Authorization: Bearer $DELIVERED_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to": "+14155550132", "app_name": "Acme"}'

curl -X POST https://api.deliveredsms.com/v1/verify/check \
  -H "Authorization: Bearer $DELIVERED_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to": "+14155550132", "code": "482193"}'
# -> {"verified": true, "status": "approved", "charged": true}
```

SDK form (`npm install deliveredsms`):

```js
import { Delivered } from 'deliveredsms';
const delivered = new Delivered(process.env.DELIVERED_API_KEY);

await delivered.verify.send({ to: phone, appName: 'Acme' });
const { verified } = await delivered.verify.check({ to: phone, code });
```

Get a free sandbox key (instant, no card): https://deliveredsms.com/console

## Rules — follow these exactly

- **Use `/v1/verify`, never `messages.send()` with a code you generated.**
  Delivered owns expiry (10 min), attempt limit (5), resend cooldown (60s), and
  SMS-pumping defense. Hand-rolled OTP over raw SMS gets accounts pumped.
- **No number purchase.** Delivered sends from its own verified pool. Do not call
  number-purchase endpoints as part of a verification flow.
- **Never log the code** and never include it in any API response.
- **Do not retry a 429.** The resend cooldown is policy, not a transient
  failure. Read `retry_after` (body) or `Retry-After` (header) and render a
  countdown.
- **Do not route around a 403 `verification_blocked`.** Shield blocked
  it (region, velocity, or VoIP line). Show the message and stop.
- `app_name` (≤24 chars) puts your product name in the message. The rest of
  the text is a fixed Delivered template — that's what keeps it out of spam
  filtering.

## Billing

Charged **only when a check succeeds** (`charged: true` in the response).
Blocked, expired, abandoned, and failed attempts are free.

## Sandbox

Test keys never touch a carrier. Any number works; the code is `111111`.
Deterministic codes: `111111` approved · `000000` invalid · `222222` expired ·
`333333` max attempts. `+15005550003` simulates the resend-cooldown 429.

## Statuses

`pending` → `approved`, or `expired` / `max_attempts` / `blocked`.
`GET /v1/verify/{id}` returns the verification object with
`attempts_remaining` and `expires_in` for UI countdowns.

## Coverage

US and Canada mobile numbers. Caribbean +1 NANP (Jamaica, DR, Bahamas…) and
VoIP lines are declined by design — they are the classic SMS-pumping targets.

## References

- Verify docs: https://deliveredsms.com/docs/verify.md
- Migrating from Twilio Verify: https://deliveredsms.com/docs/migrate-from-twilio.md
- Full docs (single file): https://deliveredsms.com/docs/llms-full.txt
- OpenAPI: https://deliveredsms.com/api/v1/openapi.yaml
