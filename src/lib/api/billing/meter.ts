import { db } from '@/lib/firebase-admin';
import { apiBillingStripe } from './stripe';
import { METER_EVENT_NAMES, billingReady } from './config';
import type { MeterName } from '../pricing';

/**
 * Usage reporting to Stripe Billing Meters, through a durable outbox.
 *
 * Requirements this design satisfies:
 *  - A developer's API call must NEVER fail because Stripe is down.
 *  - We must never silently lose revenue when it is.
 *  - A retry must never double-bill.
 *
 * How: write the event to RTDB first (the same primitive that backs takeQuota,
 * which fails CLOSED - if RTDB is down the send never happens, so there is
 * nothing to bill; the failure modes are correlated in the safe direction),
 * then attempt delivery out-of-band. The RTDB push key doubles as Stripe's
 * meter-event `identifier`, so the inline attempt and the cron drain can race
 * freely and Stripe still records exactly one unit.
 *
 * Legacy usage records are gone as of Stripe API 2025-03-31.basil; this uses
 * v1 Billing Meter Events, present in the pinned stripe@17.3.1.
 */

const MAX_ATTEMPTS = 8;
const BACKOFF_MS = [60_000, 120_000, 300_000, 600_000, 1_200_000, 1_800_000];

interface OutboxRow {
  tenantId: string;
  customerId: string;
  eventName: string;
  value: number;
  tsSec: number;
  attempts: number;
  nextAttemptAt: number;
  createdAt: number;
}

/** Fire-and-forget. Never throws, never awaited by a request path. */
export function reportMeterEvent(args: {
  tenantId: string;
  customerId: string;
  meter: MeterName;
  value?: number;
  timestampMs?: number;
}): void {
  if (!billingReady()) return;
  const eventName = METER_EVENT_NAMES[args.meter];
  if (!eventName) return;

  const row: OutboxRow = {
    tenantId: args.tenantId,
    customerId: args.customerId,
    eventName,
    value: args.value ?? 1,
    tsSec: Math.floor((args.timestampMs ?? Date.now()) / 1000),
    attempts: 0,
    nextAttemptAt: Date.now(),
    createdAt: Date.now(),
  };

  const ref = db.ref('apiMeterOutbox').push();
  ref
    .set(row)
    .then(() => deliver(ref.key as string, row))
    .catch((error) => {
      console.error('[api-billing/meter] outbox write failed:', error);
    });
}

/** One delivery attempt. Deletes the row on success, reschedules on failure. */
async function deliver(key: string, row: OutboxRow): Promise<boolean> {
  try {
    const stripe = apiBillingStripe();
    await stripe.billing.meterEvents.create({
      event_name: row.eventName,
      identifier: `mtr_${key}`, // idempotency - retries can never double-bill
      timestamp: row.tsSec,
      payload: {
        stripe_customer_id: row.customerId,
        value: String(row.value),
      },
    });
    await db.ref(`apiMeterOutbox/${key}`).remove();
    return true;
  } catch (error) {
    const attempts = row.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await db.ref(`apiMeterDeadLetter/${key}`).set({
        ...row,
        attempts,
        failedAt: Date.now(),
        lastError: error instanceof Error ? error.message.slice(0, 300) : 'unknown',
      });
      await db.ref(`apiMeterOutbox/${key}`).remove();
      console.error(`[api-billing/meter] dead-lettered ${key} after ${attempts} attempts`);
      return false;
    }
    const backoff = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
    await db.ref(`apiMeterOutbox/${key}`).update({
      attempts,
      nextAttemptAt: Date.now() + backoff,
    });
    return false;
  }
}

export interface FlushResult {
  sent: number;
  failed: number;
  remaining: number;
}

/** Cron drain: deliver everything that is due. */
export async function flushMeterOutbox(limit = 200): Promise<FlushResult> {
  const snap = await db
    .ref('apiMeterOutbox')
    .orderByChild('nextAttemptAt')
    .endAt(Date.now())
    .limitToFirst(limit)
    .get();

  if (!snap.exists()) return { sent: 0, failed: 0, remaining: 0 };

  const rows: Array<{ key: string; row: OutboxRow }> = [];
  snap.forEach((child) => {
    rows.push({ key: child.key as string, row: child.val() as OutboxRow });
  });

  let sent = 0;
  let failed = 0;
  for (const { key, row } of rows) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await deliver(key, row);
    if (ok) sent += 1;
    else failed += 1;
  }

  const rest = await db.ref('apiMeterOutbox').get();
  return { sent, failed, remaining: rest.exists() ? Object.keys(rest.val()).length : 0 };
}
