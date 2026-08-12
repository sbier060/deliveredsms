import { NextRequest } from 'next/server';
import { withApiKey } from '@/lib/api/auth';
import { apiError, apiJson } from '@/lib/api/response';
import { normalizeE164 } from '@/lib/api/phone';
import { sandboxLookupFixture } from '@/lib/api/sandbox';
import { lookupPhone } from '@/lib/api/lookup';
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
      return apiError(400, 'invalid_request', 'Provide a valid US/Canada number, e.g. /v1/lookup/+14155550132.', { param: 'phone' });
    }

    const ent = entitlementsFor(ctx.tenant);
    if (ctx.mode === 'live' && ent.lookupsPerDay === 0) {
      return apiError(
        403,
        'forbidden',
        'Carrier lookups need a payment method on file. Add one in the console — sandbox lookups stay free.'
      );
    }
    const quota = await takeQuota(ctx.tenantId, 'lookups', ent.lookupsPerDay || 1_000_000);
    if (!quota.allowed) {
      return apiError(429, 'quota_exceeded', `Daily lookup quota reached (${quota.limit}/day).`);
    }

    if (ctx.mode === 'test') {
      return apiJson(sandboxLookupFixture(e164), 200, {
        'X-Quota-Remaining': String(Math.max(0, quota.limit - quota.used)),
      });
    }

    const result = await lookupPhone(e164);
    if (!result) {
      return apiError(502, 'carrier_error', 'Lookup provider is unavailable right now. Try again shortly.');
    }
    if (ent.meterEvents && ctx.tenant.billing?.stripeCustomerId) {
      reportMeterEvent({
        tenantId: ctx.tenantId,
        customerId: ctx.tenant.billing.stripeCustomerId,
        meter: 'lookups',
      });
    }
    return apiJson(result, 200, {
      'X-Quota-Remaining': String(Math.max(0, quota.limit - quota.used)),
    });
  }
);
