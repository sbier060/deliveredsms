---
name: sms-best-practices
description: Best practices for sending SMS that gets delivered and stays compliant — consent, opt-out handling, message shape, segments, quiet hours, and A2P 10DLC. Use when writing any code or copy that sends text messages to real people.
---

# SMS Best Practices

Rules that keep SMS deliverable and legal. They apply to any provider;
examples use the Delivered.

## Consent — before anything sends

- Text only people who **opted in** to receive texts from *this* product.
  A checkbox at signup ("Text me order updates") is the standard.
- Transactional (receipts, OTPs, alerts the user caused) needs opt-in but no
  marketing language. Marketing needs **explicit** marketing opt-in.
- Never buy lists. Never text scraped numbers. In the US this is TCPA
  territory: $500–$1,500 statutory damages *per message*.

## Opt-out — non-negotiable

- Honor STOP instantly and permanently. Delivered handles the STOP/START/HELP
  keywords and blocks further sends to that number for your account; subscribe to
  `message.opted_out` and mirror it. Never re-add an opted-out number.
- First marketing message to a contact should include "Reply STOP to opt out".
- HELP replies must say who you are.

## Message shape

- **160 GSM-7 characters = 1 segment.** One emoji or curly quote switches the
  whole message to UCS-2 and the limit drops to 70. Segments multiply cost.
- Identify yourself in the first line: `Acme: your order shipped.` Unbranded
  texts get reported as spam, and reports poison the sending number.
- No link shorteners (bit.ly etc.) — carriers filter them aggressively. Use
  your own domain.
- Plain language. ALL-CAPS, "FREE!!", and $$$ trip carrier content filters.

## Timing

- Respect quiet hours: don't send marketing before 8am or after 9pm in the
  *recipient's* timezone (TCPA presumption; some states are stricter).
- OTPs and transactional messages are exempt — send immediately.

## Reliability in code

- Send with an **idempotency key** so a retry after a timeout can't
  double-text a customer (the `deliveredsms` SDK does this automatically).
- Treat `delivered` as the success signal, not the 200 on send. Listen for
  `message.delivered` / `message.failed` events.
- Back off on failure; never tight-loop a failing send.

## A2P 10DLC (US)

Application-to-person traffic on US 10-digit numbers must be registered.
Unregistered traffic gets filtered silently. Delivered registers numbers under
its campaign — included in the number price, nothing to file.

## OTP specifically

Don't build OTP on raw sends at all — use a verify endpoint
(`POST /v1/verify` on Delivered) that owns codes, expiry, attempts, and
SMS-pumping defense. See the `delivered-verify` skill.

## References

- Docs: https://deliveredsms.com/docs/llms-full.txt
- Messages API: https://deliveredsms.com/docs/messages.md
