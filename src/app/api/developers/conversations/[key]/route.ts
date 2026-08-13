import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/api/console-auth';
import { listThread, markConversationRead } from '@/lib/api/messages';

export const runtime = 'nodejs';
export const maxDuration = 30;

const err = (ctx: string) =>
  NextResponse.json({ error: ctx }, { status: ctx === 'unauthorized' ? 401 : ctx === 'forbidden' ? 403 : 404 });

/** One thread, newest first, cursored. */
export async function GET(req: NextRequest, { params }: { params: { key: string } }) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') return err(ctx);

  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 50));
  const cursor = req.nextUrl.searchParams.get('cursor');
  const thread = await listThread(ctx.tenantId, params.key, { limit, cursor });
  return NextResponse.json(thread);
}

/** Mark read (clears the shared unread counter). */
export async function POST(req: NextRequest, { params }: { params: { key: string } }) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') return err(ctx);

  const ok = await markConversationRead(ctx.tenantId, params.key);
  return NextResponse.json({ read: ok });
}
