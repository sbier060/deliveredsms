import { db } from '@/lib/firebase-admin';
import { newMessageId } from './ids';
import { digits10 } from './phone';
import type { MessageDirection, MessageStatus, PublicMessage } from './types';

/**
 * Message store for the public API.
 *
 * Sandbox messages live entirely under the rules-locked apiMessages node -
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

/** Thread identity: our number + the counterparty, direction-independent. */
export function convKeyFor(m: Pick<StoredMessage, 'to' | 'from' | 'direction'>): string {
  const ours = digits10(m.direction === 'outbound' ? m.from : m.to);
  const theirs = digits10(m.direction === 'outbound' ? m.to : m.from);
  return `${ours}_${theirs}`;
}

export interface Conversation {
  ourNumber: string;
  counterparty: string;
  lastBody: string;
  lastDirection: MessageDirection;
  lastStatus: MessageStatus;
  lastMessageAt: number;
  unreadCount: number;
  messageCount: number;
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
  // RTDB rejects undefined anywhere in the value; strip rather than crash.
  const clean = JSON.parse(JSON.stringify(record)) as StoredMessage;

  const itemRef = db.ref(`apiMessages/${tenantId}/items`).push();
  await itemRef.set(clean);
  await db.ref(`apiMessages/${tenantId}/byId/${record.id}`).set(itemRef.key);

  // Conversation upkeep lives here, inside the one write path every message
  // takes (API send, console send, carrier inbound, sandbox, auto-reply), so
  // no route can forget it. byConv makes a thread one indexed read.
  const convKey = convKeyFor(record);
  await db.ref(`apiMessages/${tenantId}/byConv/${convKey}/${itemRef.key}`).set(record.id);
  await db.ref(`apiConversations/${tenantId}/${convKey}`).transaction((cur: Conversation | null) => ({
    ourNumber: record.direction === 'outbound' ? record.from : record.to,
    counterparty: record.direction === 'outbound' ? record.to : record.from,
    lastBody: record.body.slice(0, 200),
    lastDirection: record.direction,
    lastStatus: record.status,
    lastMessageAt: record.createdAt,
    unreadCount: (cur?.unreadCount || 0) + (record.direction === 'inbound' ? 1 : 0),
    messageCount: (cur?.messageCount || 0) + 1,
  }));

  return record;
}

/** Conversations, newest first. Whole-node read + in-memory sort by design -
 *  the shared RTDB takes no .indexOn, and the node is one row per counterparty. */
export async function listConversations(
  tenantId: string
): Promise<Array<Conversation & { key: string }>> {
  const snap = await db.ref(`apiConversations/${tenantId}`).get();
  if (!snap.exists()) return [];
  return Object.entries(snap.val() as Record<string, Conversation>)
    .map(([key, c]) => ({ key, ...c }))
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

export async function markConversationRead(tenantId: string, convKey: string): Promise<boolean> {
  if (!/^\d{10}_\d{10}$/.test(convKey)) return false;
  // Not a transaction: an RTDB transaction's first run sees null (empty local
  // cache) and returning undefined there aborts WITHOUT retrying - the
  // "conditional set" idiom silently no-ops. Read-then-set is fine here; a
  // racing inbound bumping the counter after our read simply stays unread,
  // which is the correct outcome anyway.
  const snap = await db.ref(`apiConversations/${tenantId}/${convKey}`).get();
  if (!snap.exists()) return false;
  await db.ref(`apiConversations/${tenantId}/${convKey}/unreadCount`).set(0);
  return true;
}

/** One thread, newest first, cursored on the same push keys as listMessages. */
export async function listThread(
  tenantId: string,
  convKey: string,
  opts: { limit: number; cursor?: string | null }
): Promise<{ data: PublicMessage[]; hasMore: boolean; nextCursor: string | null }> {
  if (!/^\d{10}_\d{10}$/.test(convKey)) return { data: [], hasMore: false, nextCursor: null };
  let query = db.ref(`apiMessages/${tenantId}/byConv/${convKey}`).orderByKey();
  if (opts.cursor) query = query.endBefore(opts.cursor);
  const snap = await query.limitToLast(opts.limit + 1).get();
  if (!snap.exists()) return { data: [], hasMore: false, nextCursor: null };

  const entries = Object.entries(snap.val() as Record<string, string>).reverse();
  const hasMore = entries.length > opts.limit;
  const page = entries.slice(0, opts.limit);
  const nextCursor = hasMore ? page[page.length - 1][0] : null;

  // Resolve ids -> records via byId (two hops, both O(1) per message).
  const messages = await Promise.all(
    page.map(async ([, msgId]) => getMessage(tenantId, msgId))
  );
  return {
    data: messages.filter((m): m is StoredMessage => m !== null).map(toPublicMessage),
    hasMore,
    nextCursor,
  };
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
