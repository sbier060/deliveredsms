# opensms

Official client for the [OpenSMS](https://opensms.dev) —
SMS, phone verification, numbers, and spam lookup. Zero dependencies, works
anywhere `fetch` does.

```bash
npm install opensms
```

Get a free key (no card) at
[the console](https://opensms.dev/console).

## Phone verification

```js
import { OpenSMS } from 'opensms';

const opensms = new OpenSMS(process.env.OPENSMS_API_KEY);

await opensms.verify.send({ to: '+14155550132' });
const { verified } = await opensms.verify.check({ to: '+14155550132', code });
```

That's the whole integration. You don't store codes, you don't own a phone
number, and you're billed only when `verified` comes back true.

The response carries what a UI needs, so you don't track state yourself:

```js
const v = await opensms.verify.send({ to: phone });
v.expires_in;         // 600  — for a countdown
v.attempts_remaining; // 5    — for "2 tries left"
```

## Send an SMS

```js
const message = await opensms.messages.send({
  from: '+14155550100',
  to: '+16285550107',
  body: 'Your table is ready.',
});
```

Retries are safe. An `Idempotency-Key` is generated automatically, so a network
blip can never double-send. Pass your own if you'd rather control it:

```js
await opensms.messages.send({ from, to, body }, { idempotencyKey: `order:${orderId}` });
```

## Numbers, lookup, events

```js
await opensms.numbers.available({ areaCode: '415' });
await opensms.numbers.buy('+14155550132');
await opensms.numbers.list();
await opensms.numbers.release('+14155550132');

await opensms.lookup.phone('+14155550132');   // carrier, line type
await opensms.lookup.spam('+14155550132');    // spam score 0–100

await opensms.events.list({ limit: 25 });
```

## Errors

Every failure throws a `GhostError` with a machine-readable code:

```js
import { GhostError } from 'opensms';

try {
  await opensms.verify.send({ to: phone });
} catch (err) {
  if (err instanceof GhostError) {
    err.code;       // 'verification_blocked' | 'rate_limited' | …
    err.status;     // HTTP status
    err.retryable;  // whether trying again could work
    err.retryAfter; // seconds to wait, on rate limits
    err.reason;     // why Shield blocked it
  }
}
```

Transient failures (5xx, timeouts, connection errors) are retried
automatically. Two things deliberately are **not** retried: a `POST` without an
idempotency key, and a verification cooldown — that's a policy, not a blip, so
it's surfaced to you with `retryAfter`.

## Testing

Test keys (`ghost_sk_test_…`) never touch a carrier and cost nothing.

```js
ghost.isTestMode; // true
```

| Send to | Result |
| --- | --- |
| `+15005550006` | delivered |
| `+15005550002` | failed |
| `+15005550001` | stays queued |
| `+15005550003` | verification cooldown (429) |

| Verification code | Result |
| --- | --- |
| `111111` | approved |
| `000000` | invalid |
| `222222` | expired |
| `333333` | max attempts |

## Options

```js
new OpenSMS(apiKey, {
  baseUrl: 'https://api.opensms.dev',
  maxRetries: 2,
  timeout: 30_000,
  fetch: myFetch, // bring your own, e.g. for tracing
});
```

## Migrating from Twilio

See the [migration guide](https://opensms.dev/docs/migrate-from-twilio).
`to` works as a parameter name everywhere, so most Twilio Verify code needs
only the client swapped.

MIT © Block Apps LLC
