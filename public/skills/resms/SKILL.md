---
name: resms
description: Send and receive SMS, verify phone numbers with one-time codes, and provision US/Canada phone numbers through the Resms API. Use when a task needs to send a text message, get a phone number, or verify/look up a phone number.
---

# Resms

Resms is an SMS API for developers: two-way texting, on-demand phone numbers,
backed by the infrastructure of the consumer phone app.

## Setup

Official SDK (Node 18+, zero dependencies): `npm install resms`

```js
import { Resms } from 'resms';
const resms = new Resms(process.env.RESMS_API_KEY);
await resms.verify.send({ to: '+14155550132' });
const { verified } = await resms.verify.check({ to: '+14155550132', code });
```

Raw HTTP works too; everything below is the same API.

1. Get a free sandbox key (instant, no card): https://resms.com/console
2. Every request: `Authorization: Bearer ghost_sk_test_...`
3. Base URL: `https://api.resms.com/v1`

Test keys simulate everything (magic numbers: `+15005550006` delivers,
`+15005550002` fails, `+15005550001` sticks in queued). Live keys are enabled
after live-access review from the console.

## Send an SMS

```bash
curl -X POST https://api.resms.com/v1/messages \
  -H "Authorization: Bearer $RESMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from": "<your number>", "to": "+15005550006", "body": "Hello"}'
```

Your numbers: `GET /v1/numbers`. Response has `id` (msg_...) and `status`
(`queued|sent|delivered|failed`). Retries are safe with an `Idempotency-Key`
header.

## Phone verification (OTP): use the `resms-verify` skill

For OTP / 2FA / phone verification, use `POST /v1/verify` +
`POST /v1/verify/check`; never `messages.send()` with a code you generated.
No number purchase is needed; Resms sends from its own pool, and billing is
only on a successful check. Full rules, sandbox codes, and UI guidance live in
the dedicated skill:
https://resms.com/skills/resms-verify/SKILL.md

## Get a phone number

```bash
curl "https://api.resms.com/v1/numbers/available?area_code=415" -H "Authorization: Bearer $RESMS_API_KEY"
curl -X POST https://api.resms.com/v1/numbers -H "Authorization: Bearer $RESMS_API_KEY" \
  -H "Content-Type: application/json" -d '{"phone_number": "<from search>"}'
```

## Look up / screen a number

```bash
curl "https://api.resms.com/v1/lookup/+14155550132" -H "Authorization: Bearer $RESMS_API_KEY"        # carrier, line type
curl "https://api.resms.com/v1/lookup/+14155550132/spam" -H "Authorization: Bearer $RESMS_API_KEY"   # spam_score 0-100
```

Treat `spam_score >= 70` as confirmed spam.

## Inbound + events

- Simulate inbound in sandbox: `POST /v1/test/inbound {to, from, body}`
- Poll `GET /v1/events` for `message.sent|delivered|failed|received`.

## References

- Full docs (single file): https://resms.com/docs/llms-full.txt
- OpenAPI: https://resms.com/api/v1/openapi.yaml
- MCP server (same tools, tool-call form): https://resms.com/api/mcp
- Errors are always `{"error": {"code", "message"}}`; see https://resms.com/docs/errors.md
