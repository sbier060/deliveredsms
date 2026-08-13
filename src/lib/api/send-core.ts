import { digits10 } from './phone';
import { db } from '@/lib/firebase-admin';
import { isUsOrCanadaNpa } from './nanp';
import { hasOptedOut } from './opt-out';
import { takeSlot } from './rate-limit';
import { DEFAULT_SANDBOX_QUOTAS } from './tenants';
import { MAGIC_NUMBERS } from './sandbox';
import { storeMessage, toPublicMessage } from './messages';
import { emitEvent } from './events';
import { takeQuota, takeQuotaDayMonth, refundQuotaDayMonth } from './usage';
import { entitlementsFor } from './entitlements';
import { isVerifiedRecipient } from './verified-recipients';
import { formatRate, RATES } from './pricing';
import { carrierSendSms, SendBlockedError, CarrierRejectedError } from './carrier/send-sms';
import { reportMeterEvent } from './billing/meter';
import type { ApiTenant, MessageStatus, PublicMessage } from './types';

/**
 * The one outbound-send pipeline. Extracted from POST /v1/messages verbatim so
 * its three consumers — the public API, the console composer, and the send
 * queue — cannot drift on the guards. The rule order is deliberate and load-
 * bearing: opt-out (both modes) → geo → velocity → verified-recipient → quota
 * → carrier → store → events → meter. Failed sends cost nothing, in quota and
 * in billing.
 */

export interface SendInput {
  to: string; // E.164, already validated by the caller
  from: string; // E.164, already validated as tenant-owned
  body: string;
  sentBy?: { uid?: string; name: string };
}

export type SendResult =
  | { ok: true; message: PublicMessage; headers: Record<string, string> }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
      param?: string;
      headers?: Record<string, string>;
    };

