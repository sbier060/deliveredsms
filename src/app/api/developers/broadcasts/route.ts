import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/api/console-auth';
import { listBroadcasts, createBroadcast, resolveAudience } from '@/lib/api/broadcasts';
import { normalizeE164, digits10 } from '@/lib/api/phone';

export const runtime = 'nodejs';
export const maxDuration = 60;

const err = (ctx: string) =>
  NextResponse.json({ error: ctx }, { status: ctx === 'unauthorized' ? 401 : ctx === 'forbidden' ? 403 : 404 });

export async function GET(req: NextRequest) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') return err(ctx);

  // ?preview=1&tags=a,b returns the audience size without creating anything.
  if (req.nextUrl.searchParams.get('preview')) {
    const tags = (req.nextUrl.searchParams.get('tags') || '').split(',').map((t) => t.trim()).filter(Boolean);
    const audience = await resolveAudience(ctx.tenantId, { tags });
    return NextResponse.json({ count: audience.length });
  }
  return NextResponse.json({ broadcasts: await listBroadcasts(ctx.tenantId) });
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') return err(ctx);

  const raw = (await req.json().catch(() => ({}))) as {
    name?: unknown;
    body?: unknown;
    from?: unknown;
    tags?: unknown;
    contactIds?: unknown;
    scheduledAt?: unknown;
  };
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 80) : '';
  const body = typeof raw.body === 'string' ? raw.body.slice(0, 1600) : '';
  const from = normalizeE164(raw.from);
  if (!name || !body) return NextResponse.json({ error: 'name and body required' }, { status: 400 });
  if (!from) return NextResponse.json({ error: '`from` must be a valid number.' }, { status: 400 });

  const number = ctx.tenant.numbers?.[digits10(from)];
  if (!number || number.releasedAt) {
    return NextResponse.json({ error: '`from` must be one of your numbers.' }, { status: 403 });
  }

  const tags = Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : [];
  const contactIds = Array.isArray(raw.contactIds)
    ? raw.contactIds.filter((t): t is string => typeof t === 'string')
    : [];
  const scheduledAt = typeof raw.scheduledAt === 'number' ? raw.scheduledAt : undefined;

  const result = await createBroadcast(ctx.tenantId, {
    name,
    body,
    from,
    audience: { ...(tags.length ? { tags } : {}), ...(contactIds.length ? { contactIds } : {}) },
    scheduledAt,
    createdBy: { uid: ctx.user.uid, name: ctx.user.name },
  });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ broadcast: result.broadcast }, { status: 201 });
}
