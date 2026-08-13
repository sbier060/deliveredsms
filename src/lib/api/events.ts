import { db } from '@/lib/firebase-admin';
import { newEventId } from './ids';
import { deliverEvent } from './webhooks';
import type { ApiEventType, PublicEvent } from './types';

/**
 * Event store + push. Every emitEvent both records the event (pollable via
 * GET /v1/events) and delivers it to the tenant's webhook endpoints
 * (webhooks.ts - signed, retried from the outbox on failure).
 *
 * Storage: apiEvents/{tenantId}/items/{pushKey} = record (push keys give
 * chronological ordering); apiEvents/{tenantId}/byId/{evtId} = pushKey.
 */

export interface StoredEvent {
  id: string;
  type: ApiEventType;
  createdAt: number;
  data: Record<string, unknown>;
}

export async function emitEvent(
  tenantId: string,
  type: ApiEventType,
  data: Record<string, unknown>,
  createdAt = Date.now()
): Promise<string> {
  const id = newEventId();
  const itemRef = db.ref(`apiEvents/${tenantId}/items`).push();
  await itemRef.set({ id, type, createdAt, data } satisfies StoredEvent);
  await db.ref(`apiEvents/${tenantId}/byId/${id}`).set(itemRef.key);
  // Push to the tenant's webhook endpoints. deliverEvent never throws, and a
  // tenant with no endpoints returns after a single read.
  await deliverEvent(tenantId, toPublicEvent({ id, type, createdAt, data }));
  return id;
}

export function toPublicEvent(e: StoredEvent): PublicEvent {
  return {
    id: e.id,
    object: 'event',
    type: e.type,
    created_at: new Date(e.createdAt).toISOString(),
    data: e.data,
  };
}

export async function listEvents(
  tenantId: string,
  opts: { limit: number; cursor?: string | null; type?: string | null }
): Promise<{ data: PublicEvent[]; hasMore: boolean; nextCursor: string | null }> {
  let query = db.ref(`apiEvents/${tenantId}/items`).orderByKey();
  if (opts.cursor) query = query.endBefore(opts.cursor);
  const snap = await query.limitToLast(opts.limit + 1).get();
  if (!snap.exists()) return { data: [], hasMore: false, nextCursor: null };

  const entries: Array<{ key: string; value: StoredEvent }> = [];
  snap.forEach((child) => {
    entries.push({ key: child.key as string, value: child.val() as StoredEvent });
  });
  entries.reverse(); // newest first

  const filtered = opts.type
    ? entries.filter((e) => e.value.type === opts.type)
    : entries;
  const hasMore = entries.length > opts.limit;
  const page = filtered.slice(0, opts.limit);
  const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].key : null;
  return { data: page.map((e) => toPublicEvent(e.value)), hasMore, nextCursor };
}
