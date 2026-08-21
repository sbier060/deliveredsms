import { createHash, randomInt } from 'crypto';
import { db } from '@/lib/firebase-admin';
import { sendNoReplyMail, isNoReplyConfigured } from '@/lib/noreply-email';

/**
 * Email one-time-passcode second factor for password sign-ins.
 *
 * Password auth alone is one factor; this layer emails a 6-digit code after a
 * successful password sign-in and the console's server routes refuse to serve
 * until the code is verified for THIS sign-in (verifiedAt >= token auth_time).
 * Google sign-ins skip it - they are federated logins with Google's own 2FA.
 *
 * If the no-reply mailer is not configured (missing Gmail env), enforcement is
 * skipped rather than locking every user out; `challengeStatus` reports
 * 'unavailable' so the client can proceed. Configure NOREPLY_GMAIL_USER +
 * NOREPLY_GMAIL_APP_PASSWORD to activate enforcement.
 *
 * RTDB layout (admin-only, database rules are locked):
 *   mfa/challenges/{uid} = { hash, expiresAt, attempts, lastSentAt, email }
 *   mfa/verified/{uid}   = { verifiedAt }
 */

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

type Challenge = {
  hash: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
  email: string;
};

export function mfaAvailable(): boolean {
  return isNoReplyConfigured();
}

/** Has this uid verified a code since the current sign-in? */
export async function isMfaVerified(uid: string, authTimeSec: number): Promise<boolean> {
  const snap = await db.ref(`mfa/verified/${uid}/verifiedAt`).get();
  const verifiedAt = snap.val() as number | null;
  return !!verifiedAt && verifiedAt >= authTimeSec * 1000;
}

export async function sendMfaCode(
  uid: string,
  email: string
): Promise<'sent' | 'cooldown' | 'unavailable' | 'send_failed'> {
  if (!mfaAvailable()) return 'unavailable';

  const ref = db.ref(`mfa/challenges/${uid}`);
  const existing = (await ref.get()).val() as Challenge | null;
  const now = Date.now();
  if (existing && now - existing.lastSentAt < RESEND_COOLDOWN_MS) return 'cooldown';

  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  await ref.set({
    hash: sha256(`${uid}:${code}`),
    expiresAt: now + CODE_TTL_MS,
    attempts: 0,
    lastSentAt: now,
    email,
  } satisfies Challenge);

  const ok = await sendNoReplyMail({
    to: email,
    subject: `${code} is your Resms verification code`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px 0;color:#1a1a1a">
        <p style="font-size:15px">Your Resms verification code:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</p>
        <p style="font-size:13px;color:#666">It expires in 10 minutes. If you didn't try to sign in,
        change your password and contact support@resms.com.</p>
      </div>`,
  });
  if (!ok) {
    await ref.remove();
    return 'send_failed';
  }
  return 'sent';
}

export async function verifyMfaCode(
  uid: string,
  code: string
): Promise<'verified' | 'invalid' | 'expired' | 'too_many_attempts' | 'no_challenge'> {
  const ref = db.ref(`mfa/challenges/${uid}`);
  const challenge = (await ref.get()).val() as Challenge | null;
  if (!challenge) return 'no_challenge';
  if (Date.now() > challenge.expiresAt) {
    await ref.remove();
    return 'expired';
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    await ref.remove();
    return 'too_many_attempts';
  }
  if (sha256(`${uid}:${code.trim()}`) !== challenge.hash) {
    await ref.child('attempts').set(challenge.attempts + 1);
    return 'invalid';
  }
  await ref.remove();
  await db.ref(`mfa/verified/${uid}`).set({ verifiedAt: Date.now() });
  return 'verified';
}
