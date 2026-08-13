import { db } from '@/lib/firebase-admin';
import { newMessageId } from './ids';
import type { MessageDirection, MessageStatus, PublicMessage } from './types';

/**
 * Message store for the public API.
 *
 * Sandbox messages live entirely under the rules-locked apiMessages node —
 * they never touch the consumer webhooks/{number} node (which is
 * world-readable and belongs to the consumer app). Live messages (Phase 2)
 * will store a pointer to the carrier-written record instead.
 *
 * Storage: apiMessages/{tenantId}/items/{pushKey} = record;
 *          apiMessages/{tenantId}/byId/{msgId} = pushKey.
 */

export interface StoredMessage {
  id: string;
  to: string;
  from: string;
  body: string;
  direction: MessageDirection;
  status: MessageStatus;
  test: boolean;
  createdAt: number;
  /** MMS attachments. Accepted and stored now; sending is carrier-gated. */
  media?: string[];
  /** Who composed it: a console user or the API key name. */
  sentBy?: { uid?: string; name: string };
  /** Carrier reference for the pending DLR pipeline. */
  carrierMessageId?: string;
  /** Why a send failed, when the carrier told us synchronously. */
  failureReason?: string;
}

export function toPublicMessage(m: StoredMessage): PublicMessage {
  return {
    id: m.id,
    object: 'message',
    to: m.to,
    from: m.from,
    body: m.body,
    direction: m.direction,
    status: m.status,
    test: m.test,
    created_at: new Date(m.createdAt).toISOString(),
    ...(m.media?.length ? { media: m.media } : {}),
    ...(m.sentBy ? { sent_by: m.sentBy.name } : {}),
    ...(m.failureReason ? { failure_reason: m.failureReason } : {}),
  };
}

export async function storeMessage(
  tenantId: string,
  input: Omit<StoredMessage, 'id' | 'createdAt'>
): Promise<StoredMessage> {
  const record: StoredMessage = {
    ...input,
    id: newMessageId(),
    createdAt: Date.now(),
  };
  const itemRef = db.ref(`apiMessages/${tenantId}/items`).push();
  await itemRef.set(record);
  await db.ref(`apiMessages/${tenantId}/byId/${record.id}`).set(itemRef.key);
  return record;
}

export async function getMessage(
  tenantId: string,
  msgId: string
): Promise<StoredMessage | null> {
  const keySnap = await db.ref(`apiMessages/${tenantId}/byId/${msgId}`).get();
  if (!keySnap.exists()) return null;
  const snap = await db
    .ref(`apiMessages/${tenantId}/items/${keySnap.val()}`)
    .get();
  return snap.exists() ? (snap.val() as StoredMessage) : null;
}

export async function listMessages(
  tenantId: string,
  opts: { limit: number; cursor?: string | null; number?: string | null }
): Promise<{ data: PublicMessage[]; hasMore: boolean; nextCursor: string | null }> {
  let query = db.ref(`apiMessages/${tenantId}/items`).orderByKey();
  if (opts.cursor) query = query.endBefore(opts.cursor);
  const snap = await query.limitToLast(opts.limit + 1).get();
  if (!snap.exists()) return { data: [], hasMore: false, nextCursor: null };

  const entries: Array<{ key: string; value: StoredMessage }> = [];
  snap.forEach((child) => {
    entries.push({ key: child.key as string, value: child.val() as StoredMessage });
  });
  entries.reverse();

  const filtered = opts.number
    ? entries.filter(
        (e) => e.value.from === opts.number || e.value.to === opts.number
      )
    : entries;
  const hasMore = entries.length > opts.limit;
  const page = filtered.slice(0, opts.limit);
  const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].key : null;
  return { data: page.map((e) => toPublicMessage(e.value)), hasMore, nextCursor };
}
