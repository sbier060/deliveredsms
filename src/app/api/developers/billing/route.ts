import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/console-auth';
import { getTenantIdByUid, getTenant } from '@/lib/api/tenants';
import { entitlementsFor } from '@/lib/api/entitlements';
import { getUsageMonthTotals, yyyymm } from '@/lib/api/usage';
import { estimateCost, FREE_TIER } from '@/lib/api/pricing';
import { billingReady } from '@/lib/api/billing/config';
import { defaultPaymentMethod, activatePaygFromSetup } from '@/lib/api/billing/activate';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantIdByUid(user.uid);
  const tenant = tenantId ? await getTenant(tenantId) : null;
  if (!tenantId || !tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 });

  const ent = entitlementsFor(tenant);
  const month = await getUsageMonthTotals(tenantId);
  const activeNumbers = Object.values(tenant.numbers || {}).filter(
    (n) => !n.releasedAt && n.mode === 'live'
  ).length;

  const estimate = estimateCost({
    outboundSms: month.messages_sent || 0,
    numbers: activeNumbers,
    lookups: month.lookups || 0,
    spamScores: month.spam_scores || 0,
  });

  // Returning from Checkout: activate synchronously so the console reflects
  // the card immediately instead of waiting on webhook latency (idempotent —
  // the webhook does the same thing).
  const setupSession = req.nextUrl.searchParams.get('setup_session_id');
  if (setupSession && billingReady()) {
    await activatePaygFromSetup(tenantId, null).catch(() => {});
  }

  let paymentMethod: { brand: string; last4: string } | null = null;
  if (billingReady() && tenant.billing?.stripeCustomerId) {
    paymentMethod = await defaultPaymentMethod(tenant.billing.stripeCustomerId).catch(
      () => null
    );
  }

  return NextResponse.json({
    plan: ent.plan,
    status: tenant.billing?.status || 'none',
    billingEnabled: billingReady(),
    month: yyyymm(),
    usage: {
      messages: month.messages_sent || 0,
      lookups: month.lookups || 0,
      spamScores: month.spam_scores || 0,
      numbers: activeNumbers,
    },
    limits: {
      messagesPerMonth: ent.messagesPerMonth,
      messagesPerDay: ent.messagesPerDay,
      numbersMax: ent.numbersMax,
    },
    estimate: {
      lines: estimate.lines,
      subtotalMicroUsd: estimate.subtotalMicroUsd,
    },
    verifiedRecipients: Object.values(tenant.verifiedRecipients || {}),
    maxVerifiedRecipients: FREE_TIER.maxVerifiedRecipients,
    paymentMethod,
  });
}
