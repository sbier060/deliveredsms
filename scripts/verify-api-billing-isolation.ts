/**
 * Proves that developer-API Stripe prices can never be mistaken for a consumer
 * Ghost subscription. Run before enabling API_BILLING_ENABLED, and in CI.
 *
 *   npx tsx scripts/verify-api-billing-isolation.ts
 *
 * Background: src/app/api/webhook/route.ts (the live consumer webhook) maps an
 * UNKNOWN price id to subscription type 'main'. Its handlers for
 * subscription.deleted / invoice.payment_failed / subscription.updated then
 * clear `subscribed` and cascade through multiPlan / vpnUpgrade / spamBlocker.
 * If an API price reached that path unregistered, a developer's failed API
 * invoice would switch off a real customer's phone plan.
 */

import { config as loadEnv } from 'dotenv';
// This repo keeps secrets in .env.local (Vercel convention), not .env.
loadEnv({ path: '.env.local' });
loadEnv();
import { readFileSync } from 'fs';
import { join } from 'path';
import { lookupPriceType, firebaseFieldsForType } from '../src/lib/stripe-price-registry';
import { API_PRICE_IDS, configuredPriceIds } from '../src/lib/api/billing/config';

let pass = 0;
let fail = 0;
const ck = (name: string, ok: boolean, detail = '') => {
  if (ok) {
    console.log(`  ✓ ${name}${detail ? ` - ${detail}` : ''}`);
    pass += 1;
  } else {
    console.log(`  ✗ ${name}${detail ? ` - ${detail}` : ''}`);
    fail += 1;
  }
};

console.log('== the hazard this guards against ==');
// The consumer webhook has its OWN copy of this lookup
// (src/app/api/webhook/route.ts getSubscriptionType) whose final line is
// `return 'main'` for any price it doesn't recognise. Assert that fallback
// still exists in the source - if someone ever makes it fail closed, this
// check should tell us so the guard can be relaxed.
const webhookSrc = readFileSync(
  join(__dirname, '../src/app/api/webhook/route.ts'),
  'utf8'
);
ck(
  "consumer webhook still defaults unknown prices to 'main'",
  /Unknown price ID[\s\S]{0,120}return 'main'/.test(webhookSrc),
  'this is why registration is mandatory'
);
ck(
  "shared registry itself returns 'unknown' (callers pick the fallback)",
  lookupPriceType('price_definitely_not_registered_0000') === 'unknown'
);
ck(
  "'main' writes Firebase fields that can clear entitlements",
  firebaseFieldsForType('main').length > 0,
  `${firebaseFieldsForType('main').length} fields`
);
ck("'irrelevant' writes no Firebase fields", firebaseFieldsForType('irrelevant').length === 0);

console.log('\n== configured API prices ==');
const ids = configuredPriceIds();
if (ids.length === 0) {
  console.log('  (none configured - nothing to check yet; run bootstrap-api-billing.ts first)');
} else {
  for (const [unit, id] of Object.entries(API_PRICE_IDS)) {
    if (!id) continue;
    const type = lookupPriceType(id);
    ck(`${unit} → 'irrelevant'`, type === 'irrelevant', `${id} resolves to '${type}'`);
  }
}

console.log(`\nPASS ${pass}  FAIL ${fail}`);
if (fail > 0) {
  console.log(
    "\nAdd every API price id to the IRRELEVANT array in src/lib/stripe-price-registry.ts."
  );
  process.exit(1);
}
