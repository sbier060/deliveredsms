import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/api/console-auth';
import { listScheduled, cancelScheduled } from '@/lib/api/send-queue';

export const runtime = 'nodejs';
export const maxDuration = 15;

const err = (ctx: string) =>
  NextResponse.json({ error: ctx }, { status: ctx === 'unauthorized' ? 401 : ctx === 'forbidden' ? 403 : 404 });

export async function GET(req: NextRequest) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') return err(ctx);
  return NextResponse.json({ scheduled: await listScheduled(ctx.tenantId) });
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') return err(ctx);
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!/^job_[0-9A-Za-z]+$/.test(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  const ok = await cancelScheduled(ctx.tenantId, id);
  if (!ok) return NextResponse.json({ error: 'Not found or already sent.' }, { status: 404 });
  return NextResponse.json({ canceled: true });
}
