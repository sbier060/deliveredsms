import { NextRequest } from 'next/server';
import { withApiKey } from '@/lib/api/auth';
import { apiError, apiJson, apiList } from '@/lib/api/response';
import { normalizeE164, digits10 } from '@/lib/api/phone';
import { isUsOrCanadaNpa } from '@/lib/api/nanp';
import { hasOptedOut } from '@/lib/api/opt-out';
import { takeSlot } from '@/lib/api/rate-limit';
import { activeNumbers, DEFAULT_SANDBOX_QUOTAS } from '@/lib/api/tenants';
import { MAGIC_NUMBERS } from '@/lib/api/sandbox';
import { storeMessage, listMessages, toPublicMessage } from '@/lib/api/messages';
import { emitEvent } from '@/lib/api/events';
import { checkIdempotency, saveIdempotentResponse } from '@/lib/api/idempotency';
import { takeQuota, takeQuotaDayMonth, refundQuotaDayMonth } from '@/lib/api/usage';
import { entitlementsFor } from '@/lib/api/entitlements';
import { isVerifiedRecipient } from '@/lib/api/verified-recipients';
import { formatRate, RATES } from '@/lib/api/pricing';
import { carrierSendSms, SendBlockedError } from '@/lib/api/carrier/send-sms';
import { reportMeterEvent } from '@/lib/api/billing/meter';
import type { ApiContext, MessageStatus } from '@/lib/api/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

