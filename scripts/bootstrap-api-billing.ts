/**
 * Creates the Stripe objects the Ghost developer API bills against:
 * one product, four Billing Meters, five prices, and a dedicated billing-portal
 * configuration. Idempotent — reuses anything that already exists.
 *
 *   npx tsx scripts/bootstrap-api-billing.ts             # dry run (default)
 *   npx tsx scripts/bootstrap-api-billing.ts --apply     # create
 *   npx tsx scripts/bootstrap-api-billing.ts --verify    # check env + registry
 *
 * SAFETY: this repo's Stripe account is SHARED with other businesses
 * (Truepicks, PrivacyAI, Settlebuddy) and the only key on most machines is a
 * LIVE key. Running --apply against a live account is therefore refused unless
 * you also pass --i-understand-live. Creating products/prices charges nobody,
 * but they are permanent objects on a shared production account.
 */

import { config as loadEnv } from 'dotenv';
// This repo keeps secrets in .env.local (Vercel convention), not .env.
loadEnv({ path: '.env.local' });
loadEnv();
import Stripe from 'stripe';
import { RATES, toStripeUnitAmountDecimal } from '../src/lib/api/pricing';
import { lookupPriceType } from '../src/lib/stripe-price-registry';

const APPLY = process.argv.includes('--apply');
const VERIFY = process.argv.includes('--verify');
const LIVE_OK = process.argv.includes('--i-understand-live');

const KEY = process.env.STRIPE_API_BILLING_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '';
const IS_LIVE = KEY.startsWith('sk_live_') || KEY.startsWith('rk_live_');

const PRODUCT_LOOKUP = 'ghost_api_v1';

const METERS = [
  { unit: 'outbound_sms', event: 'ghost_api_outbound_sms', display: 'Delivered — Outbound SMS' },
  { unit: 'inbound_sms', event: 'ghost_api_inbound_sms', display: 'Delivered — Inbound SMS' },
  { unit: 'lookups', event: 'ghost_api_lookups', display: 'Delivered — Carrier lookups' },
  { unit: 'spam_scores', event: 'ghost_api_spam_scores', display: 'Delivered — Spam scores' },
  { unit: 'verifications', event: 'ghost_api_verifications', display: 'Delivered — Phone verifications' },
] as const;

const ENV_VAR: Record<string, string> = {
  outbound_sms: 'STRIPE_API_PRICE_OUTBOUND_SMS',
  inbound_sms: 'STRIPE_API_PRICE_INBOUND_SMS',
  lookups: 'STRIPE_API_PRICE_LOOKUPS',
  spam_scores: 'STRIPE_API_PRICE_SPAM_SCORES',
  verifications: 'STRIPE_API_PRICE_VERIFICATIONS',
  numbers: 'STRIPE_API_PRICE_NUMBERS',
};

function verifyRegistry(): number {
  console.log('\n── Registry isolation check ──');
  let bad = 0;
  for (const [unit, envName] of Object.entries(ENV_VAR)) {
    const id = process.env[envName];
    if (!id) {
      console.log(`  ⚠ ${unit}: ${envName} not set`);
      bad += 1;
      continue;
    }
    const type = lookupPriceType(id);
    if (type === 'irrelevant') {
      console.log(`  ✓ ${unit}: ${id} → 'irrelevant'`);
    } else {
      console.log(`  ✗ ${unit}: ${id} → '${type}'  ← MUST be 'irrelevant'`);
      bad += 1;
    }
  }
  return bad;
}

