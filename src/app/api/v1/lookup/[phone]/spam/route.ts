import { NextRequest } from 'next/server';
import { withApiKey } from '@/lib/api/auth';
import { apiError, apiJson } from '@/lib/api/response';
import { normalizeE164 } from '@/lib/api/phone';
import { lookupSpam } from '@/lib/api/lookup';
import { takeQuota } from '@/lib/api/usage';
import { entitlementsFor } from '@/lib/api/entitlements';
import { reportMeterEvent } from '@/lib/api/billing/meter';
import type { ApiContext } from '@/lib/api/types';

export const runtime = 'nodejs';
export const maxDuration = 15;

export const GET = withApiKey(
  async (_req: NextRequest, ctx: ApiContext, params: Record<string, string>) => {
    const e164 = normalizeE164(decodeURIComponent(params.phone || ''));
    if (!e164) {
      return apiError(400, 'invalid_request', 'Provide a valid US/Canada number, e.g. /v1/lookup/+14155550132/spam.', { param: 'phone' });
    }

    // Spam scores bill against their own metric - they come from our own data
    // and are priced well below carrier lookups.
    const ent = entitlementsFor(ctx.tenant);
    if (ctx.mode === 'live' && ent.lookupsPerDay === 0) {
      return apiError(
        403,
        'forbidden',
        'Spam scores need a payment method on file. Add one in the console; sandbox spam checks stay free.'
      );
    }
    const quota = await takeQuota(ctx.tenantId, 'spam_scores', ent.lookupsPerDay || 1_000_000);
    if (!quota.allowed) {
      return apiError(429, 'quota_exceeded', `Daily spam-check quota reached (${quota.limit}/day).`);
    }

    if (ctx.mode === 'test') {
      // Deterministic fixture: numbers ending in 9 look spammy.
      const spammy = e164.endsWith('9');
      return apiJson({
        phone_number: e164,
        spam_score: spammy ? 87 : 0,
        spam_type: spammy ? 'robocall' : null,
        severity: spammy ? 'high' : null,
        last_reported_at: spammy ? new Date().toISOString() : null,
        reports: spammy ? 12 : 0,
      });
    }

    const spam = await lookupSpam(e164);
    if (ent.meterEvents && ctx.tenant.billing?.stripeCustomerId) {
      reportMeterEvent({
        tenantId: ctx.tenantId,
        customerId: ctx.tenant.billing.stripeCustomerId,
        meter: 'spam_scores',
      });
    }
    return apiJson(spam);
  }
);
