import { createHash } from 'crypto';
import { db } from '@/lib/firebase-admin';
import { digits10, normalizeE164 } from './phone';
import { activeNumbers } from './tenants';
import type { ApiTenant } from './types';

/**
 * Who a verification code is sent FROM.
 *
 * Twilio Verify does not make you buy a number — it "procures and manages
 * short codes, long codes, toll free, and global alpha-sender IDs" on your
 * behalf. We match that: a developer who only wants phone verification needs
 * zero numbers, zero provisioning, and pays no monthly number fee. The sender
 * is irrelevant to them anyway, because nobody replies to an OTP.
 *
 * Pool numbers are Ghost-owned and sent under OpenSMS's own 10DLC verification
 * campaign — which is the correct structure given we already promise to handle
 * 10DLC registration for developers.
 *
 * A developer who wants their own number on the message can still pass `from`
 * explicitly, the same way Twilio lets you override with a Messaging Service.
 */

/** The sandbox sender — lets test-mode verification work with no numbers at all. */
export const SANDBOX_VERIFY_SENDER = '+15005550100';

let cachedPool: { numbers: string[]; at: number } | null = null;
const POOL_CACHE_MS = 60_000;

/**
 * Pool source, in order: RTDB `config/verifySenderPool` (editable without a
 * deploy), then the OPENSMS_VERIFY_SENDER_POOL env var.
 */
export async function getSenderPool(): Promise<string[]> {
  if (cachedPool && Date.now() - cachedPool.at < POOL_CACHE_MS) {
    return cachedPool.numbers;
  }

  let numbers: string[] = [];
  try {
    const snap = await db.ref('config/verifySenderPool').get();
    if (snap.exists()) {
      const val = snap.val();
      const raw: unknown[] = Array.isArray(val) ? val : Object.values(val || {});
      numbers = raw
        .map((n) => normalizeE164(typeof n === 'string' ? n : null))
        .filter((n): n is string => n !== null);
    }
  } catch {
    // fall through to env
  }

  if (numbers.length === 0) {
    numbers = (process.env.OPENSMS_VERIFY_SENDER_POOL || '')
      .split(',')
      .map((n) => normalizeE164(n.trim()))
      .filter((n): n is string => n !== null);
  }

  cachedPool = { numbers, at: Date.now() };
  return numbers;
}

/**
 * Sticky selection: the same tenant+destination pair always draws the same
 * sender, so a user who requests a second code sees it arrive from the number
 * they already have in their thread (and carriers prefer the consistency).
 */
export function pickSticky(pool: string[], tenantId: string, destination: string): string {
  const digest = createHash('sha256')
    .update(`${tenantId}:${digits10(destination)}`)
    .digest();
  return pool[digest.readUInt32BE(0) % pool.length];
}

export class NoSenderAvailableError extends Error {}

/**
 * Resolve the sending number for a verification.
 *
 * Order: an explicit `from` the tenant owns → the shared Ghost pool → any
 * number the tenant happens to own. Only if all three are empty do we error,
 * and then the message names the real fix (configure the pool) rather than
 * telling the developer to buy something they don't need.
 */
export async function resolveVerifySender(input: {
  tenant: ApiTenant;
  destination: string;
  mode: 'test' | 'live';
  requestedFrom?: string | null;
}): Promise<string> {
  if (input.mode === 'test') {
    return input.requestedFrom || activeNumbers(input.tenant)[0] || SANDBOX_VERIFY_SENDER;
  }

  if (input.requestedFrom) {
    if (!activeNumbers(input.tenant).includes(input.requestedFrom)) {
      throw new NoSenderAvailableError(
        '`from` must be a number your account owns. Leave it out and OpenSMS will send from its verification pool.'
      );
    }
    return input.requestedFrom;
  }

  const pool = await getSenderPool();
  if (pool.length > 0) {
    return pickSticky(pool, input.tenant.id, input.destination);
  }

  const own = activeNumbers(input.tenant)[0];
  if (own) return own;

  throw new NoSenderAvailableError(
    'No verification sender is available. Ghost normally sends from its own pool — this is a Ghost configuration problem, not something you need to fix. Contact us.'
  );
}

/**
 * Recipients who have replied STOP to a pool number.
 *
 * Populated by inbound STOP handling (Phase 3). The check is here from day one
 * so opt-outs are honoured the moment that lands, rather than being a change
 * to the send path later.
 */
export async function hasOptedOut(destination: string): Promise<boolean> {
  try {
    const snap = await db.ref(`apiVerifyOptOut/${digits10(destination)}`).get();
    return snap.exists();
  } catch {
    return false; // fail open — an RTDB blip must not block verification
  }
}
