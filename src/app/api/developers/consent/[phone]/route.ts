import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/api/console-auth';
import { consentStatus, consentHistory, recordOptOut, recordOptIn } from '@/lib/api/opt-out';
import { emitEvent } from '@/lib/api/events';
import { normalizeE164 } from '@/lib/api/phone';

export const runtime = 'nodejs';
export const maxDuration = 15;

function authFail(ctx: string) {
  return NextResponse.json({ error: ctx }, { status: ctx === 'unauthorized' ? 401 : ctx === 'forbidden' ? 403 : 404 });
}

export async function GET(req: NextRequest, { params }: { params: { phone: string } }) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') return authFail(ctx);

  const e164 = normalizeE164(decodeURIComponent(params.phone || ''));
  if (!e164) return NextResponse.json({ error: 'invalid phone' }, { status: 400 });

  const [status, history] = await Promise.all([
    consentStatus(ctx.tenantId, e164),
    consentHistory(ctx.tenantId, e164, 50),
  ]);
  return NextResponse.json({ phone: e164, status, history });
}

/** Console opt-in/opt-out toggle (support workflows). */
export async function POST(req: NextRequest, { params }: { params: { phone: string } }) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') return authFail(ctx);

  const e164 = normalizeE164(decodeURIComponent(params.phone || ''));
  if (!e164) return NextResponse.json({ error: 'invalid phone' }, { status: 400 });

  let body: { status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  if (body.status === 'opted_out') {
    await recordOptOut(ctx.tenantId, e164, 'console', undefined, { method: 'api' });
    await emitEvent(ctx.tenantId, 'message.opted_out', { phone: e164, method: 'api' });
  } else if (body.status === 'opted_in') {
    await recordOptIn(ctx.tenantId, e164, 'console', { method: 'api' });
    await emitEvent(ctx.tenantId, 'message.opted_in', { phone: e164, method: 'api' });
  } else {
    return NextResponse.json({ error: 'status must be opted_out or opted_in' }, { status: 400 });
  }
  return NextResponse.json({ phone: e164, status: body.status });
}
