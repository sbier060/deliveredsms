import { db } from '@/lib/firebase-admin';
import { randomBase62 } from './ids';
import { getTenant } from './tenants';
import { digits10 } from './phone';
import { sendOutbound } from './send-core';
import { hasOptedOut } from './opt-out';
import { getContact } from './contacts';
import { renderMerge } from './merge';
import { emitEvent } from './events';

/**
 * Deferred sends: scheduled 1:1 messages and broadcast fan-out, drained by the
 * api-send-flush cron. Modeled on apiWebhookOutbox - a global queue node,
 * unordered fetch + in-code due filter (no .indexOn on the shared RTDB), and
 * a claim-then-send transaction per job so overlapping cron runs cannot
 * double-send (the autoReplySms cooldown pattern).
 *
 *   apiSendQueue/{jobId} = SendJob
 */

export interface SendJob {
  tenantId: string;
  to: string;
  from: string;
  /** Raw body; merge fields render at send time against contactId. */
  body: string;
  runAt: number;
  broadcastId?: string;
  contactId?: string;
  sentBy?: { uid?: string; name: string };
  status: 'queued' | 'claimed' | 'sent' | 'failed' | 'skipped' | 'canceled';
  createdAt: number;
  claimedAt?: number;
  finishedAt?: number;
  lastError?: string;
}

export const newJobId = () => `job_${randomBase62(16)}`;
const BATCH = 100;

export async function enqueueSend(job: Omit<SendJob, 'status' | 'createdAt'>): Promise<string> {
  const id = newJobId();
  const clean = JSON.parse(JSON.stringify({ ...job, status: 'queued', createdAt: Date.now() }));
  await db.ref(`apiSendQueue/${id}`).set(clean);
  return id;
}

export async function listScheduled(tenantId: string): Promise<Array<SendJob & { id: string }>> {
  // Global node filtered in memory - bounded by BATCH-sized reads in the cron,
  // but for the console list we read the tenant's own jobs via a full fetch of
  // pending ones. Queue depth is operationally small (jobs leave on send).
  const snap = await db.ref('apiSendQueue').limitToFirst(1000).get();
  if (!snap.exists()) return [];
  return Object.entries(snap.val() as Record<string, SendJob>)
    .filter(([, j]) => j.tenantId === tenantId && j.status === 'queued')
    .map(([id, j]) => ({ id, ...j }))
    .sort((a, b) => a.runAt - b.runAt);
}

export async function cancelScheduled(tenantId: string, jobId: string): Promise<boolean> {
  const ref = db.ref(`apiSendQueue/${jobId}`);
  const snap = await ref.get();
  if (!snap.exists()) return false;
  const job = snap.val() as SendJob;
  if (job.tenantId !== tenantId || job.status !== 'queued') return false;
  // Claim the cancellation the same way the cron claims a send, so a job
  // mid-flight cannot be "canceled" after the carrier accepted it. Null-run
  // returns optimistically - see the flush claim for why.
  const claim = await ref.child('status').transaction((cur: string | null) => {
    if (cur === null) return 'canceled';
    return cur === 'queued' ? 'canceled' : undefined;
  });
  return claim.committed && claim.snapshot?.val() === 'canceled';
}

