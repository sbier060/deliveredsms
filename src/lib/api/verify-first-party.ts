import { db } from '@/lib/firebase-admin';
import { normalizeE164 } from './phone';
import { isUsOrCanadaNpa } from './nanp';
import { runShield } from './verify-shield';
import {
  resolveVerifySender,
  NoSenderAvailableError,
} from './verify-sender';
import { sendVerificationSms, VerifySendError } from './verify-send';
import {
  createVerification,
  checkCode,
  generateCode,
  getActiveVerification,
  recordBlocked,
  resendWaitMs,
  MAX_ATTEMPTS,
  type CheckOutcome,
} from './verify-store';
import { emitEvent } from './events';
import type { ApiTenant } from './types';
import { hasOptedOut, logOptOutOverride } from './opt-out';

/**
 * Delivered Verify for Delivered's OWN consumer surfaces.
 *
 * The web app used to pay Twilio ~$0.05 per verification for the exact
 * primitive this product sells for $0.025 and delivers for ~$0.002. Running
 * our own consumer verification on Delivered Verify removes that cost and the
 * Twilio dependency, and - more usefully - means the code path developers pay
 * for is the one we break first if we regress it.
 *
 * This is a LIBRARY, not a route change: the existing Twilio routes
 * (/api/send-verification-code, /api/verify-phone-code, /api/twilio-*) are left
 * byte-identical per DEPLOYMENT.md rule 2, and stay in place as the fallback
 * for destinations Delivered Verify does not serve.
 */

/**
 * The synthetic tenant first-party traffic runs as.
 *
 * `internal: true` short-circuits entitlementsFor() before it reads billing
 * state, so this can never be metered or invoiced - not now, and not after
 * API billing is switched on. Ghost does not bill Ghost.
 */
export const FIRST_PARTY_TENANT_ID = 'tn_ghost_web';

const FIRST_PARTY_TENANT: ApiTenant = {
  id: FIRST_PARTY_TENANT_ID,
  uid: 'ghost-web',
  email: 'support@deliveredsms.com',
  name: 'Ghost (web app)',
  status: 'live',
  internal: true,
  quotas: { messagesPerDay: 100_000, numbersMax: 0, lookupsPerDay: 100_000 },
  createdAt: 0,
};

export type FirstPartySendResult =
  | { ok: true; verificationId: string }
  /** Delivered Verify does not serve this destination - caller should fall back. */
  | { ok: false; kind: 'unsupported'; message: string }
  /** A deliberate policy block (velocity, VoIP, opt-out). Do NOT fall back. */
  | { ok: false; kind: 'blocked'; message: string; retryAfterSec?: number }
  /** Ghost-side failure (no sender, carrier down). Caller may fall back. */
  | { ok: false; kind: 'unavailable'; message: string };

/**
 * Send a verification code to one of our own users.
 *
 * `unsupported` and `unavailable` are distinguishable from `blocked` on
 * purpose: the first two mean "Delivered Verify can't do this one, use the old
 * path", while `blocked` is a decision we made and must not be routed around.
 */
