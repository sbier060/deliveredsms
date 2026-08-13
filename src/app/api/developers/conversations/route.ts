import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/api/console-auth';
import { listConversations } from '@/lib/api/messages';
import { listContacts } from '@/lib/api/contacts';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Inbox list: conversations newest-first, with contact names resolved. */
export async function GET(req: NextRequest) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') {
    return NextResponse.json({ error: ctx }, { status: ctx === 'unauthorized' ? 401 : ctx === 'forbidden' ? 403 : 404 });
  }

  const [conversations, contacts] = await Promise.all([
    listConversations(ctx.tenantId),
    listContacts(ctx.tenantId),
  ]);
  const nameByDigits = new Map(contacts.map((c) => [c.digits, c.name]));

  return NextResponse.json({
    conversations: conversations.map((c) => ({
      ...c,
      counterpartyName: nameByDigits.get(c.key.split('_')[1]) || null,
    })),
  });
}
