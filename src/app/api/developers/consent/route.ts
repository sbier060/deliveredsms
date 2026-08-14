import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/api/console-auth';
import { listSuppressions, recordOptOut } from '@/lib/api/opt-out';
import { normalizeE164 } from '@/lib/api/phone';

export const runtime = 'nodejs';
export const maxDuration = 30;

function authFail(ctx: string) {
  return NextResponse.json({ error: ctx }, { status: ctx === 'unauthorized' ? 401 : ctx === 'forbidden' ? 403 : 404 });
}

/** Suppression list for the console (first 500, optional digits filter). */
export async function GET(req: NextRequest) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') return authFail(ctx);

  const q = (req.nextUrl.searchParams.get('q') || '').replace(/\D/g, '');
  const rows: Array<Record<string, unknown>> = [];
  let cursor: string | null = null;
  while (rows.length < 500) {
    const page = await listSuppressions(ctx.tenantId, { limit: 500, cursor });
    for (const r of page.data) {
      if (q && !r.phone.includes(q)) continue;
      rows.push({
        phone: `+1${r.phone}`,
        at: r.at,
        via: r.via,
        method: r.method || null,
        detected: r.keyword || null,
        confidence: r.confidence ?? null,
      });
    }
    if (!page.hasMore) break;
    cursor = page.nextCursor;
  }
  return NextResponse.json({ suppressions: rows.slice(0, 500) });
}

/** Console import: paste-a-list of numbers to suppress. */
export async function POST(req: NextRequest) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') return authFail(ctx);

  let body: { phone_numbers?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const list = Array.isArray(body.phone_numbers) ? body.phone_numbers : [];
  if (list.length === 0 || list.length > 500) {
    return NextResponse.json({ error: 'Provide 1-500 phone numbers.' }, { status: 400 });
  }
  let imported = 0;
  const skipped: Array<{ value: string; reason: string }> = [];
  for (const raw of list) {
    const value = typeof raw === 'string' ? raw : String(raw);
    const e164 = normalizeE164(value);
    if (!e164) {
      skipped.push({ value: value.slice(0, 30), reason: 'invalid' });
      continue;
    }
    await recordOptOut(ctx.tenantId, e164, 'import', undefined, { method: 'import' });
    imported += 1;
  }
  return NextResponse.json({ imported, skipped });
}
