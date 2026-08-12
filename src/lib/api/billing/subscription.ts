import { db } from '@/lib/firebase-admin';
import { apiBillingStripe } from './stripe';
import { API_PRICE_IDS, assertApiPricesAreIsolated } from './config';
import { getOrCreateApiCustomer } from './customer';
import { getTenant } from '../tenants';
import type { ApiTenant } from '../types';

/**
 * The tenant's usage subscription: four metered items (outbound/inbound SMS,
 * lookups, spam scores) plus one LICENSED item for phone numbers whose
 * quantity tracks how many live numbers they hold.
 *
 * Numbers are licensed rather than metered so Stripe does the mid-month
 * proration itself and the invoice reads "2 × Phone number — $1.90" instead of
 * "60 units × $0.0316". It also means no daily cron.
 *
 * The cycle is anchored to the 1st so the Stripe invoice period is exactly the
 * calendar month our apiUsageMonthly counters use — otherwise the console's
 * "this month" estimate and the invoice would disagree and generate tickets.
 */

function firstOfNextMonthUnix(): number {
  const now = new Date();
  return Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0) / 1000
  );
}

function liveNumberCount(tenant: ApiTenant): number {
  return Object.values(tenant.numbers || {}).filter(
    (n) => !n.releasedAt && n.mode === 'live'
  ).length;
}

export async function ensureApiSubscription(
  tenantId: string
): Promise<{ subscriptionId: string }> {
  // Never create a subscription whose prices could be misread by the consumer
  // webhook as a main Ghost plan.
  assertApiPricesAreIsolated();

  const tenant = await getTenant(tenantId);
  if (!tenant) throw new Error(`Unknown tenant ${tenantId}`);

  const existing = tenant.billing?.stripeSubscriptionId;
  if (existing) return { subscriptionId: existing };

  const stripe = apiBillingStripe();
  const customerId = await getOrCreateApiCustomer(tenant);

  const items: Array<{ price: string; quantity?: number }> = [];
  for (const unit of ['outbound_sms', 'inbound_sms', 'lookups', 'spam_scores'] as const) {
    const price = API_PRICE_IDS[unit];
    if (price) items.push({ price });
  }
  if (API_PRICE_IDS.numbers) {
    items.push({ price: API_PRICE_IDS.numbers, quantity: liveNumberCount(tenant) });
  }

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items,
    collection_method: 'charge_automatically',
    billing_cycle_anchor: firstOfNextMonthUnix(),
    proration_behavior: 'none',
    description: 'OpenSMS — usage',
    // ghost_api_tenant_id ONLY. `userId` is the first thing the consumer
    // subscription.deleted handler reads; it must never appear here.
    metadata: { ghost_api_tenant_id: tenantId, ghost_surface: 'developer_api' },
  });

  const itemIds: Record<string, string> = {};
  for (const item of subscription.items.data) {
    const unit = (Object.keys(API_PRICE_IDS) as Array<keyof typeof API_PRICE_IDS>).find(
      (u) => API_PRICE_IDS[u] === item.price.id
    );
    if (unit) itemIds[unit] = item.id;
  }

  await db.ref(`apiTenants/${tenantId}/billing`).update({
    stripeSubscriptionId: subscription.id,
    items: itemIds,
    plan: 'payg',
    status: 'active',
    currentPeriodStart: subscription.current_period_start * 1000,
    currentPeriodEnd: subscription.current_period_end * 1000,
    updatedAt: Date.now(),
  });

  return { subscriptionId: subscription.id };
}

/**
 * Keep the licensed number item's quantity in step with reality. Called
 * fire-and-forget after a live purchase or release; idempotent.
 */
export async function syncNumberQuantity(tenantId: string): Promise<void> {
  const tenant = await getTenant(tenantId);
  if (!tenant?.billing?.stripeSubscriptionId) return;
  const itemId = tenant.billing.items?.numbers;
  if (!itemId) return;

  const stripe = apiBillingStripe();
  await stripe.subscriptionItems.update(itemId, {
    quantity: liveNumberCount(tenant),
    proration_behavior: 'create_prorations',
  });
}