export async function sendOutbound(
  tenantId: string,
  tenant: ApiTenant,
  mode: 'test' | 'live',
  input: SendInput
): Promise<SendResult> {
  const { to: toE164, from: fromE164, body, sentBy } = input;

  // Opt-out is law, not policy. Checked in BOTH modes: the guards below are
  // abuse controls that only make sense against real carriers, but this one is
  // correctness, and a developer who cannot exercise it in sandbox ships an
  // integration that has never run the path.
  if (await hasOptedOut(tenantId, toE164)) {
    return {
      ok: false,
      status: 403,
      code: 'forbidden',
      message: 'This recipient has opted out of your messages. Sending to them is not permitted.',
      param: 'to',
    };
  }

  if (mode === 'live') {
    const ent = entitlementsFor(tenant);

    // Geography gate — same rule Verify enforces. +1 is not "US and Canada":
    // Caribbean NANP (Jamaica +1876, DR +1809…) is the classic SMS-pumping
    // corridor and passes every other validator.
    const allowedNpas = tenant.verifyAllowedNpas;
    const npaOk = allowedNpas
      ? allowedNpas.includes(digits10(toE164).slice(0, 3))
      : isUsOrCanadaNpa(toE164);
    if (!npaOk) {
      return {
        ok: false,
        status: 403,
        code: 'forbidden',
        message: 'Messages can only be sent to US and Canada numbers. Ask us if you need another region enabled.',
        param: 'to',
      };
    }

    // Per-destination velocity — one tenant (or several) hammering a single
    // handset is either a bug or abuse; neither should reach the carrier.
    const destSlot = await takeSlot(`msg_dest_${digits10(toE164)}`, 30, 60 * 60_000);
    if (!destSlot.allowed) {
      return {
        ok: false,
        status: 429,
        code: 'rate_limited',
        message: 'Too many messages to this number recently.',
        headers: destSlot.retryAfterSec ? { 'Retry-After': String(destSlot.retryAfterSec) } : undefined,
      };
    }

    // Free tier sends only to numbers the developer has verified. Checked
    // BEFORE the quota take so a rejected recipient never burns an allowance.
    if (ent.verifiedRecipientsOnly && !isVerifiedRecipient(tenant, toE164)) {
      return {
        ok: false,
        status: 403,
        code: 'recipient_not_verified',
        message:
          'Free accounts can only text numbers you have verified. Verify one in the console (Billing → Verified numbers), or add a payment method to text anyone.',
        param: 'to',
      };
    }

    const quota = await takeQuotaDayMonth(tenantId, 'messages_sent', ent.messagesPerDay, ent.messagesPerMonth);
    if (!quota.allowed) {
      const message =
        quota.reason === 'month'
          ? `Free monthly limit reached (${quota.month.limit} messages). Add a payment method to keep sending at ${formatRate(RATES.outbound_sms.microUsd)} per message.`
          : `Daily limit reached (${quota.day.limit}/day).`;
      return { ok: false, status: 429, code: 'quota_exceeded', message, headers: { 'X-Quota-Remaining': '0' } };
    }

    let referenceId: string;
    try {
      ({ referenceId } = await carrierSendSms({ from: fromE164, to: toE164, body }));
    } catch (error) {
      // The message never left, so give the allowance back — "failed sends
      // cost nothing" has to be true of quota, not just of billing.
      refundQuotaDayMonth(tenantId, 'messages_sent');
      if (error instanceof SendBlockedError) {
        return { ok: false, status: 403, code: 'forbidden', message: error.message };
      }
      // A carrier rejection is a real outcome, not just an HTTP error: store
      // the failed message with the broker's own reason and emit
      // message.failed, so delivery reporting shows WHY, not only that.
      const reason = error instanceof CarrierRejectedError ? error.detail : 'carrier_unavailable';
      const failed = await storeMessage(tenantId, {
        to: toE164,
        from: fromE164,
        body,
        direction: 'outbound',
        status: 'failed',
        test: false,
        failureReason: reason,
        ...(sentBy ? { sentBy } : {}),
      });
      await emitEvent(tenantId, 'message.failed', {
        message_id: failed.id,
        to: toE164,
        code: 'carrier_rejected',
        reason,
      });
      console.error('[send-core] carrier send failed:', error);
      return { ok: false, status: 502, code: 'carrier_error', message: 'The carrier rejected this message. Try again shortly.' };
    }

    const stored = await storeMessage(tenantId, {
      to: toE164,
      from: fromE164,
      body,
      direction: 'outbound',
      status: 'sent',
      test: false,
      carrierMessageId: referenceId,
      ...(sentBy ? { sentBy } : {}),
    });
    await emitEvent(tenantId, 'message.sent', {
      message_id: stored.id,
      to: toE164,
      from: fromE164,
      carrier_reference: referenceId,
    });

    // DLR seam: when delivery receipts land (carrier work), the callback will
    // carry this referenceId and needs to find the message. Written now so
    // receipts light up historical sends the moment the carrier side ships.
    db.ref(`apiCarrierRefs/${referenceId.replace(/[.#$/\[\]]/g, '_')}`)
      .set({ tenantId, messageId: stored.id, at: Date.now() })
      .catch(() => {});

    // Bill only after the carrier accepted it.
    if (ent.meterEvents && tenant.billing?.stripeCustomerId) {
      reportMeterEvent({ tenantId, customerId: tenant.billing.stripeCustomerId, meter: 'outbound_sms' });
    }

    const headers: Record<string, string> = {
      'X-Quota-Remaining': String(Math.max(0, quota.day.limit - quota.day.used)),
    };
    if (quota.month.limit !== null) {
      headers['X-Quota-Remaining-Month'] = String(Math.max(0, quota.month.limit - quota.month.used));
    }
    return { ok: true, message: toPublicMessage(stored), headers };
  }

  // ── Sandbox ──────────────────────────────────────────────────────────────
  // Ceiling is abuse prevention only — deliberately NOT reduced by live-quota
  // tuning (an admin dialling live limits down must never break tests).
  const sandboxCeiling = Math.max(tenant.quotas.messagesPerDay, DEFAULT_SANDBOX_QUOTAS.messagesPerDay);
  const quota = await takeQuota(tenantId, 'messages_test', sandboxCeiling);
  if (!quota.allowed) {
    return {
      ok: false,
      status: 429,
      code: 'quota_exceeded',
      message: `Daily sandbox message quota reached (${quota.limit}/day).`,
      headers: { 'X-Quota-Remaining': '0' },
    };
  }

  let status: MessageStatus = 'sent';
  if (toE164 === MAGIC_NUMBERS.QUEUED_FOREVER) status = 'queued';
  if (toE164 === MAGIC_NUMBERS.FAIL) status = 'failed';

  const stored = await storeMessage(tenantId, {
    to: toE164,
    from: fromE164,
    body,
    direction: 'outbound',
    status,
    test: true,
    ...(sentBy ? { sentBy } : {}),
  });

  await emitEvent(tenantId, 'message.sent', { message_id: stored.id, to: toE164, from: fromE164 });
  if (status === 'failed') {
    await emitEvent(tenantId, 'message.failed', { message_id: stored.id, to: toE164, code: 'undeliverable' });
  } else if (status === 'sent') {
    await emitEvent(tenantId, 'message.delivered', { message_id: stored.id, to: toE164 }, Date.now() + 2000);
  }

  return {
    ok: true,
    message: toPublicMessage(stored),
    headers: { 'X-Quota-Remaining': String(Math.max(0, quota.limit - quota.used)) },
  };
}
