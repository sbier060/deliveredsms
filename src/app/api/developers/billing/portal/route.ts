import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/console-auth';
import { getTenantIdByUid, getTenant } from '@/lib/api/tenants';
import { apiBillingStripe } from '@/lib/api/billing/stripe';
import { PORTAL_CONFIGURATION_ID, billingReady } from '@/lib/api/billing/config';
import { BASE_URL } from '@/lib/metadata';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Billing portal for card changes and invoice history.
 *
 * ALWAYS passes an explicit `configuration` — the DEFAULT portal configuration
 * belongs to the consumer cancel flow (src/app/api/create-portal-session), and
 * mutating or relying on it here would change that flow account-wide.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!billingReady()) {
    return NextResponse.json({ error: 'Card billing is not enabled yet.' }, { status: 503 });
  }

  const tenantId = await getTenantIdByUid(user.uid);
  const tenant = tenantId ? await getTenant(tenantId) : null;
  const customerId = tenant?.billing?.stripeCustomerId;
  if (!customerId) {
    return NextResponse.json({ error: 'No billing account yet.' }, { status: 404 });
  }
  if (!PORTAL_CONFIGURATION_ID) {
    return NextResponse.json(
      { error: 'Billing portal is not configured for the API surface.' },
      { status: 503 }
    );
  }

  const session = await apiBillingStripe().billingPortal.sessions.create({
    customer: customerId,
    configuration: PORTAL_CONFIGURATION_ID,
    return_url: `${BASE_URL}/console/billing`,
  });
  return NextResponse.json({ url: session.url });
}