async function main() {
  if (VERIFY) {
    const bad = verifyRegistry();
    if (bad > 0) {
      console.log(
        `\n${bad} problem(s). Add every API price id to the IRRELEVANT array in ` +
          `src/lib/stripe-price-registry.ts, or the consumer webhook will treat them as a ` +
          `main Ghost subscription and can clear a customer's subscribed flag.`
      );
      process.exit(1);
    }
    console.log('\nAll API prices are isolated. Safe to enable API_BILLING_ENABLED.');
    return;
  }

  if (!KEY) {
    console.error('No Stripe key found (STRIPE_API_BILLING_SECRET_KEY or STRIPE_SECRET_KEY).');
    process.exit(1);
  }

  console.log(`Stripe account mode: ${IS_LIVE ? 'LIVE' : 'TEST'}`);
  if (APPLY && IS_LIVE && !LIVE_OK) {
    console.error(
      '\nREFUSING to create objects on a LIVE Stripe account.\n' +
        'This account is shared with other businesses. Either:\n' +
        '  • set STRIPE_API_BILLING_SECRET_KEY to a TEST key (sk_test_…) and re-run, or\n' +
        '  • re-run with --i-understand-live if you really mean to create live objects.\n'
    );
    process.exit(2);
  }
  if (!APPLY) {
    console.log('\n(dry run — pass --apply to create anything)\n');
  }

  const stripe = new Stripe(KEY, { apiVersion: '2024-10-28.acacia' });
  const created: Record<string, string> = {};

  // ── product ───────────────────────────────────────────────────────────────
  let productId: string | null = null;
  const products = await stripe.products.search({
    query: `metadata['lookup_key']:'${PRODUCT_LOOKUP}'`,
  });
  if (products.data[0]) {
    productId = products.data[0].id;
    console.log(`product: reuse ${productId}`);
  } else if (APPLY) {
    const p = await stripe.products.create({
      name: 'Delivered',
      description: 'Programmable SMS, phone numbers, and spam intelligence.',
      metadata: { lookup_key: PRODUCT_LOOKUP, ghost_surface: 'developer_api' },
    });
    productId = p.id;
    console.log(`product: created ${productId}`);
  } else {
    console.log('product: would create "Delivered"');
  }

  // ── meters ────────────────────────────────────────────────────────────────
  const meterIds: Record<string, string> = {};
  const existingMeters = await stripe.billing.meters.list({ limit: 100 });
  for (const m of METERS) {
    const found = existingMeters.data.find((x) => x.event_name === m.event);
    if (found) {
      meterIds[m.unit] = found.id;
      console.log(`meter ${m.event}: reuse ${found.id}`);
    } else if (APPLY) {
      const meter = await stripe.billing.meters.create({
        display_name: m.display,
        event_name: m.event,
        default_aggregation: { formula: 'sum' },
        customer_mapping: { type: 'by_id', event_payload_key: 'stripe_customer_id' },
        value_settings: { event_payload_key: 'value' },
      });
      meterIds[m.unit] = meter.id;
      console.log(`meter ${m.event}: created ${meter.id}`);
    } else {
      console.log(`meter ${m.event}: would create`);
    }
  }

  // ── prices ────────────────────────────────────────────────────────────────
  for (const m of METERS) {
    const lookup = `${m.event}_v1`;
    const existing = await stripe.prices.list({ lookup_keys: [lookup], limit: 1 });
    if (existing.data[0]) {
      created[m.unit] = existing.data[0].id;
      console.log(`price ${lookup}: reuse ${existing.data[0].id}`);
      continue;
    }
    const amount = toStripeUnitAmountDecimal(RATES[m.unit].microUsd);
    if (!APPLY || !productId || !meterIds[m.unit]) {
      console.log(`price ${lookup}: would create at ${amount}¢/unit`);
      continue;
    }
    const price = await stripe.prices.create({
      product: productId,
      currency: 'usd',
      lookup_key: lookup,
      unit_amount_decimal: amount,
      recurring: { interval: 'month', usage_type: 'metered', meter: meterIds[m.unit] },
      metadata: { ghost_surface: 'developer_api' },
    });
    created[m.unit] = price.id;
    console.log(`price ${lookup}: created ${price.id} at ${amount}¢/unit`);
  }

  // licensed price for phone numbers
  {
    const lookup = 'ghost_api_numbers_v1';
    const existing = await stripe.prices.list({ lookup_keys: [lookup], limit: 1 });
    if (existing.data[0]) {
      created.numbers = existing.data[0].id;
      console.log(`price ${lookup}: reuse ${existing.data[0].id}`);
    } else if (APPLY && productId) {
      const price = await stripe.prices.create({
        product: productId,
        currency: 'usd',
        lookup_key: lookup,
        unit_amount: Math.round(RATES.numbers.microUsd / 10_000),
        recurring: { interval: 'month', usage_type: 'licensed' },
        metadata: { ghost_surface: 'developer_api' },
      });
      created.numbers = price.id;
      console.log(`price ${lookup}: created ${price.id}`);
    } else {
      console.log(`price ${lookup}: would create at $${(RATES.numbers.microUsd / 1e6).toFixed(2)}/mo`);
    }
  }

  // ── portal configuration (NEVER touch the default one) ────────────────────
  let portalId = process.env.STRIPE_API_PORTAL_CONFIG_ID || null;
  if (!portalId && APPLY) {
    const cfg = await stripe.billingPortal.configurations.create({
      business_profile: { headline: 'Delivered billing' },
      features: {
        payment_method_update: { enabled: true },
        invoice_history: { enabled: true },
        subscription_cancel: { enabled: false },
        customer_update: { enabled: false },
      },
    });
    portalId = cfg.id;
    console.log(`portal config: created ${cfg.id}`);
  } else if (!portalId) {
    console.log('portal config: would create (dedicated — the default belongs to consumer checkout)');
  }

  // ── output ────────────────────────────────────────────────────────────────
  if (APPLY) {
    console.log('\n── Add to env ──');
    for (const [unit, envName] of Object.entries(ENV_VAR)) {
      if (created[unit]) console.log(`${envName}=${created[unit]}`);
    }
    if (portalId) console.log(`STRIPE_API_PORTAL_CONFIG_ID=${portalId}`);
    console.log('API_BILLING_ENABLED=false   # flip to true only after --verify passes');

    console.log('\n⚠️  BEFORE ENABLING: add these price ids to the IRRELEVANT array in');
    console.log('    src/lib/stripe-price-registry.ts. Until you do,');
    console.log('    assertApiPricesAreIsolated() throws and no subscription can be created.');
    console.log('    That is intentional — it is what stops an API price from being read as');
    console.log("    a main Ghost plan and clearing a real customer's subscribed flag.");
    console.log('\n    Then run: npx tsx scripts/bootstrap-api-billing.ts --verify');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
