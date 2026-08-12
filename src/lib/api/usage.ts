import { db } from '@/lib/firebase-admin';

/** Daily usage counters: apiUsage/{tenantId}/{yyyymmdd}/{metric}. */

export type UsageMetric =
  | 'api_requests'
  | 'messages_sent'
  | 'messages_test'
  | 'lookups'
  | 'spam_scores'
  | 'verifications';

export function yyyymmdd(ts = Date.now()): string {
  const d = new Date(ts);
  const m = `${d.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${d.getUTCDate()}`.padStart(2, '0');
  return `${d.getUTCFullYear()}${m}${day}`;
}

export function yyyymm(ts = Date.now()): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}${`${d.getUTCMonth() + 1}`.padStart(2, '0')}`;
}

/** Fire-and-forget increment (observability, not enforcement). */
export function incrementUsage(
  tenantId: string,
  metric: UsageMetric,
  by = 1
): void {
  db.ref(`apiUsage/${tenantId}/${yyyymmdd()}/${metric}`)
    .transaction((current) => ((current as number | null) || 0) + by)
    .catch(() => {});
}

/**
 * Quota enforcement: atomically take one unit of a daily metric iff usage is
 * below the limit. Fails CLOSED (transaction error → not allowed).
 */
export async function takeQuota(
  tenantId: string,
  metric: UsageMetric,
  limit: number
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const ref = db.ref(`apiUsage/${tenantId}/${yyyymmdd()}/${metric}`);
  try {
    const result = await ref.transaction((current) => {
      const count = (current as number | null) || 0;
      if (count >= limit) return;
      return count + 1;
    });
    const used = (result.snapshot?.val() as number | null) || 0;
    return { allowed: result.committed, used, limit };
  } catch (error) {
    console.error('[api/usage] quota transaction failed (failing closed):', error);
    return { allowed: false, used: limit, limit };
  }
}

/** Monthly rollup: apiUsageMonthly/{tenantId}/{yyyymm}/{metric}. */
export function incrementUsageMonth(
  tenantId: string,
  metric: UsageMetric,
  by = 1
): void {
  db.ref(`apiUsageMonthly/${tenantId}/${yyyymm()}/${metric}`)
    .transaction((current) => ((current as number | null) || 0) + by)
    .catch(() => {});
}

export interface DayMonthQuota {
  allowed: boolean;
  reason?: 'day' | 'month';
  day: { used: number; limit: number };
  month: { used: number; limit: number | null };
}

/**
 * Two-tier quota: take the DAY slot first (the common rejection), then the
 * MONTH slot, refunding the day slot if the month is exhausted. A monthLimit
 * of null skips month enforcement but still records the month for the console.
 *
 * FAILS CLOSED, like takeQuota. If the process dies between the two takes the
 * day counter sits one high — conservative (under-sends), never over-sends.
 */
export async function takeQuotaDayMonth(
  tenantId: string,
  metric: UsageMetric,
  dayLimit: number,
  monthLimit: number | null
): Promise<DayMonthQuota> {
  const day = await takeQuota(tenantId, metric, dayLimit);
  if (!day.allowed) {
    return {
      allowed: false,
      reason: 'day',
      day: { used: day.used, limit: dayLimit },
      month: { used: 0, limit: monthLimit },
    };
  }

  const monthRef = db.ref(`apiUsageMonthly/${tenantId}/${yyyymm()}/${metric}`);
  try {
    const result = await monthRef.transaction((current) => {
      const count = (current as number | null) || 0;
      if (monthLimit !== null && count >= monthLimit) return;
      return count + 1;
    });
    const monthUsed = (result.snapshot?.val() as number | null) || 0;
    if (!result.committed) {
      // Month is exhausted — give the day slot back so the daily counter
      // reflects what was actually sent.
      db.ref(`apiUsage/${tenantId}/${yyyymmdd()}/${metric}`)
        .transaction((c) => Math.max(0, ((c as number | null) || 1) - 1))
        .catch(() => {});
      return {
        allowed: false,
        reason: 'month',
        day: { used: Math.max(0, day.used - 1), limit: dayLimit },
        month: { used: monthUsed, limit: monthLimit },
      };
    }
    return {
      allowed: true,
      day: { used: day.used, limit: dayLimit },
      month: { used: monthUsed, limit: monthLimit },
    };
  } catch (error) {
    console.error('[api/usage] month transaction failed (failing closed):', error);
    return {
      allowed: false,
      reason: 'month',
      day: { used: day.used, limit: dayLimit },
      month: { used: 0, limit: monthLimit },
    };
  }
}

/**
 * Give back one unit of a day+month allowance. Called when the work the quota
 * was taken for did not happen (e.g. the carrier rejected the message), so a
 * failed send never eats a developer's allowance.
 */
export function refundQuotaDayMonth(tenantId: string, metric: UsageMetric): void {
  const dec = (c: number | null) => Math.max(0, (c || 0) - 1);
  db.ref(`apiUsage/${tenantId}/${yyyymmdd()}/${metric}`)
    .transaction((c) => dec(c as number | null))
    .catch(() => {});
  db.ref(`apiUsageMonthly/${tenantId}/${yyyymm()}/${metric}`)
    .transaction((c) => dec(c as number | null))
    .catch(() => {});
}

/** Read this month's totals for the console. */
export async function getUsageMonthTotals(
  tenantId: string,
  month = yyyymm()
): Promise<Partial<Record<UsageMetric, number>>> {
  const snap = await db.ref(`apiUsageMonthly/${tenantId}/${month}`).get();
  return snap.exists()
    ? (snap.val() as Partial<Record<UsageMetric, number>>)
    : {};
}

/** Read a month of daily usage for the console. */
export async function getUsageMonth(
  tenantId: string,
  yyyymm: string
): Promise<Record<string, Partial<Record<UsageMetric, number>>>> {
  const snap = await db
    .ref(`apiUsage/${tenantId}`)
    .orderByKey()
    .startAt(`${yyyymm}01`)
    .endAt(`${yyyymm}31`)
    .get();
  return snap.exists()
    ? (snap.val() as Record<string, Partial<Record<UsageMetric, number>>>)
    : {};
}
