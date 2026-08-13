import { NextRequest } from 'next/server';
import { withApiKey } from '@/lib/api/auth';
import { apiError, apiJson } from '@/lib/api/response';
import { normalizeE164 } from '@/lib/api/phone';
import {
  resolveVerifySender,
  NoSenderAvailableError,
} from '@/lib/api/verify-sender';
import { entitlementsFor } from '@/lib/api/entitlements';
import { isVerifiedRecipient } from '@/lib/api/verified-recipients';
import { getClientIp } from '@/lib/ip';
import { runShield } from '@/lib/api/verify-shield';
import { sendVerificationSms, VerifySendError } from '@/lib/api/verify-send';
import {
  createVerification,
  generateCode,
  getActiveVerification,
  recordBlocked,
  resendWaitMs,
  toPublicVerification,
} from '@/lib/api/verify-store';
import { emitEvent } from '@/lib/api/events';
import { isSandboxNumber, MAGIC_NUMBERS } from '@/lib/api/sandbox';
import type { ApiContext } from '@/lib/api/types';
import { hasOptedOut, logOptOutOverride } from '@/lib/api/opt-out';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /v1/verify - send a one-time code.
 *
 * Nothing here is billable: verifications are charged only when a code is
 * actually verified (see /v1/verify/check), so blocked, abandoned and expired
 * attempts cost the developer nothing.
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
    // Accept Twilio's `to` as an alias for `phone`. Migrating developers have
    // it in muscle memory, and rejecting it with "phone must be valid" makes
    // them think their NUMBER is wrong rather than their parameter name.
    const { app_name: appName, from: requestedFrom } = body;
    const phone = body.phone ?? body.to;

    const e164 = normalizeE164(phone);
    if (!e164) {
      return apiError(400, 'invalid_request', '`phone` must be a valid US/Canada number in E.164 format.', { param: 'phone' });
    }
    if (appName !== undefined && (typeof appName !== 'string' || appName.length > 24)) {
      return apiError(400, 'invalid_request', '`app_name` must be a string of 24 characters or fewer.', { param: 'app_name' });
    }

    const fromOverride = requestedFrom === undefined ? null : normalizeE164(requestedFrom);
    if (requestedFrom !== undefined && !fromOverride) {
      return apiError(400, 'invalid_request', '`from` must be a valid US/Canada number you own, or omitted to use the Delivered verification pool.', { param: 'from' });
    }

    // No number required: Delivered sends verifications from its own pool, the
    // same way Twilio Verify manages senders for you.
    let from: string;
    try {
      from = await resolveVerifySender({
        tenant: ctx.tenant,
        destination: e164,
        mode: ctx.mode,
        requestedFrom: fromOverride,
      });
    } catch (error) {
      if (error instanceof NoSenderAvailableError) {
        return apiError(400, 'invalid_request', error.message, { param: 'from' });
      }
      throw error;
    }

    // Deterministic cooldown for sandbox testing: real cooldown is disabled in
    // test mode so developers can iterate, so this number stands in for it.
    if (ctx.mode === 'test' && e164 === MAGIC_NUMBERS.VERIFY_COOLDOWN) {
      return apiError(
        429,
        'rate_limited',
        'A code was just sent to this number. Try again in 60s.',
        { retry_after: 60 },
        { 'Retry-After': '60' }
      );
    }

    // Resend cooldown (live only - see resendWaitMs).
    const existing = await getActiveVerification(ctx.tenantId, e164);
    const wait = resendWaitMs(existing);
    if (wait > 0) {
      const retryAfter = Math.ceil(wait / 1000);
      return apiError(
        429,
        'rate_limited',
        `A code was just sent to this number. Try again in ${retryAfter}s.`,
        // In the body as well as the header - plenty of clients only read JSON,
        // and a resend UI wants the number to render a countdown.
        { retry_after: retryAfter },
        { 'Retry-After': String(retryAfter) }
      );
    }

    // ── Sandbox: no carrier, no shield, no metering ──────────────────────────
    if (ctx.mode === 'test') {
      if (!isSandboxNumber(e164) && !isVerifiedRecipient(ctx.tenant, e164)) {
        // Sandbox is permissive, but keep the magic-number story coherent.
      }
      const record = await createVerification({
        tenantId: ctx.tenantId,
        phone: e164,
        code: '111111', // documented sandbox code
        test: true,
      });
      await emitEvent(ctx.tenantId, 'verification.sent', {
        verification_id: record.id,
        phone: e164,
        test: true,
      });
      return apiJson({ ...toPublicVerification(record), charged: false }, 201);
    }

    // ── Live ────────────────────────────────────────────────────────────────
    const ent = entitlementsFor(ctx.tenant);
    if (ent.verifiedRecipientsOnly && !isVerifiedRecipient(ctx.tenant, e164)) {
      return apiError(
        403,
        'recipient_not_verified',
        'Free accounts can only verify numbers you have verified in the console. Add a payment method to verify anyone.',
        { param: 'phone' }
      );
    }

    // One-time passcodes are exempt from opt-out: the user is asking for the
    // code by trying to log in, and blocking it locks them out of their own
    // account. Recorded rather than silent so the exemption is auditable.
    if (await hasOptedOut(ctx.tenantId, e164)) {
      await logOptOutOverride(ctx.tenantId, e164, 'verification_exempt');
      await emitEvent(ctx.tenantId, 'verification.sent_to_opted_out', {
        phone: e164,
        reason: 'transactional_exemption',
      });
    }

    const verdict = await runShield({ tenant: ctx.tenant, phone: e164, ip: getClientIp(req) });
    if (!verdict.allowed) {
      const blocked = await recordBlocked({
        tenantId: ctx.tenantId,
        phone: e164,
        reason: verdict.reason || 'blocked',
        test: false,
      });
      await emitEvent(ctx.tenantId, 'verification.blocked', {
        verification_id: blocked.id,
        phone: e164,
        reason: verdict.reason,
      });
      return apiError(
        403,
        'verification_blocked',
        verdict.message || 'This verification was blocked.',
        { reason: verdict.reason, charged: false },
        verdict.retryAfterSec ? { 'Retry-After': String(verdict.retryAfterSec) } : undefined
      );
    }

    const code = generateCode();
    const record = await createVerification({
      tenantId: ctx.tenantId,
      phone: e164,
      code,
      test: false,
    });

    try {
      await sendVerificationSms({
        from,
        to: e164,
        code,
        appName: typeof appName === 'string' ? appName : undefined,
      });
    } catch (error) {
      if (error instanceof VerifySendError) {
        console.error('[v1/verify] send failed:', error.message);
      }
      return apiError(502, 'carrier_error', 'The carrier could not deliver the code. Try again shortly.');
    }

    await emitEvent(ctx.tenantId, 'verification.sent', {
      verification_id: record.id,
      phone: e164,
    });

    return apiJson({ ...toPublicVerification(record), charged: false }, 201);
  },
  // Tighter than the 60/min default - one key should not be able to spray
  // verification sends even before the per-destination controls kick in.
  { rateLimit: { limit: 30, windowSec: 60 } }
);
