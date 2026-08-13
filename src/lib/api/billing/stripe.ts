import Stripe from 'stripe';

/**
 * Stripe client for the developer API billing surface ONLY.
 *
 * Prefers STRIPE_API_BILLING_SECRET_KEY - a RESTRICTED key scoped to
 * meters/meter events/customers/subscriptions/checkout/portal/invoices. With
 * that key in place a bug in this code physically cannot modify a consumer
 * subscription. Falls back to the shared STRIPE_SECRET_KEY so the code runs in
 * development, but that fallback is logged loudly.
 *
 * apiVersion is pinned to the same version as the rest of the repo - 12 files
 * (including the 2,587-line consumer webhook) are typed against it, so this
 * must not drift.
 */

const API_VERSION = '2024-10-28.acacia' as const;

let cached: Stripe | null = null;

export function apiBillingStripe(): Stripe {
  if (cached) return cached;

  const restricted = process.env.STRIPE_API_BILLING_SECRET_KEY;
  const shared = process.env.STRIPE_SECRET_KEY;
  const key = restricted || shared;
  if (!key) {
    throw new Error('No Stripe key configured for API billing');
  }
  if (!restricted) {
    console.warn(
      '[api-billing] Using the shared STRIPE_SECRET_KEY. Create a restricted key ' +
        '(STRIPE_API_BILLING_SECRET_KEY) so developer billing cannot touch consumer subscriptions.'
    );
  }
  cached = new Stripe(key, { apiVersion: API_VERSION });
  return cached;
}

/** True when the configured key targets the LIVE Stripe account. */
export function isLiveKey(): boolean {
  const key = process.env.STRIPE_API_BILLING_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '';
  return key.startsWith('sk_live_') || key.startsWith('rk_live_');
}
