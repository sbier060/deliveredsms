/**
 * Docs content — markdown as the single source. Rendered as HTML pages
 * (DocsMarkdown), served raw at /docs/<slug>.md, and concatenated
 * into /docs/llms-full.txt for AI agents.
 */

import { pricingTableMarkdown, freeTierMarkdown } from '@/lib/api/pricing';

export interface DocsPage {
  slug: string;
  title: string;
  description: string;
  markdown: string;
}

export const DOCS_PAGES: DocsPage[] = [
  {
    slug: 'quickstart',
    title: 'Quickstart',
    description: 'Send your first SMS in under five minutes.',
    markdown: `# Quickstart

Send your first SMS in under five minutes. No card, no sales call — a test key
works instantly against the sandbox.

## 1. Get a key

Create a free account at [the console](/console). A sandbox tenant
is provisioned automatically with a test key (\`dsms_sk_test_...\`) and a
sandbox number. The key is shown once — copy it.

## 2. Send a message

\`\`\`bash
curl -X POST https://api.deliveredsms.com/v1/messages \\
  -H "Authorization: Bearer dsms_sk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "+15005550100",
    "to": "+15005550006",
    "body": "Hello from Delivered"
  }'
\`\`\`

Replace \`from\` with your sandbox number (shown in the console). \`+15005550006\`
is a magic sandbox number that simulates successful delivery.

## 3. Read the response

\`\`\`json
{
  "id": "msg_a1B2c3D4e5F6g7H8",
  "object": "message",
  "to": "+15005550006",
  "from": "+15005550100",
  "body": "Hello from Delivered",
  "direction": "outbound",
  "status": "sent",
  "test": true,
  "created_at": "2026-08-06T16:20:00.000Z"
}
\`\`\`

Fetch it back anytime with \`GET /v1/messages/{id}\`, and watch the delivery
lifecycle in \`GET /v1/events\` — a \`message.delivered\` event follows ~2s later.

## 4. Simulate a reply

\`\`\`bash
curl -X POST https://api.deliveredsms.com/v1/test/inbound \\
  -H "Authorization: Bearer dsms_sk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+15005550100",
    "from": "+14155550132",
    "body": "Hey, got your message!"
  }'
\`\`\`

The inbound message lands in \`GET /v1/messages\` and emits a
\`message.received\` event — exactly what a real inbound SMS will do in live
mode.

## 5. Receive events (webhooks)

Instead of polling, add an endpoint URL under
[Webhooks in the console](/console/webhooks) and every event is POSTed to
you, signed, with automatic retries. Details in the
[webhooks docs](/docs/webhooks).

## 6. Go live

When you're ready to send real SMS from real numbers, request live access from
the [console](/console) — one sentence about what you're building,
and we usually flip the switch same day. Live access is free during early
access.
`,
  },
  {
    slug: 'authentication',
    title: 'Authentication',
    description: 'API keys, test vs live mode, and key rotation.',
    markdown: `# Authentication

Every request is authenticated with an API key in the \`Authorization\` header:

\`\`\`bash
Authorization: Bearer dsms_sk_test_...
\`\`\`

## Test and live keys

| Prefix | Mode | Behavior |
| --- | --- | --- |
| \`dsms_sk_test_\` | Sandbox | Instant, free, simulated delivery — no real SMS ever leaves the sandbox. |
| \`dsms_sk_live_\` | Live | Real numbers and real delivery. Mintable once your account has live access. |

\`ghost_sk_test_\` and \`ghost_sk_live_\` are legacy prefixes from the Ghost era.
They are still accepted and will not be revoked, but new keys mint as \`dsms_\`.

Keys never expire, but you can roll or revoke them anytime from the
[console](/console/keys). Rolling revokes the old key immediately
and mints a replacement.

## Storage

Keys are stored hashed (SHA-256) — we can never display a key again after
minting it. If you lose one, roll it.

## Errors

| Status | Code | Meaning |
| --- | --- | --- |
| 401 | \`invalid_api_key\` | Missing, malformed, revoked, or unknown key. |
| 403 | \`live_access_required\` | Live key used before live access was granted, or a live-only endpoint hit with a test key. |
| 403 | \`tenant_suspended\` | The account is suspended. |
`,
  },
  {
    slug: 'sandbox',
    title: 'Sandbox & test numbers',
    description: 'How test mode works, including magic numbers.',
    markdown: `# Sandbox & test numbers

Test keys (\`dsms_sk_test_\`) run against a fully simulated environment: no
carrier traffic, no charges, and nothing real ever sent. Every endpoint works,
so you can build your whole integration — including webhooks — before going
live.

## Your sandbox number

Signup provisions a sandbox number in the reserved \`+1 500-555-XXXX\` range.
It's the \`from\` for outbound tests and the \`to\` for simulated inbound. You can
"purchase" more from \`GET /v1/numbers/available\` + \`POST /v1/numbers\` — the
whole numbers API works in the sandbox.

## Magic destination numbers

Send **to** these numbers to trigger fixed behaviors:

| Number | Behavior |
| --- | --- |
| \`+15005550006\` | Delivered: status \`sent\`, then a \`message.delivered\` event ~2s later. Any other number behaves the same. |
| \`+15005550001\` | Stuck: status stays \`queued\` forever, no delivery event. |
| \`+15005550002\` | Failed: status \`failed\` and a \`message.failed\` event with code \`undeliverable\`. |

## Simulated inbound

\`POST /v1/test/inbound\` delivers a fake inbound SMS to one of your sandbox
numbers through the real pipeline: it appears in \`GET /v1/messages\` and emits
a \`message.received\` event. (Test keys only — live keys get a 403
\`test_mode_only\`.)

## Sandbox limits

A ceiling of 1,000 messages/day per account keeps the sandbox healthy. It's
not a product quota — if you legitimately hit it, tell us.
`,
  },
  {
    slug: 'messages',
    title: 'Messages',
    description: 'Send SMS, retrieve messages, and list history.',
    markdown: `# Messages

## Send a message

\`POST /v1/messages\`

\`\`\`bash
curl -X POST https://api.deliveredsms.com/v1/messages \\
  -H "Authorization: Bearer dsms_sk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "from": "+15005550100", "to": "+15005550006", "body": "Hello" }'
\`\`\`

| Parameter | Type | Notes |
| --- | --- | --- |
| \`from\` | string | A number you own (E.164). |
| \`to\` | string | Destination number (E.164, US/Canada). |
| \`body\` | string | Up to 1600 characters. |

Returns \`201\` with a Message object. \`status\` starts at \`sent\` (or \`queued\`)
and progresses via events.

### Idempotency

Pass an \`Idempotency-Key\` header to make retries safe: the same key + same
payload replays the original response; the same key with a different payload
returns \`409 idempotency_conflict\`. Records are kept for 24 hours.

## Retrieve a message

\`GET /v1/messages/{id}\` — the id is the \`msg_...\` from the send response.

## List messages

\`GET /v1/messages?limit=25&cursor=...&number=+15005550100\`

Newest first. \`number\` filters to messages to/from one of your numbers.
Responses are \`{ "data": [...], "has_more": bool, "next_cursor": "..." }\`.

## Statuses

\`queued\` → \`sent\` → \`delivered\` (or \`failed\`). Inbound messages have
direction \`inbound\` and status \`received\`.
`,
  },
  {
    slug: 'verify',
    title: 'Verify',
    description: 'Phone verification (OTP) in two API calls.',
    markdown: `# Verify

Phone verification in two calls. Delivered generates the code, sends it, enforces
expiry and attempt limits, and defends against SMS pumping. You never store a
code — and you don't need to own a phone number.

## The whole integration

Two calls, no dependency required:

\`\`\`js
const send = (to) => fetch('https://api.deliveredsms.com/v1/verify', {
  method: 'POST',
  headers: { Authorization: \`Bearer \${process.env.DELIVERED_API_KEY}\`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ to }),
}).then((r) => r.json());

const check = (to, code) => fetch('https://api.deliveredsms.com/v1/verify/check', {
  method: 'POST',
  headers: { Authorization: \`Bearer \${process.env.DELIVERED_API_KEY}\`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ to, code }),
}).then((r) => r.json());
\`\`\`

Or from the terminal — the CLI ships inside the SDK package, so \`npx\` needs
no install at all:

\`\`\`bash
DELIVERED_API_KEY=dsms_sk_test_... npx deliveredsms verify +14155550132
npx deliveredsms verify +14155550132 482193   # check the code
\`\`\`

Or with the official SDK, which adds retries, typed errors and automatic
idempotency keys:

\`\`\`bash
npm install deliveredsms
\`\`\`

\`\`\`js
import { Delivered } from 'deliveredsms';
const delivered = new Delivered(process.env.DELIVERED_API_KEY);

await delivered.verify.send({ to: '+14155550132' });
const { verified } = await delivered.verify.check({ to: '+14155550132', code });
\`\`\`

## Send a code

\`\`\`bash
curl -X POST https://api.deliveredsms.com/v1/verify \\
  -H "Authorization: Bearer dsms_sk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "phone": "+14155550132" }'
\`\`\`

\`\`\`json
{
  "id": "ver_a1B2c3D4e5F6g7H8",
  "object": "verification",
  "phone": "+14155550132",
  "status": "pending",
  "attempts": 0,
  "charged": false,
  "expires_at": "2026-08-07T12:10:00.000Z"
}
\`\`\`

Optional \`app_name\` (24 chars max) puts your product's name in the message.
The body is a fixed Delivered template — you can't set the text, which is what
keeps verification traffic out of spam filtering.

## You don't need a phone number

Verify sends from Delivered's own verification numbers, registered under our 10DLC
campaign. You don't buy a number, you don't provision anything, and you pay no
monthly number fee — verification is the whole product.

The same recipient always gets codes from the same sender, so a second code
lands in the thread they already have.

If you'd rather codes came from a number you own, pass it as \`from\`:

\`\`\`json
{ "phone": "+14155550132", "from": "+16155550184" }
\`\`\`

## Check the code

\`\`\`bash
curl -X POST https://api.deliveredsms.com/v1/verify/check \\
  -H "Authorization: Bearer dsms_sk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "phone": "+14155550132", "code": "482193" }'
\`\`\`

\`\`\`json
{ "verified": true, "status": "approved", "attempts": 1, "charged": true }
\`\`\`

That's the whole integration.

## You only pay when it works

A verification is billed **only** when a code is actually verified. Wrong
codes, expiries, abandoned flows and anything Shield blocks are free —
every response tells you plainly with \`charged\`.

## Rules Delivered enforces for you

| | |
| --- | --- |
| Code lifetime | 10 minutes |
| Check attempts | 5, then the code is dead |
| Resend cooldown | 60 seconds per number |
| Per number | 5 an hour, 10 a day |

Statuses: \`pending\`, \`approved\`, \`expired\`, \`max_attempts\`, \`blocked\`.

## Shield

SMS pumping is fraud where someone farms revenue-share by triggering
verification codes to numbers they control. Delivered blocks it before you're
charged:

- **US and Canada only.** Country code +1 also covers Jamaica, the Dominican
  Republic and the Bahamas — the classic pumping destinations. We allowlist
  real US and Canadian area codes and reject the rest.
- **Velocity limits** per destination, per account and per source.
- **No VoIP.** Disposable VoIP numbers are rejected.

Blocked attempts return \`403\` with code \`verification_blocked\`, a \`reason\`,
and \`charged: false\`.

## Sandbox

Test keys never send a real message. Any code you send returns a verification
whose code is \`111111\`, and these codes are deterministic:

| Code | Result |
| --- | --- |
| \`111111\` | approved |
| \`000000\` | invalid |
| \`222222\` | expired |
| \`333333\` | max attempts |

Sandbox has **no resend cooldown**, so you can iterate on a "resend code"
button freely. Live enforces 60 seconds per number. To test that path
deterministically, send to \`+15005550003\` — it always returns the cooldown
\`429\` with \`retry_after\` in the body.

## Retrieve a verification

\`GET /v1/verify/{id}\` returns the object with its current status, attempt
count, and whether it was charged.
`,
  },
  {
    slug: 'webhooks',
    title: 'Webhooks',
    description: 'Signed event delivery to your endpoint, with automatic retries.',
    markdown: `# Webhooks

Add an endpoint URL in the [console](/console/webhooks) and every event —
inbound messages, delivery updates, verification results — is POSTed to it as
JSON. That plus an API key is everything you need: send with the API, receive
with webhooks.

Events are also pollable via [\`GET /v1/events\`](/docs/messages) if you prefer
pull over push.

## Payload

Webhook bodies are exactly the event objects from \`/v1/events\`:

\`\`\`json
{
  "id": "evt_a1B2c3D4e5F6g7H8",
  "object": "event",
  "type": "message.received",
  "created_at": "2026-08-13T00:41:00.000Z",
  "data": {
    "message_id": "msg_x9Y8z7W6v5U4t3S2",
    "from": "+14155550132",
    "to": "+15005550100",
    "body": "Hey, got your message!"
  }
}
\`\`\`

## Event types

| Type | Fires when |
| --- | --- |
| \`message.sent\` | An outbound message was accepted by the carrier |
| \`message.delivered\` | The carrier confirmed delivery |
| \`message.failed\` | Delivery failed permanently |
| \`message.received\` | An inbound SMS arrived on one of your numbers |
| \`number.purchased\` | A number was added to your account |
| \`number.released\` | A number was released |
| \`verification.sent\` | A verification code was sent |
| \`verification.approved\` | A code was checked successfully |
| \`verification.failed\` | A code check failed |
| \`verification.blocked\` | A verification was blocked by fraud protection |
| \`test.ping\` | You pressed "Send test" in the console |

Endpoints receive all events by default; pass an \`events\` array when creating
one to filter.

## Verify signatures

Every request carries a \`dsms-signature\` header:

\`\`\`
dsms-signature: t=1755043260,v1=5257a869e7...
\`\`\`

\`v1\` is \`HMAC-SHA256(secret, \\\`\${t}.\${rawBody}\\\`)\` — the same scheme
Stripe uses. Your signing secret (\`whsec_...\`) is shown next to the endpoint
in the console.

\`\`\`ts
import { createHmac, timingSafeEqual } from "crypto";

function verifyWebhook(rawBody: string, header: string, secret: string): boolean {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // 5 min tolerance
  const expected = createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");
  return v1.length === expected.length &&
    timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}
\`\`\`

Compute the HMAC over the **raw request body** — parse the JSON only after the
signature checks out.

## Retries

Respond with any 2xx within 5 seconds. Anything else (including a timeout) is
retried with backoff: 1 minute, 5 minutes, 30 minutes, 2 hours, 12 hours —
then the delivery is dropped. Deliveries can arrive out of order and, rarely,
more than once; use the \`id\` field to deduplicate.

## Test it

Press **Send test** next to any endpoint in the console — a signed
\`test.ping\` fires immediately and the console shows your endpoint's response
code and latency. In the sandbox, \`POST /v1/test/inbound\` emits a real
\`message.received\` through the same pipeline, so you can rehearse your
inbound handler before going live.
`,
  },
  {
    slug: 'migrate-from-twilio',
    title: 'Migrate from Twilio Verify',
    description: 'Line-by-line mapping from Twilio Verify to Delivered Verify.',
    markdown: `# Migrate from Twilio Verify

Two calls become two calls. The main differences: no Verify Service to create,
no phone number to buy, and you're billed only when a code actually verifies.

## Send a code

\`\`\`js
// Twilio
await twilio.verify.v2.services(SERVICE_SID)
  .verifications.create({ to: phone, channel: 'sms' });

// Delivered
await fetch('https://api.deliveredsms.com/v1/verify', {
  method: 'POST',
  headers: { Authorization: \`Bearer \${process.env.DELIVERED_API_KEY}\`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ to: phone }),
});
\`\`\`

## Check a code

\`\`\`js
// Twilio
const check = await twilio.verify.v2.services(SERVICE_SID)
  .verificationChecks.create({ to: phone, code });
if (check.status === 'approved') { /* ... */ }

// Delivered
const res = await fetch('https://api.deliveredsms.com/v1/verify/check', {
  method: 'POST',
  headers: { Authorization: \`Bearer \${process.env.DELIVERED_API_KEY}\`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ to: phone, code }),
});
const { verified } = await res.json();
if (verified) { /* ... */ }
\`\`\`

## What maps to what

| Twilio | Delivered |
| --- | --- |
| \`to\` | \`to\` (or \`phone\` — both work) |
| Account SID + Auth Token | one API key |
| Verify Service SID | nothing — no service to create |
| A purchased phone number | nothing — we send from our pool |
| \`check.status === 'approved'\` | \`verified === true\` |
| \`status: 'pending'\` | \`verified: false\`, \`status: 'pending'\` |
| 404 on bad code | \`200\` with \`verified: false\` (a wrong code isn't an exception) |
| Fraud Guard | Shield, always on |
| ~\$0.05 per attempt | \$0.025, only when verified |

## Things that get simpler

- **No Verify Service.** Delete the \`VA...\` SID from your config.
- **No number.** Delete the number provisioning step entirely.
- **Billing follows success.** Twilio charges per verification attempt; we
  charge when \`verified\` comes back true, so pumping attacks and abandoned
  signups cost you nothing.
- **Attempt/expiry state is in the response.** \`attempts_remaining\` and
  \`expires_in\` let you render "2 tries left" and a countdown without tracking
  anything yourself.

## Things to watch

- **US and Canada only** right now. If you verify internationally, keep Twilio
  for those routes or talk to us.
- **We do not have SDKs yet** — the examples above are plain \`fetch\`, which is
  the whole integration.
- Sandbox has no resend cooldown so you can iterate; live enforces 60 seconds
  per number.
`,
  },
  {
    slug: 'numbers',
    title: 'Numbers',
    description: 'Search, purchase, and release phone numbers.',
    markdown: `# Numbers

## Search available numbers

\`GET /v1/numbers/available?area_code=415\`

Returns up to 5 available numbers. In the sandbox this is a deterministic fake
inventory; with live access it searches real US/Canada inventory across 200+
area codes.

## Purchase a number

\`POST /v1/numbers\` with \`{ "phone_number": "+1..." }\`

Adds the number to your account (quota applies — default 2 live numbers, 3
sandbox). Returns the Number object. Emits a \`number.purchased\` event.

## List your numbers

\`GET /v1/numbers\`

## Release a number

\`DELETE /v1/numbers/+15005550132\`

Marks the number released (live mode disconnects it at the carrier). Rate
limited to 10 releases per 30 minutes. Emits \`number.released\`.

> Live number purchase and release require live access — sandbox
> numbers work for everyone immediately.
`,
  },
  {
    slug: 'lookup',
    title: 'Lookup',
    description: 'Carrier and line type for any number.',
    markdown: `# Lookup

## Look up a number

\`GET /v1/lookup/+14155550132\`

\`\`\`json
{
  "phone_number": "+14155550132",
  "valid": true,
  "line_type": "mobile",
  "carrier": { "name": "Verizon Wireless", "type": "mobile" },
  "caller_name": null
}
\`\`\`

Test keys return deterministic fixtures; live keys return real carrier data
(cached 24h).

## Spam signal

\`GET /v1/lookup/+14155550132/spam\`

\`\`\`json
{
  "phone_number": "+14155550132",
  "spam_score": 87,
  "spam_type": "robocall",
  "severity": "high",
  "last_reported_at": "2026-08-01T12:00:00.000Z",
  "reports": 12
}
\`\`\`

Scores come from a 400k-download consumer phone app's real detection graph — millions of screened
calls and messages. \`spam_score\` is 0–100; anything above 70 was confirmed by
our classifier. Aggregates only; report contents are never exposed.

Lookups count against a daily quota (default 250/day live, 100/day sandbox).
`,
  },
  {
    slug: 'inbox',
    title: 'Inbox & conversations',
    description: 'Threaded conversations, unread counts, and the shared team inbox.',
    markdown: `# Inbox & conversations

Every message on your numbers is grouped into conversations — one per
(your number, counterparty) pair. The console inbox is a shared view: your
whole team sees the same threads and the same unread state.

## How threading works

The thread key is \`{ourDigits}_{theirDigits}\`. Inbound messages increment the
conversation's unread counter; opening the thread in the console clears it.
\`message.received\` webhook events carry a \`conversation\` field with the same
key so your own systems can thread without re-deriving it.

## Attribution

Messages composed in the console are stamped with the sender's name and show
up in the thread as "sent by Alice". API sends are attributed to the key.

## Media

Inbound MMS attachments are stored on the message (\`media\` array) and shown in
the thread. Outbound MMS returns \`mms_not_enabled\` until numbers are
provisioned for MMS.
`,
  },
  {
    slug: 'contacts',
    title: 'Contacts',
    description: 'The address book: custom fields, tags, CSV import and export.',
    markdown: `# Contacts

Contacts are keyed by phone number — one contact per number per account, and
imports upsert rather than duplicate.

## Fields

- \`name\`, \`phone\` (E.164), \`notes\`
- \`tags\` — free-form labels that double as broadcast audiences
- \`fields\` — up to 20 custom key/values, usable in merge fields as \`{{field:key}}\`

## CSV import

Console → Contacts → Import CSV. The first row must be a header including a
phone column (\`phone\`, \`number\`, \`mobile\`…). Unrecognized columns become
custom fields. Existing contacts are enriched, never wiped: a row with only
name+phone will not erase tags you added by hand.

## Export

Console → Contacts → Export downloads the whole book as CSV, custom fields as
columns.

## Names in the inbox

Inbound messages resolve the sender against contacts, so threads show
"Jane Doe" instead of a raw number the moment a contact exists.
`,
  },
  {
    slug: 'teams',
    title: 'Teams',
    description: 'Multiple users on one account: roles, invite links, signatures.',
    markdown: `# Teams

One account, many users. The owner and admins manage the account; members work
the inbox.

## Roles

| Role | Can |
| --- | --- |
| \`admin\` | Everything: keys, billing, webhooks, numbers, team, plus all member abilities. |
| \`member\` | Inbox, contacts, broadcasts, templates, messaging. |

Admin-only routes return \`403\` to members.

## Invites

Console → Team → Create invite link. Links are single-use and expire after 7
days; share them however you like. The recipient signs in (Google or email)
and lands on your team. An account that already belongs to another team must
use a different sign-in.

## Signatures

Each user can set a signature (Console → Team → your profile); it is appended
to messages they compose in the console.
`,
  },
  {
    slug: 'broadcasts',
    title: 'Broadcasts',
    description: 'One message to a tagged audience, sent as individual personalized texts.',
    markdown: `# Broadcasts

A broadcast sends one message to every contact carrying a tag — as N
individual texts. Recipients never see each other, and merge fields
personalize each body.

## Merge fields

\`{{name}}\`, \`{{first_name}}\`, \`{{phone}}\`, \`{{field:company}}\` — resolved
per recipient at send time, so a contact edit made after scheduling still
lands. Unresolvable fields render as empty, never as the raw tag.

## Opt-outs are enforced per recipient

Every recipient passes the full send pipeline independently. Contacts who
replied STOP are counted in \`skipped_opt_out\` — they are never texted and
never silently dropped from the math.

## Scheduling and progress

Pick a future time to schedule; leave it blank to send on the next queue
flush (within a minute). The broadcast page shows \`sent / total\` live, and a
\`broadcast.complete\` webhook event fires when the last job settles.

## Limits

Up to 2,000 recipients per broadcast. Each send counts against your normal
message quota and billing — a broadcast is exactly N messages.
`,
  },
  {
    slug: 'scheduled',
    title: 'Scheduled messages',
    description: 'Send later: schedule 1:1 messages up to 30 days out.',
    markdown: `# Scheduled messages

Pass \`scheduled_at\` (ISO timestamp or epoch ms, up to 30 days out) to
\`POST /v1/messages\` and the message is queued instead of sent:

\`\`\`bash
curl -X POST https://api.deliveredsms.com/v1/messages \
  -H "Authorization: Bearer $DELIVERED_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to":"+14155550132","from":"+15005550110","body":"Reminder!","scheduled_at":"2026-09-01T15:00:00Z"}'
\`\`\`

The response is a \`scheduled_message\` with a \`job_\` id. Delivery happens on
the next queue flush after the timestamp (within a minute).

## The schedule reserves nothing

Opt-out and quota are re-checked at send time, not at scheduling. A recipient
who opts out between scheduling and sending is skipped; a schedule does not
hold quota.

## Listing and canceling

\`GET /api/developers/scheduled\` lists pending jobs;
\`DELETE /api/developers/scheduled?id=job_...\` cancels one that has not sent
yet. Cancellation races are settled atomically — a job mid-send cannot be
canceled.
`,
  },
  {
    slug: 'auto-reply',
    title: 'Auto-replies & office hours',
    description: 'Per-number automatic replies, optionally only outside business hours.',
    markdown: `# Auto-replies & office hours

Each number can answer inbound texts automatically — an away message, an
out-of-office, or a first-touch acknowledgement.

## Configuration

Per number: \`enabled\`, \`message\` (max 320 chars), and optional office hours
(\`tz\` as an IANA zone, open \`days\`, \`start\`/\`end\` as HH:MM, and \`mode\`):

- \`always\` — reply to every eligible inbound.
- \`after_hours\` — the out-of-office pattern: reply only OUTSIDE the hours.

## Guardrails (not configurable)

- STOP / START / HELP keywords always win; the auto-reply never answers them.
- Verification codes are never answered.
- Opted-out counterparties are never texted.
- One auto-reply per conversation per 4 hours, claimed atomically — two
  simultaneous inbound messages cannot double-send.

## Testing

Works identically in sandbox: simulate an inbound with
\`POST /v1/test/inbound\` and the reply appears in the thread with an
\`auto_reply: true\` marker on its event.
`,
  },
  {
    slug: 'porting',
    title: 'Number porting',
    description: 'Bring an existing business number to Delivered.',
    markdown: `# Number porting

You can bring a number you already own. Porting is a carrier-side process with
paperwork and multi-day timelines, so it runs as a tracked request rather than
an instant API call.

## What we need

- The number, your current carrier, and the account number with them
- The last 4 of your account PIN (if your carrier uses one)
- The name of the person authorized to approve the transfer

Submit from Console → Numbers → Port a number (admins only).

## Timeline

| Status | Meaning |
| --- | --- |
| \`requested\` | We received your request. |
| \`submitted\` | Filed with the carrier. |
| \`foc_set\` | The carrier set a Firm Order Commitment date. |
| \`complete\` | The number is live on Delivered. |
| \`rejected\` | The carrier rejected it — the note says why (usually a detail mismatch). |

The status timeline is visible in the console; keep the old service active
until the port completes.
`,
  },
  {
    slug: 'opt-out',
    title: 'Opt-out (STOP)',
    description: 'How STOP, START and HELP are handled, and what is blocked.',
    markdown: `# Opt-out (STOP)

Honouring opt-out is a legal obligation, not a feature. Delivered enforces it on
your behalf for every send, and gives you the events to keep your own systems in
sync.

## Keywords

| Reply | Effect |
| --- | --- |
| \`STOP\`, \`STOPALL\`, \`UNSUBSCRIBE\`, \`CANCEL\`, \`END\`, \`QUIT\` | Opts the number out of **your** messages. We send one confirmation and nothing more. |
| \`START\`, \`UNSTOP\`, \`YES\` | Opts back in. |
| \`HELP\`, \`INFO\` | Sends the standard help reply. |

Matching is exact: the message has to *be* the keyword, ignoring case,
surrounding whitespace and punctuation. "please stop by tomorrow" is an ordinary
message and does not unsubscribe anyone.

## Scope is per-account

An opt-out silences **your** traffic to that number, not everyone's. Someone who
unsubscribes from one sender does not stop receiving login codes from another —
that would turn an unsubscribe into an account lockout.

## What gets blocked

\`POST /v1/messages\` to an opted-out number returns:

\`\`\`json
{ "error": { "code": "forbidden",
  "message": "This recipient has opted out of your messages. Sending to them is not permitted.",
  "param": "to" } }
\`\`\`

**One-time passcodes are exempt.** \`POST /v1/verify\` still delivers, because a
user asking to log in is asking for that code, and blocking it locks them out of
their own account. Every such send is recorded and emits
\`verification.sent_to_opted_out\` so the pattern stays auditable.

## Events

| Event | When |
| --- | --- |
| \`message.opted_out\` | A recipient sent a stop keyword |
| \`message.opted_in\` | A recipient sent a start keyword |
| \`verification.sent_to_opted_out\` | A passcode went to an opted-out number under the exemption |

Subscribe to these and mirror the state in your own database. You should never
re-add a number that opted out, even though we block it.

## Testing it

Opt-out works in the sandbox exactly as it does live, scoped to your account, so
you can rehearse the whole path before going live:

\`\`\`bash
curl -X POST https://api.deliveredsms.com/v1/test/inbound \\
  -H "Authorization: Bearer $DELIVERED_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"from":"+15005550006","to":"<your sandbox number>","body":"STOP"}'
\`\`\`

The next send to that number returns 403. Send \`START\` to clear it.
`,
  },
  {
    slug: 'errors',
    title: 'Errors',
    description: 'The error envelope and every error code.',
    markdown: `# Errors

Every error is JSON with a stable envelope:

\`\`\`json
{
  "error": {
    "code": "invalid_request",
    "message": "\`to\` must be a valid US/Canada number in E.164 format.",
    "param": "to"
  }
}
\`\`\`

## Codes

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | \`invalid_request\` | A parameter is missing or malformed — \`param\` names it. |
| 401 | \`invalid_api_key\` | Missing, malformed, revoked, or unknown key. |
| 403 | \`live_access_required\` | Needs live access (or a live key before approval). |
| 403 | \`test_mode_only\` | Sandbox-only endpoint called with a live key. |
| 403 | \`tenant_suspended\` | Account suspended. |
| 403 | \`forbidden\` | Key is valid but can't act on this resource (e.g. a \`from\` you don't own). |
| 404 | \`not_found\` | No such resource on your account. |
| 409 | \`idempotency_conflict\` | Idempotency-Key reused with a different payload. |
| 429 | \`rate_limited\` | Too many requests — check \`Retry-After\`. |
| 429 | \`quota_exceeded\` | A daily quota was reached. |
| 502 | \`carrier_error\` | Upstream provider failure — retry with backoff. |
| 500 | \`internal_error\` | Our fault. Retry, and tell us if it persists. |

## Rate limits

Default 60 requests/minute per key. \`429\`s include a \`Retry-After\` header.
Successful quota-limited calls include \`X-Quota-Remaining\`.
`,
  },
  {
    slug: 'pricing',
    title: 'Pricing',
    description: 'What the Delivered costs, and what the free tier includes.',
    markdown: `# Pricing

${pricingTableMarkdown()}

## Free tier

${freeTierMarkdown()}

## How billing works

Usage accrues through the month; we charge your card on the 1st. There is no
platform fee, no minimum, and no commitment — a month with no traffic costs
nothing.

Every response that consumes quota returns \`X-Quota-Remaining\`. When you run
out on the free tier you get a \`429\` with code \`quota_exceeded\` and a message
saying whether it was the daily or the monthly limit.

Sandbox (test keys) is unlimited and free forever. It is never metered, never
capped, and never requires a verified recipient — build the whole integration
before you spend anything.

See [the pricing page](/pricing) for the full rate table and a
cost estimator.
`,
  },
  {
    slug: 'changelog',
    title: 'Changelog',
    description: 'What changed in the Delivered.',
    markdown: `# Changelog

## 2026-08-06 — Early access launch

- **Sandbox-first API surface**: \`/v1/messages\` (send, get, list, Idempotency-Key
  support), \`/v1/numbers\` (search, purchase, release), \`/v1/lookup\` (+\`/spam\`),
  \`/v1/events\`, and \`POST /v1/test/inbound\` for simulating inbound SMS.
- **Self-serve console** at [/console](/console): instant
  free sandbox keys, no card.
- **Live mode** (after live-access review): real number provisioning across 200+
  US/Canada area codes and real SMS delivery.
- **Agent surface**: OpenAPI ([yaml](/api/v1/openapi.yaml) ·
  [json](/api/v1/openapi.json)), \`llms.txt\`, single-file docs
  (\`llms-full.txt\`), markdown twins of every docs page, an
  [MCP server](/api/mcp), and an agent skill
  ([delivered](/skills/delivered/SKILL.md)).

### Known limitations

- Live delivery receipts are not yet emitted — a live message's status stays
  \`sent\` (sandbox simulates the full lifecycle). Webhook endpoints (push
  delivery of events) are next; poll \`GET /v1/events\` meanwhile.
`,
  },
];

export function getDocsPage(slug: string): DocsPage | undefined {
  return DOCS_PAGES.find((p) => p.slug === slug);
}

/** Full docs as one markdown document (llms-full.txt). */
export function fullDocsMarkdown(): string {
  const header = `# Delivered — SMS for Developers

Programmable SMS and phone numbers. Base URL: https://api.deliveredsms.com/v1
Authentication: Authorization: Bearer dsms_sk_test_... (or dsms_sk_live_...)
Console (free sandbox keys): https://deliveredsms.com/console
OpenAPI: https://deliveredsms.com/api/v1/openapi.yaml (also .json)

---
`;
  return header + DOCS_PAGES.map((p) => p.markdown).join('\n\n---\n\n');
}
