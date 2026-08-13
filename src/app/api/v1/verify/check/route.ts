import { NextRequest } from 'next/server';
import { withApiKey } from '@/lib/api/auth';
import { apiError, apiJson } from '@/lib/api/response';
import { normalizeE164 } from '@/lib/api/phone';
import { entitlementsFor } from '@/lib/api/entitlements';
import { takeQuotaDayMonth } from '@/lib/api/usage';
import { reportMeterEvent } from '@/lib/api/billing/meter';
import { emitEvent } from '@/lib/api/events';
import { checkCode, markCharged, MAX_ATTEMPTS } from '@/lib/api/verify-store';
import type { ApiContext } from '@/lib/api/types';

export const runtime = 'nodejs';
export const maxDuration = 15;

/** Sandbox codes - documented, deterministic, never touch a carrier. */
const SANDBOX_CODES = {
  APPROVED: '111111',
  INVALID: '000000',
  EXPIRED: '222222',
  MAX_ATTEMPTS: '333333',
} as const;

/**
 * POST /v1/verify/check - submit a code.
 *
 * This is the ONLY billable moment in Verify. A developer pays when a code is
 * actually verified; wrong codes, expiries, blocked sends and abandoned flows
 * are free. Billing happens through markCharged(), a one-shot transaction, so
 * a replayed check can never bill twice.
 */
export const POST = withApiKey(
  async (req: NextRequest, ctx: ApiContext) => {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return apiError(400, 'invalid_request', 'Request body must be JSON.');
    }
    const body = (raw || {}) as Record<string, unknown>;
    // `to` is accepted as an alias for `phone` (Twilio compatibility).
    const { code } = body;
    const phone = body.phone ?? body.to;

    const e164 = normalizeE164(phone);
    if (!e164) {
      return apiError(400, 'invalid_request', '`phone` must be a valid US/Canada number in E.164 format.', { param: 'phone' });
    }
    if (typeof code !== 'string' || !/^\d{4,8}$/.test(code)) {
      return apiError(400, 'invalid_request', '`code` must be the numeric code you received.', { param: 'code' });
    }

    // ── Sandbox: deterministic outcomes, no metering ─────────────────────────
    if (ctx.mode === 'test') {
      if (code === SANDBOX_CODES.EXPIRED) {
        return apiJson({ verified: false, status: 'expired', attempts: 0, attempts_remaining: 0, max_attempts: MAX_ATTEMPTS, charged: false });
      }
      if (code === SANDBOX_CODES.MAX_ATTEMPTS) {
        return apiJson({ verified: false, status: 'max_attempts', attempts: MAX_ATTEMPTS, attempts_remaining: 0, max_attempts: MAX_ATTEMPTS, charged: false });
      }
      const outcome = await checkCode(ctx.tenantId, e164, code);
      if (outcome.result === 'not_found') {
        return apiError(404, 'verification_not_found', 'No active verification for that number. Send one with POST /v1/verify.');
      }
      const verified = outcome.result === 'approved';
      if (verified) {
        await emitEvent(ctx.tenantId, 'verification.approved', {
          verification_id: outcome.record.id,
          phone: e164,
          test: true,
        });
      }
      return apiJson({
        verified,
        status: outcome.record.status,
        attempts: outcome.record.attempts,
        attempts_remaining: Math.max(0, MAX_ATTEMPTS - outcome.record.attempts),
        max_attempts: MAX_ATTEMPTS,
        charged: false,
      });
    }

    // ── Live ────────────────────────────────────────────────────────────────
    const outcome = await checkCode(ctx.tenantId, e164, code);
    if (outcome.result === 'not_found') {
      return apiError(404, 'verification_not_found', 'No active verification for that number. Send one with POST /v1/verify.');
    }

    if (outcome.result !== 'approved') {
      await emitEvent(ctx.tenantId, 'verification.failed', {
        verification_id: outcome.record.id,
        phone: e164,
        status: outcome.record.status,
      });
      return apiJson({
        verified: false,
        status: outcome.record.status,
        attempts: outcome.record.attempts,
        attempts_remaining: Math.max(0, MAX_ATTEMPTS - outcome.record.attempts),
        max_attempts: MAX_ATTEMPTS,
        charged: false,
      });
    }

    // Approved. Bill exactly once, and only now.
    let charged = false;
    const first = await markCharged(ctx.tenantId, outcome.record.id);
    if (first) {
      const ent = entitlementsFor(ctx.tenant);
      const quota = await takeQuotaDayMonth(
        ctx.tenantId,
        'verifications',
        ent.verificationsPerDay,
        ent.verificationsPerMonth
      );
      if (!quota.allowed) {
        // The user IS verified - we do not punish them for our billing limit.
        // Surface the cap and let the developer add a card; the verification
        // still stands and simply goes unbilled.
        console.warn(`[v1/verify/check] ${ctx.tenantId} verified past its quota (${quota.reason})`);
      } else {
        charged = true;
        if (ent.meterEvents && ctx.tenant.billing?.stripeCustomerId) {
          reportMeterEvent({
            tenantId: ctx.tenantId,
            customerId: ctx.tenant.billing.stripeCustomerId,
            meter: 'verifications',
          });
        }
      }
    }

    await emitEvent(ctx.tenantId, 'verification.approved', {
      verification_id: outcome.record.id,
      phone: e164,
    });

    return apiJson({
      verified: true,
      status: 'approved',
      attempts: outcome.record.attempts,
      attempts_remaining: Math.max(0, MAX_ATTEMPTS - outcome.record.attempts),
      max_attempts: MAX_ATTEMPTS,
      charged,
    });
  },
  { rateLimit: { limit: 60, windowSec: 60 } }
);
