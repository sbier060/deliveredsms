import { NextRequest } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { withApiKey } from '@/lib/api/auth';
import { apiError, apiJson, apiList } from '@/lib/api/response';
import { normalizeE164, digits10 } from '@/lib/api/phone';
import { isSandboxNumber } from '@/lib/api/sandbox';
import { emitEvent } from '@/lib/api/events';
import { carrierPurchaseNumber } from '@/lib/api/carrier/inteliquent';
import { entitlementsFor } from '@/lib/api/entitlements';
import { syncNumberQuantity } from '@/lib/api/billing/subscription';
import type { ApiContext, TenantNumber } from '@/lib/api/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

function publicNumber(n: TenantNumber) {
  return {
    id: n.phoneNumber,
    object: 'number',
    phone_number: n.phoneNumber,
    status: n.releasedAt ? 'released' : 'active',
    mode: n.mode,
    created_at: new Date(n.purchasedAt).toISOString(),
  };
}

export const GET = withApiKey(async (_req: NextRequest, ctx: ApiContext) => {
  const numbers = Object.values(ctx.tenant.numbers || {})
    .filter((n) => !n.releasedAt)
    .sort((a, b) => b.purchasedAt - a.purchasedAt)
    .map(publicNumber);
  return apiList(numbers, false, null);
});

export const POST = withApiKey(async (req: NextRequest, ctx: ApiContext) => {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError(400, 'invalid_request', 'Request body must be JSON.');
  }
  const e164 = normalizeE164((raw as Record<string, unknown>)?.phone_number);
  if (!e164) {
    return apiError(400, 'invalid_request', '`phone_number` must be a valid US/Canada number in E.164 format.', { param: 'phone_number' });
  }

  if (ctx.mode === 'test' && !isSandboxNumber(e164)) {
    return apiError(400, 'invalid_request', 'Test keys can only purchase sandbox numbers (+1 500-555-XXXX). Pick one from GET /v1/numbers/available.', { param: 'phone_number' });
  }
  if (ctx.mode === 'live' && isSandboxNumber(e164)) {
    return apiError(400, 'invalid_request', 'Sandbox numbers cannot be purchased with a live key.', { param: 'phone_number' });
  }

  const key = digits10(e164);
  const existing = ctx.tenant.numbers?.[key];
  if (existing && !existing.releasedAt) {
    return apiError(400, 'invalid_request', 'You already own this number.', { param: 'phone_number' });
  }

  const ent = entitlementsFor(ctx.tenant);
  const active = Object.values(ctx.tenant.numbers || {}).filter((n) => !n.releasedAt).length;
  if (active >= ent.numbersMax) {
    return apiError(429, 'quota_exceeded', `Number limit reached (${ent.numbersMax}). Release one, or add a payment method for more.`);
  }

  if (ctx.mode === 'live') {
    try {
      await carrierPurchaseNumber(e164, `ResmsApi_${ctx.tenantId}`);
    } catch (error) {
      console.error('[v1/numbers] carrier purchase failed:', error);
      return apiError(502, 'carrier_error', 'This number could not be activated. Pick another from GET /v1/numbers/available.');
    }
    // Ownership + inbound-routing records (used by the Phase 3 webhook fan-out).
    await db.ref(`phoneNumberOwners/${key}`).set(ctx.uid);
    await db.ref(`apiNumberWebhooks/${key}`).set(ctx.tenantId);
  }

  const record: TenantNumber = { phoneNumber: e164, purchasedAt: Date.now(), mode: ctx.mode };
  await db.ref(`apiTenants/${ctx.tenantId}/numbers/${key}`).set(record);
  await emitEvent(ctx.tenantId, 'number.purchased', { phone_number: e164, mode: ctx.mode });
  if (ctx.mode === 'live') syncNumberQuantity(ctx.tenantId).catch(() => {});
  return apiJson(publicNumber(record), 201);
});
