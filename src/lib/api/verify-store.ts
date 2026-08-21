import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { db } from '@/lib/firebase-admin';
import { randomBase62 } from './ids';
import { digits10 } from './phone';

/**
 * OTP store for Resms Verify.
 *
 * We generate and check codes ourselves rather than proxying Twilio Verify:
 * Twilio charges ~$0.05 per verification against our $0.025 price, so
 * reselling it is a structural loss. Owning the store also means we own the
 * TTL, attempt and cooldown policy instead of inheriting Twilio's.
 *
 * Codes are stored sha256-hashed and compared in constant time - the same
 * treatment API keys get in keys.ts. A plaintext code never touches RTDB and
 * never appears in a log line.
 */

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60 * 1000;

export type VerificationStatus =
  | 'pending'
  | 'approved'
  | 'expired'
  | 'max_attempts'
  | 'blocked';

export interface VerificationRecord {
  id: string;
  tenantId: string;
  phone: string;
  codeHash: string;
  status: VerificationStatus;
  attempts: number;
  test: boolean;
  createdAt: number;
  expiresAt: number;
  approvedAt?: number;
  blockedReason?: string;
  /** Set once, when the successful check has been billed. */
  chargedAt?: number;
}

export interface PublicVerification {
  id: string;
  object: 'verification';
  phone: string;
  status: VerificationStatus;
  attempts: number;
  /** Checks left before the code dies - so a UI can say "2 tries left". */
  attempts_remaining: number;
  max_attempts: number;
  test: boolean;
  created_at: string;
  expires_at: string;
  /** Seconds until expiry, so a countdown needs no clock maths. */
  expires_in: number;
}

export const newVerificationId = () => `ver_${randomBase62(16)}`;

function hashCode(id: string, code: string): string {
  // Salted with the verification id so identical codes across verifications
  // don't produce identical hashes.
  return createHash('sha256').update(`${id}:${code}`).digest('hex');
}

/** Crypto-strong 6-digit code, zero-padded. */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function toPublicVerification(v: VerificationRecord): PublicVerification {
  return {
    id: v.id,
    object: 'verification',
    phone: v.phone,
    status: v.status,
    attempts: v.attempts,
    attempts_remaining: Math.max(0, MAX_ATTEMPTS - v.attempts),
    max_attempts: MAX_ATTEMPTS,
    test: v.test,
    created_at: new Date(v.createdAt).toISOString(),
    expires_at: new Date(v.expiresAt).toISOString(),
    expires_in: Math.max(0, Math.round((v.expiresAt - Date.now()) / 1000)),
  };
}

const activeRef = (tenantId: string, phone: string) =>
  db.ref(`apiVerificationsByPhone/${tenantId}/${digits10(phone)}`);

const recordRef = (tenantId: string, id: string) =>
  db.ref(`apiVerifications/${tenantId}/${id}`);

/** The tenant's current verification for this phone, if any. */
export async function getActiveVerification(
  tenantId: string,
  phone: string
): Promise<VerificationRecord | null> {
  const idSnap = await activeRef(tenantId, phone).get();
  if (!idSnap.exists()) return null;
  return getVerification(tenantId, idSnap.val() as string);
}

export async function getVerification(
  tenantId: string,
  id: string
): Promise<VerificationRecord | null> {
  const snap = await recordRef(tenantId, id).get();
  return snap.exists() ? (snap.val() as VerificationRecord) : null;
}

/** How long until this phone may be sent another code, in ms (0 = now). */
export function resendWaitMs(record: VerificationRecord | null): number {
  if (!record) return 0;
  // Sandbox has no cooldown: a developer testing their "resend" button should
  // not be locked out for a minute per iteration. Live still enforces it, and
  // the magic COOLDOWN number lets the 429 path be tested deterministically.
  if (record.test) return 0;
  const elapsed = Date.now() - record.createdAt;
  return elapsed >= RESEND_COOLDOWN_MS ? 0 : RESEND_COOLDOWN_MS - elapsed;
}

