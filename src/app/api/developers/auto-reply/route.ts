import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/api/console-auth';
import { normalizeE164, digits10 } from '@/lib/api/phone';
import { getAutoReply, setAutoReply, AUTO_REPLY_MAX_LENGTH, type OfficeHours } from '@/lib/api/auto-reply';

export const runtime = 'nodejs';
export const maxDuration = 15;

const err = (ctx: string) =>
  NextResponse.json({ error: ctx }, { status: ctx === 'unauthorized' ? 401 : ctx === 'forbidden' ? 403 : 404 });

export async function GET(req: NextRequest) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') return err(ctx);
  const number = normalizeE164(req.nextUrl.searchParams.get('number'));
  if (!number) return NextResponse.json({ error: 'number required' }, { status: 400 });
  return NextResponse.json({ config: await getAutoReply(ctx.tenantId, number) });
}

export async function PUT(req: NextRequest) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') return err(ctx);

  const raw = (await req.json().catch(() => ({}))) as {
    number?: unknown;
    enabled?: unknown;
    message?: unknown;
    officeHours?: unknown;
  };
  const number = normalizeE164(raw.number);
  if (!number) return NextResponse.json({ error: '`number` must be valid.' }, { status: 400 });
  if (!ctx.tenant.numbers?.[digits10(number)] || ctx.tenant.numbers[digits10(number)].releasedAt) {
    return NextResponse.json({ error: '`number` must be one of your numbers.' }, { status: 403 });
  }

  const message = typeof raw.message === 'string' ? raw.message.slice(0, AUTO_REPLY_MAX_LENGTH) : '';
  const enabled = raw.enabled === true;
  if (enabled && !message.trim()) {
    return NextResponse.json({ error: 'An enabled auto-reply needs a message.' }, { status: 400 });
  }

  let officeHours: OfficeHours | undefined;
  if (raw.officeHours && typeof raw.officeHours === 'object') {
    const oh = raw.officeHours as Record<string, unknown>;
    const tz = typeof oh.tz === 'string' ? oh.tz : '';
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
    } catch {
      return NextResponse.json({ error: 'officeHours.tz must be a valid IANA zone.' }, { status: 400 });
    }
    const days = Array.isArray(oh.days) ? oh.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6) : [];
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!time.test(String(oh.start)) || !time.test(String(oh.end))) {
      return NextResponse.json({ error: 'officeHours start/end must be HH:MM.' }, { status: 400 });
    }
    officeHours = {
      tz,
      days,
      start: String(oh.start),
      end: String(oh.end),
      mode: oh.mode === 'after_hours' ? 'after_hours' : 'always',
    };
  }

  await setAutoReply(ctx.tenantId, number, { enabled, message, ...(officeHours ? { officeHours } : {}) });
  return NextResponse.json({ saved: true });
}
