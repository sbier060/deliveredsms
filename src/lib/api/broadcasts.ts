import { db } from '@/lib/firebase-admin';
import { randomBase62 } from './ids';
import { contactsByTags, getContact, type Contact } from './contacts';
import { enqueueSend } from './send-queue';

/**
 * Broadcasts: one message to an audience, delivered as N individual sends -
 * recipients never see each other by construction, and merge fields make each
 * body unique anyway. Fan-out goes through the send queue, so every recipient
 * passes the full send pipeline (opt-out, quota, velocity) independently.
 *
 *   apiBroadcasts/{tenantId}/{id} = Broadcast
 */

export interface Broadcast {
  id: string;
  name: string;
  body: string;
  from: string;
  audience: { tags?: string[]; contactIds?: string[] };
  scheduledAt?: number;
  status: 'scheduled' | 'sending' | 'complete';
  counts: { total: number; sent: number; failed: number; skipped_opt_out: number };
  createdBy: string;
  createdAt: number;
}

export const newBroadcastId = () => `bc_${randomBase62(12)}`;
export const MAX_BROADCAST_RECIPIENTS = 2_000;

export async function listBroadcasts(tenantId: string): Promise<Broadcast[]> {
  const snap = await db.ref(`apiBroadcasts/${tenantId}`).get();
  if (!snap.exists()) return [];
  return (Object.values(snap.val()) as Broadcast[])
    // Drop malformed rows (e.g. historical phantoms) rather than crash the UI.
    .filter((b) => b && typeof b.createdAt === 'number' && b.id)
    .map((b) => ({
      ...b,
      // Counter children are created lazily by the cron; hydrate defaults.
      counts: {
        total: b.counts?.total ?? 0,
        sent: b.counts?.sent ?? 0,
        failed: b.counts?.failed ?? 0,
        skipped_opt_out: b.counts?.skipped_opt_out ?? 0,
      },
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function resolveAudience(
  tenantId: string,
  audience: { tags?: string[]; contactIds?: string[] }
): Promise<Contact[]> {
  const byTag = audience.tags?.length ? await contactsByTags(tenantId, audience.tags) : [];
  const byId = audience.contactIds?.length
    ? (await Promise.all(audience.contactIds.map((id) => getContact(tenantId, id)))).filter(
        (c): c is Contact => c !== null
      )
    : [];
  // Dedupe by digits - a contact matching a tag AND an explicit id gets one message.
  const seen = new Set<string>();
  return [...byTag, ...byId].filter((c) => {
    if (seen.has(c.digits)) return false;
    seen.add(c.digits);
    return true;
  });
}

/**
 * Create the broadcast and fan its recipients into the send queue. `runAt` in
 * the past means "next cron tick" - there is no separate immediate path, so
 * scheduled and instant broadcasts exercise identical code.
 */
export async function createBroadcast(
  tenantId: string,
  input: {
    name: string;
    body: string;
    from: string;
    audience: { tags?: string[]; contactIds?: string[] };
    scheduledAt?: number;
    createdBy: { uid: string; name: string };
  }
): Promise<{ broadcast: Broadcast } | { error: string }> {
  const recipients = await resolveAudience(tenantId, input.audience);
  if (recipients.length === 0) return { error: 'The audience matches no contacts.' };
  if (recipients.length > MAX_BROADCAST_RECIPIENTS) {
    return { error: `Audience too large (${recipients.length}; max ${MAX_BROADCAST_RECIPIENTS}).` };
  }

  const runAt = input.scheduledAt && input.scheduledAt > Date.now() ? input.scheduledAt : Date.now();
  const broadcast: Broadcast = {
    id: newBroadcastId(),
    name: input.name,
    body: input.body,
    from: input.from,
    audience: input.audience,
    ...(input.scheduledAt ? { scheduledAt: input.scheduledAt } : {}),
    status: runAt > Date.now() ? 'scheduled' : 'sending',
    counts: { total: recipients.length, sent: 0, failed: 0, skipped_opt_out: 0 },
    createdBy: input.createdBy.name,
    createdAt: Date.now(),
  };
  await db.ref(`apiBroadcasts/${tenantId}/${broadcast.id}`).set(JSON.parse(JSON.stringify(broadcast)));

  for (const contact of recipients) {
    await enqueueSend({
      tenantId,
      to: contact.phone,
      from: input.from,
      body: input.body,
      runAt,
      broadcastId: broadcast.id,
      contactId: contact.id,
      sentBy: { uid: input.createdBy.uid, name: input.createdBy.name },
    });
  }
  // Once jobs exist the cron owns the status; flip scheduled→sending at runAt
  // is handled implicitly (jobs become due; first completion math needs
  // 'sending'). Set sending now for immediate, scheduled stays until due.
  return { broadcast };
}
