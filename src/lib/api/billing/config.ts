import { lookupPriceType } from '@/lib/stripe-price-registry';
import type { BillableUnit } from '../pricing';

/**
 * Resms billing configuration and the isolation guard that keeps developer
 * billing from ever touching consumer entitlements.
 *
 * WHY THE GUARD EXISTS: src/app/api/webhook/route.ts (the live consumer Stripe
 * webhook) maps an UNKNOWN price id to subscription type 'main'. If an API
 * price ever reached that webhook unregistered - via
 * customer.subscription.deleted, invoice.payment_failed, etc. - it would set
 * subscribed:0 on a real customer and cascade through multiPlan/vpn/spam,
 * killing a paying customer's phone plan. Registering our price ids as
 * 'irrelevant' makes every one of those handlers skip; this assertion makes it
 * impossible to create a subscription before that registration happened.
 */

export const BILLING_ENABLED = process.env.API_BILLING_ENABLED === 'true';

/** Stripe price ids for the API product, from env (created by the bootstrap script). */
export const API_PRICE_IDS: Partial<Record<BillableUnit, string>> = {
  outbound_sms: process.env.STRIPE_API_PRICE_OUTBOUND_SMS,
  inbound_sms: process.env.STRIPE_API_PRICE_INBOUND_SMS,
  lookups: process.env.STRIPE_API_PRICE_LOOKUPS,
  spam_scores: process.env.STRIPE_API_PRICE_SPAM_SCORES,
  verifications: process.env.STRIPE_API_PRICE_VERIFICATIONS,
  numbers: process.env.STRIPE_API_PRICE_NUMBERS,
};

/** Stripe meter event names - must match the bootstrap script exactly. */
export const METER_EVENT_NAMES = {
  outbound_sms: 'ghost_api_outbound_sms',
  inbound_sms: 'ghost_api_inbound_sms',
  lookups: 'ghost_api_lookups',
  spam_scores: 'ghost_api_spam_scores',
  verifications: 'ghost_api_verifications',
} as const;

export const PORTAL_CONFIGURATION_ID = process.env.STRIPE_API_PORTAL_CONFIG_ID;

export class BillingNotConfiguredError extends Error {}
export class PriceIsolationError extends Error {}

export function configuredPriceIds(): string[] {
  return Object.values(API_PRICE_IDS).filter((v): v is string => Boolean(v));
}

/**
 * Throws unless EVERY configured API price resolves to 'irrelevant' in the
 * consumer price registry. Call before any subscription create/update.
 * Deliberately fails closed: no ids configured is also an error, because a
 * subscription with no items is meaningless.
 */
export function assertApiPricesAreIsolated(): void {
  const ids = configuredPriceIds();
  if (ids.length === 0) {
    throw new BillingNotConfiguredError(
      'No Resms Stripe price ids configured. Run scripts/bootstrap-api-billing.ts and set STRIPE_API_PRICE_* env vars.'
    );
  }
  const unregistered = ids.filter((id) => lookupPriceType(id) !== 'irrelevant');
  if (unregistered.length > 0) {
    throw new PriceIsolationError(
      `Resms price id(s) not registered as 'irrelevant' in src/lib/stripe-price-registry.ts: ${unregistered.join(', ')}. ` +
        'Until they are, the consumer webhook would treat them as a main Ghost subscription and could clear a customer\'s subscribed flag. Refusing to proceed.'
    );
  }
}

/** True when billing is switched on AND safely configured. */
export function billingReady(): boolean {
  if (!BILLING_ENABLED) return false;
  try {
    assertApiPricesAreIsolated();
    return true;
  } catch {
    return false;
  }
}
