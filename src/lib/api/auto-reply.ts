import { db } from '@/lib/firebase-admin';
import { digits10 } from './phone';

/**
 * Per-number auto-replies with optional office hours.
 *
 *   apiAutoReply/{tenantId}/{numberDigits} = AutoReplyConfig
 *   apiAutoReplyState/{tenantId}/{convKey}/lastSentAt   (cooldown claims)
 *
 * The guard set is ported from Ghost's autoReplySms (the consumer function):
 * never answer a verification code, never answer an opted-out counterparty,
 * and claim the cooldown atomically BEFORE sending so concurrent inbound
 * messages cannot double-send.
 */

export interface OfficeHours {
  /** IANA zone, e.g. "America/New_York". */
  tz: string;
  /** 0=Sunday … 6=Saturday. Days considered "open". */
  days: number[];
  /** "09:00" */
  start: string;
  /** "17:00" */
  end: string;
  /** always: reply whenever enabled. after_hours: reply only OUTSIDE hours. */
  mode: 'always' | 'after_hours';
}

export interface AutoReplyConfig {
  enabled: boolean;
  message: string;
  officeHours?: OfficeHours;
}

const COOLDOWN_MS = 4 * 60 * 60_000;
export const AUTO_REPLY_MAX_LENGTH = 320;

/** Ported from the consumer pipeline: bodies that are (or carry) OTP codes. */
const VERIFICATION_PATTERNS: RegExp[] = [
  /\b\d{4,8}\b.*\b(code|verification|verify|otp|passcode|pin)\b/i,
  /\b(code|verification|verify|otp|passcode|pin)\b.*\b\d{4,8}\b/i,
  /^\s*\d{4,8}\s*$/,
  /\bG-\d{6}\b/,
];

export function looksLikeVerificationCode(body: string): boolean {
  return VERIFICATION_PATTERNS.some((re) => re.test(body));
}

export async function getAutoReply(tenantId: string, ourNumber: string): Promise<AutoReplyConfig | null> {
  const snap = await db.ref(`apiAutoReply/${tenantId}/${digits10(ourNumber)}`).get();
  return snap.exists() ? (snap.val() as AutoReplyConfig) : null;
}

export async function setAutoReply(
  tenantId: string,
  ourNumber: string,
  config: AutoReplyConfig
): Promise<void> {
  await db
    .ref(`apiAutoReply/${tenantId}/${digits10(ourNumber)}`)
    .set(JSON.parse(JSON.stringify(config)));
}

/** Is `now` inside the configured office hours? */
export function withinOfficeHours(hours: OfficeHours, now = new Date()): boolean {
  // Intl gives us the wall-clock parts in the target zone without a tz lib.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: hours.tz,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  const [sh, sm] = hours.start.split(':').map(Number);
  const [eh, em] = hours.end.split(':').map(Number);

  if (!hours.days.includes(dayIndex)) return false;
  return minutes >= sh * 60 + sm && minutes < eh * 60 + em;
}

/**
 * Should this config fire right now? 'always' fires whenever enabled;
 * 'after_hours' is the out-of-office pattern - only OUTSIDE office hours.
 */
export function shouldFire(config: AutoReplyConfig, now = new Date()): boolean {
  if (!config.enabled || !config.message.trim()) return false;
  if (!config.officeHours || config.officeHours.mode === 'always') return true;
  return !withinOfficeHours(config.officeHours, now);
}

/**
 * Claim the per-conversation cooldown. Optimistic on the null first run -
 * the server-side compare fences; see send-queue for the full story on why.
 */
export async function claimCooldown(tenantId: string, convKey: string): Promise<boolean> {
  const now = Date.now();
  const claim = await db
    .ref(`apiAutoReplyState/${tenantId}/${convKey}/lastSentAt`)
    .transaction((cur: number | null) => {
      if (cur === null) return now;
      return now - cur >= COOLDOWN_MS ? now : undefined;
    });
  return claim.committed && claim.snapshot?.val() === now;
}