/** Cron body: claim due jobs, run them through the one send pipeline. */
export async function flushSendQueue(): Promise<{ sent: number; failed: number; skipped: number; remaining: boolean }> {
  const now = Date.now();
  const snap = await db.ref('apiSendQueue').limitToFirst(BATCH + 1).get();
  if (!snap.exists()) return { sent: 0, failed: 0, skipped: 0, remaining: false };

  const all = Object.entries(snap.val() as Record<string, SendJob>);
  const due = all.filter(([, j]) => j.status === 'queued' && j.runAt <= now).slice(0, BATCH);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const [id, job] of due) {
    // Claim-then-send: first writer wins, overlapping cron runs lose cleanly.
    // The null branch is REQUIRED: a transaction's first run sees null (empty
    // local cache) and returning undefined there aborts without retrying -
    // return optimistically and let the server-side compare do the fencing.
    // (Same trap markConversationRead hit, opposite direction.)
    const claim = await db
      .ref(`apiSendQueue/${id}/status`)
      .transaction((cur: string | null) => {
        if (cur === null) return 'claimed';
        return cur === 'queued' ? 'claimed' : undefined;
      });
    if (!claim.committed || claim.snapshot?.val() !== 'claimed') continue;
    await db.ref(`apiSendQueue/${id}/claimedAt`).set(Date.now());

    const finish = async (status: SendJob['status'], extra: Record<string, unknown> = {}) => {
      await db.ref(`apiSendQueue/${id}`).update({ status, finishedAt: Date.now(), ...extra });
    };

    try {
      const tenant = await getTenant(job.tenantId);
      if (!tenant) {
        await finish('failed', { lastError: 'tenant_missing' });
        failed++;
        continue;
      }

      // Opt-outs between scheduling and sending must win.
      if (await hasOptedOut(job.tenantId, job.to)) {
        await finish('skipped', { lastError: 'opted_out' });
        await bumpBroadcast(job, 'skipped_opt_out');
        skipped++;
        continue;
      }

      // Merge renders at send time so a contact edit before the send lands.
      let body = job.body;
      if (job.contactId) {
        const contact = await getContact(job.tenantId, job.contactId);
        body = renderMerge(job.body, contact).trim();
        if (!body) {
          await finish('skipped', { lastError: 'empty_after_merge' });
          await bumpBroadcast(job, 'failed');
          skipped++;
          continue;
        }
      }

      const number = tenant.numbers?.[digits10(job.from)];
      if (!number || number.releasedAt) {
        await finish('failed', { lastError: 'from_number_released' });
        await bumpBroadcast(job, 'failed');
        failed++;
        continue;
      }

      const result = await sendOutbound(job.tenantId, tenant, number.mode, {
        to: job.to,
        from: job.from,
        body,
        sentBy: job.sentBy,
      });

      if (result.ok) {
        await finish('sent');
        await bumpBroadcast(job, 'sent');
        sent++;
      } else {
        await finish('failed', { lastError: `${result.code}: ${result.message}`.slice(0, 300) });
        await bumpBroadcast(job, result.code === 'forbidden' ? 'skipped_opt_out' : 'failed');
        failed++;
      }
    } catch (e) {
      await finish('failed', { lastError: e instanceof Error ? e.message.slice(0, 300) : 'unknown' });
      await bumpBroadcast(job, 'failed');
      failed++;
    }
  }

  // Sweep finished jobs older than a day so the node stays bounded.
  const stale = all.filter(
    ([, j]) => j.status !== 'queued' && j.status !== 'claimed' && (j.finishedAt || 0) < now - 24 * 60 * 60_000
  );
  for (const [id] of stale) await db.ref(`apiSendQueue/${id}`).remove();

  return { sent, failed, skipped, remaining: all.length > BATCH };
}

/** Update a broadcast's counters as its jobs complete; emit on completion. */
async function bumpBroadcast(job: SendJob, counter: 'sent' | 'failed' | 'skipped_opt_out'): Promise<void> {
  if (!job.broadcastId) return;
  const base = `apiBroadcasts/${job.tenantId}/${job.broadcastId}`;
  // Existence first: transacting a counter under a deleted record would
  // resurrect it as a phantom {counts} object with no name or createdAt,
  // which then crashes anything that renders the list.
  const before = await db.ref(base).get();
  if (!before.exists() || !(before.val() as { createdAt?: number }).createdAt) return;
  await db.ref(`${base}/counts/${counter}`).transaction((cur: number | null) => (cur || 0) + 1);

  const snap = await db.ref(base).get();
  if (!snap.exists()) return;
  const b = snap.val() as { counts?: Record<string, number>; status?: string };
  // First job of a scheduled broadcast coming due flips it to sending.
  if (b.status === 'scheduled') {
    await db.ref(`${base}/status`).set('sending');
    b.status = 'sending';
  }
  const done = (b.counts?.sent || 0) + (b.counts?.failed || 0) + (b.counts?.skipped_opt_out || 0);
  if (b.status === 'sending' && done >= (b.counts?.total || 0)) {
    await db.ref(`${base}/status`).set('complete');
    await emitEvent(job.tenantId, 'broadcast.complete', {
      broadcast_id: job.broadcastId,
      sent: b.counts?.sent || 0,
      failed: b.counts?.failed || 0,
      skipped_opt_out: b.counts?.skipped_opt_out || 0,
    });
  }
}
