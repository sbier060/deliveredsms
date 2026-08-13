import { db } from '@/lib/firebase-admin';
import { digits10 } from '@/lib/api/phone';

/**
 * STOP / START / HELP handling.
 *
 * Scope is per-tenant: a recipient who replies STOP silences the tenant that
 * texted them and nobody else. A global registry would mean unsubscribing from
 * one sender also kills your login codes from an unrelated one, which is a
 * worse failure than the one it prevents. It is also what makes sandbox
 * enforcement possible - +1 500-555-0006 is the canonical sandbox destination,
 * and a global opt-out on it would permanently break every developer's tests.
 */

export type InboundIntent = 'opt_out' | 'opt_in' | 'help' | null;

/** CTIA-standard keyword sets. */
const OPT_OUT = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']);
const OPT_IN = new Set(['START', 'UNSTOP', 'YES']);
const HELP = new Set(['HELP', 'INFO']);

/**
 * Classify an inbound body.
 *
 * The message must BE the keyword, not merely contain it. "please stop by
 * tomorrow" and "stopwatch" are ordinary messages; unsubscribing on those is
 * both wrong and, once it happens, invisible to the sender. Punctuation and
 * surrounding whitespace are stripped because handsets and users add both.
 */
export function classify(body: string): InboundIntent {
  const word = body
    .trim()
    .toUpperCase()
    .replace(/[.,!?;:'"()\[\]]/g, '')
    .trim();

  if (OPT_OUT.has(word)) return 'opt_out';
  if (OPT_IN.has(word)) return 'opt_in';
  if (HELP.has(word)) return 'help';
  return null;
}

const key = (tenantId: string, phone: string) =>
  `apiOptOut/${tenantId}/${digits10(phone)}`;

/**
 * Has this recipient opted out of this tenant's messages?
 *
 * Also consults the legacy global `apiVerifyOptOut` node so anything already
 * recorded there keeps being honoured.
 */
export async function hasOptedOut(tenantId: string, phone: string): Promise<boolean> {
  try {
    const [scoped, legacy] = await Promise.all([
      db.ref(key(tenantId, phone)).get(),
      db.ref(`apiVerifyOptOut/${digits10(phone)}`).get(),
    ]);
    return scoped.exists() || legacy.exists();
  } catch {
    // Fail open. An RTDB blip must not block a login code; the alternative is
    // locking users out of their accounts during an outage.
    return false;
  }
}

export async function recordOptOut(
  tenantId: string,
  phone: string,
  via: string,
  sourceMessageId?: string
): Promise<void> {
  await db.ref(key(tenantId, phone)).set({
    at: Date.now(),
    via,
    ...(sourceMessageId ? { sourceMessageId } : {}),
  });
}

export async function clearOptOut(tenantId: string, phone: string): Promise<void> {
  await db.ref(key(tenantId, phone)).remove();
}

/**
 * Record that a verification was sent to a number that had opted out.
 *
 * One-time passcodes are exempt: the user is asking for the code by trying to
 * log in, and blocking it locks them out of their own account. The exemption is
 * written down rather than applied silently, so the pattern is auditable if a
 * carrier ever asks why traffic went to an opted-out handset.
 */
export async function logOptOutOverride(
  tenantId: string,
  phone: string,
  reason: string
): Promise<void> {
  try {
    await db.ref(`apiOptOutOverride/${tenantId}/${digits10(phone)}`).push({
      at: Date.now(),
      reason,
    });
  } catch {
    // Best-effort audit trail; never block the send on it.
  }
}

/** The one message allowed to a number that just opted out. */
export function confirmationBody(brand = 'Delivered'): string {
  return `You have been unsubscribed and will receive no further messages from ${brand}. Reply START to resubscribe.`;
}

export function helpBody(brand = 'Delivered'): string {
  return `${brand}: for help, contact support@deliveredsms.com. Reply STOP to unsubscribe.`;
}