export async function sendFirstPartyVerification(input: {
  phone: string;
  ip: string;
  appName?: string;
}): Promise<FirstPartySendResult> {
  const e164 = normalizeE164(input.phone);
  // Non-NANP entirely (+44, +91, …) - normalizeE164 rejects it outright.
  if (!e164) {
    return { ok: false, kind: 'unsupported', message: 'Not a US or Canada number.' };
  }
  // NANP but not US/CA (Jamaica +1876, Dominican Republic +1809 …). These pass
  // every other validator in the repo and are the classic SMS-pumping target,
  // so Delivered Verify does not serve them - but a real consumer with a Caribbean
  // phone still deserves to verify, hence `unsupported` rather than `blocked`.
  if (!isUsOrCanadaNpa(e164)) {
    return { ok: false, kind: 'unsupported', message: 'Not a US or Canada number.' };
  }

  const existing = await getActiveVerification(FIRST_PARTY_TENANT_ID, e164);
  const wait = resendWaitMs(existing);
  if (wait > 0) {
    const retryAfterSec = Math.ceil(wait / 1000);
    return {
      ok: false,
      kind: 'blocked',
      message: `A code was just sent. Try again in ${retryAfterSec}s.`,
      retryAfterSec,
    };
  }

  // Transactional exemption - see /v1/verify. A user who opted out of this
  // tenant's marketing still needs their login code.
  if (await hasOptedOut(FIRST_PARTY_TENANT_ID, e164)) {
    await logOptOutOverride(FIRST_PARTY_TENANT_ID, e164, 'first_party_verification_exempt');
  }

  const verdict = await runShield({ tenant: FIRST_PARTY_TENANT, phone: e164, ip: input.ip });
  if (!verdict.allowed) {
    await recordBlocked({
      tenantId: FIRST_PARTY_TENANT_ID,
      phone: e164,
      reason: verdict.reason || 'blocked',
      test: false,
    });
    await emitEvent(FIRST_PARTY_TENANT_ID, 'verification.blocked', {
      phone: e164,
      reason: verdict.reason,
      source: 'web_app',
    });
    return {
      ok: false,
      kind: 'blocked',
      message: verdict.message || 'This verification was blocked.',
      retryAfterSec: verdict.retryAfterSec,
    };
  }

  let from: string;
  try {
    from = await resolveVerifySender({
      tenant: FIRST_PARTY_TENANT,
      destination: e164,
      mode: 'live',
      requestedFrom: null,
    });
  } catch (error) {
    if (error instanceof NoSenderAvailableError) {
      console.error('[verify-first-party] no sender available:', error.message);
      return { ok: false, kind: 'unavailable', message: 'Verification is temporarily unavailable.' };
    }
    throw error;
  }

  const code = generateCode();
  const record = await createVerification({
    tenantId: FIRST_PARTY_TENANT_ID,
    phone: e164,
    code,
    test: false,
  });

  try {
    await sendVerificationSms({ from, to: e164, code, appName: input.appName || 'Ghost' });
  } catch (error) {
    if (error instanceof VerifySendError) {
      console.error('[verify-first-party] send failed:', error.message);
    }
    return { ok: false, kind: 'unavailable', message: 'Could not send the code right now.' };
  }

  await emitEvent(FIRST_PARTY_TENANT_ID, 'verification.sent', {
    verification_id: record.id,
    phone: e164,
    source: 'web_app',
  });

  return { ok: true, verificationId: record.id };
}

export type FirstPartyCheckResult =
  | { verified: true }
  | { verified: false; message: string; attemptsRemaining: number };

/** Check a code a user submitted. Never falls back - the code is ours or it isn't. */
export async function checkFirstPartyVerification(input: {
  phone: string;
  code: string;
}): Promise<FirstPartyCheckResult> {
  const e164 = normalizeE164(input.phone);
  if (!e164) {
    return { verified: false, message: 'That code has expired. Request a new one.', attemptsRemaining: 0 };
  }

  const outcome: CheckOutcome = await checkCode(
    FIRST_PARTY_TENANT_ID,
    e164,
    String(input.code).trim()
  );

  if (outcome.result === 'approved') {
    await emitEvent(FIRST_PARTY_TENANT_ID, 'verification.approved', {
      verification_id: outcome.record.id,
      phone: e164,
      source: 'web_app',
    });
    return { verified: true };
  }

  if (outcome.result === 'not_found') {
    return {
      verified: false,
      message: 'That code has expired. Request a new one.',
      attemptsRemaining: 0,
    };
  }

  await emitEvent(FIRST_PARTY_TENANT_ID, 'verification.failed', {
    verification_id: outcome.record.id,
    phone: e164,
    result: outcome.result,
    source: 'web_app',
  });

  const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - outcome.record.attempts);
  if (outcome.result === 'expired') {
    return { verified: false, message: 'That code expired. Request a new one.', attemptsRemaining: 0 };
  }
  if (outcome.result === 'max_attempts') {
    return { verified: false, message: 'Too many attempts. Request a new code.', attemptsRemaining: 0 };
  }
  return {
    verified: false,
    message: attemptsRemaining
      ? `Incorrect code. ${attemptsRemaining} ${attemptsRemaining === 1 ? 'try' : 'tries'} left.`
      : 'Incorrect code. Request a new one.',
    attemptsRemaining,
  };
}

/**
 * Persist the verified number exactly as /api/verify-phone-code does.
 *
 * These three fields are read by the iOS app and by number provisioning, so
 * the write is a superset of what the Twilio route wrote - never a subset.
 */
export async function saveVerifiedPhone(userId: string, phoneNumber: string): Promise<void> {
  await db.ref(`users/${userId}`).update({
    realPhoneNumber: phoneNumber,
    phoneVerified: true,
    phoneVerifiedAt: new Date().toISOString(),
  });
}
