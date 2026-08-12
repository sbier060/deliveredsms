import { db } from '@/lib/firebase-admin';
import { apiBillingStripe } from './stripe';
import { ensureApiSubscription } from './subscription';
import { getTenant } from '../tenants';

/**
 * Turn a completed card setup into an active pay-as-you-go account.
 * Idempotent: called both from the isolated webhook and synchronously when the
 * developer returns from Checkout, so the console reflects it immediately
 * rather than waiting on webhook latency.
 */
export async function activatePaygFromSetup(
  tenantId: string,
  setupIntentId: string | null
): Promise<{ activated: boolean }> {
  const tenant = await getTenant(tenantId);
  if (!tenant?.billing?.stripeCustomerId) return { activated: false };

  const stripe = apiBillingStripe();

  // Make the newly-saved card the default for invoices.
  if (setupIntentId) {
    const intent = await stripe.setupIntents.retrieve(setupIntentId);
    const pm = typeof intent.payment_method === 'string'
      ? intent.payment_method
      : intent.payment_method?.id;
    if (pm) {
      await stripe.customers.update(tenant.billing.stripeCustomerId, {
        invoice_settings: { default_payment_method: pm },
      });
    }
  }

  await ensureApiSubscription(tenantId);
  await db.ref(`apiTenants/${tenantId}/billing`).update({
    plan: 'payg',
    status: 'active',
    paymentMethodAttachedAt: Date.now(),
    updatedAt: Date.now(),
  });
  return { activated: true };
}

/** Card brand/last4 for the console, or null. */
export async function defaultPaymentMethod(
  customerId: string
): Promise<{ brand: string; last4: string } | null> {
  const stripe = apiBillingStripe();
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;
  const pmId = customer.invoice_settings?.default_payment_method;
  if (!pmId) return null;
  const pm = await stripe.paymentMethods.retrieve(
    typeof pmId === 'string' ? pmId : pmId.id
  );
  if (!pm.card) return null;
  return { brand: pm.card.brand, last4: pm.card.last4 };
}