export const POST = withApiKey(async (req: NextRequest, ctx: ApiContext) => {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError(400, 'invalid_request', 'Request body must be JSON.');
  }
  const { to, from, body } = (raw || {}) as Record<string, unknown>;

  const toE164 = normalizeE164(to);
  const fromE164 = normalizeE164(from);
  if (!toE164) {
    return apiError(400, 'invalid_request', '`to` must be a valid US/Canada number in E.164 format.', { param: 'to' });
  }
  if (!fromE164) {
    return apiError(400, 'invalid_request', '`from` must be a valid US/Canada number in E.164 format.', { param: 'from' });
  }
  if (typeof body !== 'string' || body.length === 0) {
    return apiError(400, 'invalid_request', '`body` is required.', { param: 'body' });
  }
  if (body.length > 1600) {
    return apiError(400, 'invalid_request', '`body` must be 1600 characters or fewer.', { param: 'body' });
  }
  if (!activeNumbers(ctx.tenant).includes(fromE164)) {
    return apiError(
      403,
      'forbidden',
      `\`from\` must be a number owned by your account. Your numbers: ${activeNumbers(ctx.tenant).join(', ') || '(none)'}.`,
      { param: 'from' }
    );
  }

  // Idempotency
  const idemKey = req.headers.get('idempotency-key');
  if (idemKey) {
    const check = await checkIdempotency(ctx.tenantId, idemKey, { to: toE164, from: fromE164, body });
    if (check.kind === 'replay') return apiJson(check.body, check.status);
    if (check.kind === 'conflict') {
      return apiError(409, 'idempotency_conflict', 'This Idempotency-Key was already used with a different request (or the original request is still in flight).');
    }
  }

  // Opt-out is law, not policy. Checked in BOTH modes: the guards below are
  // abuse controls that only make sense against real carriers, but this one is
  // correctness, and a developer who cannot exercise it in sandbox ships an
  // integration that has never run the path.
  if (await hasOptedOut(ctx.tenantId, toE164)) {
    return apiError(
      403,
      'forbidden',
      'This recipient has opted out of your messages. Sending to them is not permitted.',
      { param: 'to' }
    );
  }

  if (ctx.mode === 'live') {
    const ent = entitlementsFor(ctx.tenant);

    // Geography gate — same rule Verify enforces. +1 is not "US and Canada":
    // Caribbean NANP (Jamaica +1876, DR +1809…) is the classic SMS-pumping
    // corridor and passes every other validator. Without this, plain sends
    // are an open pumping path even though Verify's door is locked.
    const allowedNpas = ctx.tenant.verifyAllowedNpas;
    const npaOk = allowedNpas
      ? allowedNpas.includes(digits10(toE164).slice(0, 3))
      : isUsOrCanadaNpa(toE164);
    if (!npaOk) {
      return apiError(
        403,
        'forbidden',
        'Messages can only be sent to US and Canada numbers. Ask us if you need another region enabled.',
        { param: 'to' }
      );
    }

    // Per-destination velocity — one tenant (or several) hammering a single
    // handset is either a bug or abuse; neither should reach the carrier.
    const destSlot = await takeSlot(`msg_dest_${digits10(toE164)}`, 30, 60 * 60_000);
    if (!destSlot.allowed) {
      return apiError(
        429,
        'rate_limited',
        'Too many messages to this number recently.',
        { retry_after: destSlot.retryAfterSec },
        destSlot.retryAfterSec ? { 'Retry-After': String(destSlot.retryAfterSec) } : undefined
      );
    }

    // Free tier sends only to numbers the developer has verified — the same
    // idea as verifying a domain before you can email anyone. Checked BEFORE
    // the quota take so a rejected recipient never burns an allowance unit.
    if (ent.verifiedRecipientsOnly && !isVerifiedRecipient(ctx.tenant, toE164)) {
      return apiError(
        403,
        'recipient_not_verified',
        'Free accounts can only text numbers you have verified. Verify one in the console (Billing → Verified numbers), or add a payment method to text anyone.',
        { param: 'to' }
      );
    }

    const quota = await takeQuotaDayMonth(
      ctx.tenantId,
      'messages_sent',
      ent.messagesPerDay,
      ent.messagesPerMonth
    );
    if (!quota.allowed) {
      const message =
        quota.reason === 'month'
          ? `Free monthly limit reached (${quota.month.limit} messages). Add a payment method to keep sending at ${formatRate(RATES.outbound_sms.microUsd)} per message.`
          : `Daily limit reached (${quota.day.limit}/day).`;
      return apiError(429, 'quota_exceeded', message, undefined, {
        'X-Quota-Remaining': '0',
      });
    }

    let referenceId: string;
    try {
      ({ referenceId } = await carrierSendSms({ from: fromE164, to: toE164, body }));
    } catch (error) {
      // The message never left, so give the allowance back — "failed sends
      // cost nothing" has to be true of quota, not just of billing.
      refundQuotaDayMonth(ctx.tenantId, 'messages_sent');
      if (error instanceof SendBlockedError) {
        return apiError(403, 'forbidden', error.message);
      }
      console.error('[v1/messages] carrier send failed:', error);
      return apiError(502, 'carrier_error', 'The carrier rejected this message. Try again shortly.');
    }

    const stored = await storeMessage(ctx.tenantId, {
      to: toE164,
      from: fromE164,
      body,
      direction: 'outbound',
      status: 'sent',
      test: false,
    });
    await emitEvent(ctx.tenantId, 'message.sent', {
      message_id: stored.id,
      to: toE164,
      from: fromE164,
      carrier_reference: referenceId,
    });

    // Bill only after the carrier accepted it — "failed sends cost nothing".
    if (ent.meterEvents && ctx.tenant.billing?.stripeCustomerId) {
      reportMeterEvent({
        tenantId: ctx.tenantId,
        customerId: ctx.tenant.billing.stripeCustomerId,
        meter: 'outbound_sms',
      });
    }

    const publicMessage = toPublicMessage(stored);
    if (idemKey) saveIdempotentResponse(ctx.tenantId, idemKey, 201, publicMessage);
    const headers: Record<string, string> = {
      'X-Quota-Remaining': String(Math.max(0, quota.day.limit - quota.day.used)),
    };
    if (quota.month.limit !== null) {
      headers['X-Quota-Remaining-Month'] = String(
        Math.max(0, quota.month.limit - quota.month.used)
      );
    }
    return apiJson(publicMessage, 201, headers);
  }

  // Sandbox ceiling is abuse prevention only — sandbox costs us nothing, so it
  // is deliberately NOT reduced by live-quota tuning (an admin dialling live
  // limits down must never break a developer's test environment).
  const sandboxCeiling = Math.max(
    ctx.tenant.quotas.messagesPerDay,
    DEFAULT_SANDBOX_QUOTAS.messagesPerDay
  );
  const quota = await takeQuota(ctx.tenantId, 'messages_test', sandboxCeiling);
  if (!quota.allowed) {
    return apiError(429, 'quota_exceeded', `Daily sandbox message quota reached (${quota.limit}/day).`, undefined, {
      'X-Quota-Remaining': '0',
    });
  }

  // Simulated delivery per magic number
  let status: MessageStatus = 'sent';
  if (toE164 === MAGIC_NUMBERS.QUEUED_FOREVER) status = 'queued';
  if (toE164 === MAGIC_NUMBERS.FAIL) status = 'failed';

  const stored = await storeMessage(ctx.tenantId, {
    to: toE164,
    from: fromE164,
    body,
    direction: 'outbound',
    status,
    test: true,
  });

  await emitEvent(ctx.tenantId, 'message.sent', { message_id: stored.id, to: toE164, from: fromE164 });
  if (status === 'failed') {
    await emitEvent(ctx.tenantId, 'message.failed', { message_id: stored.id, to: toE164, code: 'undeliverable' });
  } else if (status === 'sent') {
    await emitEvent(ctx.tenantId, 'message.delivered', { message_id: stored.id, to: toE164 }, Date.now() + 2000);
  }

  const publicMessage = toPublicMessage(stored);
  if (idemKey) saveIdempotentResponse(ctx.tenantId, idemKey, 201, publicMessage);
  return apiJson(publicMessage, 201, {
    'X-Quota-Remaining': String(Math.max(0, quota.limit - quota.used)),
  });
});

export const GET = withApiKey(async (req: NextRequest, ctx: ApiContext) => {
  const url = req.nextUrl;
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 25));
  const cursor = url.searchParams.get('cursor');
  const numberParam = url.searchParams.get('number');
  const number = numberParam ? normalizeE164(numberParam) : null;
  if (numberParam && !number) {
    return apiError(400, 'invalid_request', '`number` must be a valid US/Canada number.', { param: 'number' });
  }
  const page = await listMessages(ctx.tenantId, { limit, cursor, number });
  return apiList(page.data, page.hasMore, page.nextCursor);
});
