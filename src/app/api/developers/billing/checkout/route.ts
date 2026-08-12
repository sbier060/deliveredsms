import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/console-auth';
import { getTenantIdByUid, getTenant } from '@/lib/api/tenants';
import { apiBillingStripe } from '@/lib/api/billing/stripe';
import { getOrCreateApiCustomer } from '@/lib/api/billing/customer';
import { billingReady } from '@/lib/api/billing/config';
import { BASE_URL } from '@/lib/metadata';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Stripe Checkout in SETUP mode to collect a card.
 *
 * Setup mode is provably inert against the consumer webhook's
 * checkout.session.completed handler: completeCheckoutSession() returns null
 * unless mode === 'subscription' AND payment_status === 'paid'.
 * We also never set client_reference_id — that is what the consumer path reads
 * as a Firebase uid.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!billingReady()) {
    return NextResponse.json(
      { error: 'Card billing is not enabled yet.' },
      { status: 503 }
    );
  }

  const tenantId = await getTenantIdByUid(user.uid);
  const tenant = tenantId ? await getTenant(tenantId) : null;
  if (!tenantId || !tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 });

  const stripe = apiBillingStripe();
  const customerId = await getOrCreateApiCustomer(tenant);

  const session = await stripe.checkout.sessions.create({
    mode: 'setup',
    customer: customerId,
    currency: 'usd',
    success_url: `${BASE_URL}/console/billing?setup=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${BASE_URL}/console/billing?setup=cancelled`,
    metadata: { ghost_api_tenant_id: tenantId, ghost_surface: 'developer_api' },
  });

  return NextResponse.json({ url: session.url });
}