export async function createVerification(input: {
  tenantId: string;
  phone: string;
  code: string;
  test: boolean;
}): Promise<VerificationRecord> {
  const id = newVerificationId();
  const now = Date.now();
  const record: VerificationRecord = {
    id,
    tenantId: input.tenantId,
    phone: input.phone,
    codeHash: hashCode(id, input.code),
    status: 'pending',
    attempts: 0,
    test: input.test,
    createdAt: now,
    expiresAt: now + CODE_TTL_MS,
  };
  await recordRef(input.tenantId, id).set(record);
  await activeRef(input.tenantId, input.phone).set(id);
  return record;
}

export type CheckOutcome =
  | { result: 'approved'; record: VerificationRecord }
  | { result: 'invalid'; record: VerificationRecord }
  | { result: 'expired'; record: VerificationRecord }
  | { result: 'max_attempts'; record: VerificationRecord }
  | { result: 'not_found' };

/**
 * Check a submitted code against the active verification for this phone.
 * Terminal states (approved / expired / max_attempts) clear the active
 * pointer so a fresh send can start cleanly.
 */
export async function checkCode(
  tenantId: string,
  phone: string,
  code: string
): Promise<CheckOutcome> {
  const record = await getActiveVerification(tenantId, phone);
  if (!record) return { result: 'not_found' };

  if (record.status === 'approved') {
    // Already used - do not allow a second success on one verification.
    return { result: 'max_attempts', record };
  }

  if (Date.now() > record.expiresAt) {
    const updated = { ...record, status: 'expired' as const };
    await recordRef(tenantId, record.id).update({ status: 'expired' });
    await activeRef(tenantId, phone).remove();
    return { result: 'expired', record: updated };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    const updated = { ...record, status: 'max_attempts' as const };
    await recordRef(tenantId, record.id).update({ status: 'max_attempts' });
    await activeRef(tenantId, phone).remove();
    return { result: 'max_attempts', record: updated };
  }

  const attempts = record.attempts + 1;
  const submitted = Buffer.from(hashCode(record.id, code));
  const stored = Buffer.from(record.codeHash);
  const match =
    submitted.length === stored.length && timingSafeEqual(submitted, stored);

  if (match) {
    const updated = {
      ...record,
      attempts,
      status: 'approved' as const,
      approvedAt: Date.now(),
    };
    await recordRef(tenantId, record.id).update({
      attempts,
      status: 'approved',
      approvedAt: updated.approvedAt,
    });
    await activeRef(tenantId, phone).remove();
    return { result: 'approved', record: updated };
  }

  const exhausted = attempts >= MAX_ATTEMPTS;
  const status = exhausted ? ('max_attempts' as const) : ('pending' as const);
  await recordRef(tenantId, record.id).update({ attempts, status });
  if (exhausted) await activeRef(tenantId, phone).remove();
  return {
    result: exhausted ? 'max_attempts' : 'invalid',
    record: { ...record, attempts, status },
  };
}

/**
 * Mark a successful verification as billed. Returns true only the first time,
 * so a replayed check can never bill twice.
 */
export async function markCharged(tenantId: string, id: string): Promise<boolean> {
  const result = await recordRef(tenantId, id)
    .child('chargedAt')
    .transaction((current) => (current === null ? Date.now() : undefined));
  return result.committed;
}

export async function recordBlocked(input: {
  tenantId: string;
  phone: string;
  reason: string;
  test: boolean;
}): Promise<VerificationRecord> {
  const id = newVerificationId();
  const now = Date.now();
  const record: VerificationRecord = {
    id,
    tenantId: input.tenantId,
    phone: input.phone,
    codeHash: '',
    status: 'blocked',
    attempts: 0,
    test: input.test,
    createdAt: now,
    expiresAt: now,
    blockedReason: input.reason,
  };
  await recordRef(input.tenantId, id).set(record);
  return record;
}
