# Delivered

SMS, phone verification, and real US/Canada phone numbers: one REST API,
built for developers and AI agents.

- Site + docs + console: this repo (Next.js, Vercel)
- API: `api.deliveredsms.com/v1` · MCP: `mcp.deliveredsms.com`
- SDK + CLI: [`packages/deliveredsms`](packages/deliveredsms) → npm `deliveredsms`
- Agent skills: [`public/skills`](public/skills)

## Development

```bash
npm install
npm run dev
```

Requires `.env.local` (Firebase, carrier, and admin credentials; see the
Vercel project for the authoritative set). Never commit env files; this repo
has a fresh history for exactly that reason.

## Structure notes

- `src/lib/urls.ts` is the single source of hostnames. No URL literals
  anywhere else; `grep -r joinghostapp` and `grep -rE "https://[a-z]+\.deliveredsms" src`
  outside that file should stay empty.
- API keys: `dsms_sk_*` minted; legacy `ghost_sk_*` accepted forever.
- The database is shared with the Ghost consumer product by design (tenants,
  usage, abuse registry, spam corpus). The `api*` RTDB nodes belong to this
  repo exclusively.
- Billing is Stripe on a shared account: every `STRIPE_API_PRICE_*` id MUST
  also be registered as `irrelevant` in ghost-checkout's
  `src/lib/stripe-price-registry.ts`, or its webhook will misclassify our
  subscriptions. `scripts/verify-api-billing-isolation.ts` checks this.
