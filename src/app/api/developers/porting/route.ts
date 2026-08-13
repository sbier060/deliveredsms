import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/api/console-auth';
import { normalizeE164 } from '@/lib/api/phone';
import { listPortRequests, createPortRequest } from '@/lib/api/porting';

export const runtime = 'nodejs';
export const maxDuration = 15;

const err = (ctx: string) =>
  NextResponse.json({ error: ctx }, { status: ctx === 'unauthorized' ? 401 : ctx === 'forbidden' ? 403 : 404 });

export async function GET(req: NextRequest) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') return err(ctx);
  return NextResponse.json({ requests: await listPortRequests(ctx.tenantId) });
}

/** Admin-only: porting changes what numbers the account owns. */
export async function POST(req: NextRequest) {
  const ctx = await requireTenantContext(req, 'admin');
  if (typeof ctx === 'string') return err(ctx);

  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const number = normalizeE164(raw.number);
  if (!number) return NextResponse.json({ error: '`number` must be a valid US/Canada number.' }, { status: 400 });

  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const currentCarrier = str(raw.currentCarrier, 80);
  const accountNumber = str(raw.accountNumber, 40);
  const pinLast4 = str(raw.pinLast4, 4);
  const authorizedName = str(raw.authorizedName, 120);
  if (!currentCarrier || !accountNumber || !authorizedName) {
    return NextResponse.json(
      { error: 'currentCarrier, accountNumber and authorizedName are required.' },
      { status: 400 }
    );
  }

  const request = await createPortRequest(ctx.tenantId, {
    number,
    currentCarrier,
    accountNumber,
    pinLast4,
    authorizedName,
  });
  return NextResponse.json({ request }, { status: 201 });
}
