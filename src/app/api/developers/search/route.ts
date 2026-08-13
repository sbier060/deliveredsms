import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { requireTenantContext } from '@/lib/api/console-auth';
import { listContacts } from '@/lib/api/contacts';
import { toPublicMessage, type StoredMessage } from '@/lib/api/messages';

export const runtime = 'nodejs';
export const maxDuration = 30;

const SCAN_WINDOW = 2000;

/**
 * Search: contacts by name/number prefix, message bodies by substring over the
 * most recent SCAN_WINDOW messages. RTDB has no text index and the shared
 * instance takes no .indexOn, so this is an honest in-memory scan with the
 * window declared in the response - the shape leaves room for a real index.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') {
    return NextResponse.json({ error: ctx }, { status: ctx === 'unauthorized' ? 401 : ctx === 'forbidden' ? 403 : 404 });
  }

  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  if (q.length < 2) return NextResponse.json({ error: 'q must be at least 2 characters' }, { status: 400 });
  const needle = q.toLowerCase();
  const digitNeedle = q.replace(/\D/g, '');

  const [contacts, messagesSnap] = await Promise.all([
    listContacts(ctx.tenantId),
    db.ref(`apiMessages/${ctx.tenantId}/items`).orderByKey().limitToLast(SCAN_WINDOW).get(),
  ]);

  const contactHits = contacts
    .filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        (digitNeedle.length >= 3 && c.digits.includes(digitNeedle))
    )
    .slice(0, 25);

  const messages = messagesSnap.exists()
    ? (Object.values(messagesSnap.val()) as StoredMessage[])
    : [];
  const messageHits = messages
    .filter(
      (m) =>
        m.body.toLowerCase().includes(needle) ||
        (digitNeedle.length >= 4 && (m.to.includes(digitNeedle) || m.from.includes(digitNeedle)))
    )
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 25)
    .map(toPublicMessage);

  return NextResponse.json({
    contacts: contactHits,
    messages: messageHits,
    scanned_messages: Math.min(messages.length, SCAN_WINDOW),
    window: SCAN_WINDOW,
  });
}
