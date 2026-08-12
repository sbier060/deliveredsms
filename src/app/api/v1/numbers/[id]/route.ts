import { NextRequest } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { withApiKey } from '@/lib/api/auth';
import { apiError, apiJson } from '@/lib/api/response';
import { normalizeE164, digits10 } from '@/lib/api/phone';
import { emitEvent } from '@/lib/api/events';
import { carrierReleaseNumber } from '@/lib/api/carrier/inteliquent';
import { syncNumberQuantity } from '@/lib/api/billing/subscription';
import type { ApiContext } from '@/lib/api/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

export const DELETE = withApiKey(
  async (_req: NextRequest, ctx: ApiContext, params: Record<string, string>) => {
    const e164 = normalizeE164(decodeURIComponent(params.id || ''));
    if (!e164) return apiError(404, 'not_found', 'No number found with that id.');

    const key = digits10(e164);
    const owned = ctx.tenant.numbers?.[key];
    if (!owned || owned.releasedAt) {
      return apiError(404, 'not_found', 'No active number found with that id on your account.');
    }

    if (owned.mode === 'live') {
      try {
        await carrierReleaseNumber(e164);
      } catch (error) {
        console.error('[v1/numbers] carrier release failed:', error);
        return apiError(502, 'carrier_error', 'The carrier could not release this number right now. Try again shortly.');
      }
      await db.ref(`phoneNumberOwners/${key}`).remove();
      await db.ref(`apiNumberWebhooks/${key}`).remove();
    }

    await db.ref(`apiTenants/${ctx.tenantId}/numbers/${key}/releasedAt`).set(Date.now());
    await emitEvent(ctx.tenantId, 'number.released', { phone_number: e164 });
    if (owned.mode === 'live') syncNumberQuantity(ctx.tenantId).catch(() => {});
    return apiJson({
      id: e164,
      object: 'number',
      phone_number: e164,
      status: 'released',
    });
  },
  { rateLimit: { limit: 10, windowSec: 1800 } }
);
