import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/api/console-auth';
import { listSuppressions } from '@/lib/api/opt-out';
import { toCsv } from '@/lib/csv';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Console download of the suppression list - same columns as /v1/consent/export. */
export async function GET(req: NextRequest) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') {
    return NextResponse.json({ error: ctx }, { status: ctx === 'unauthorized' ? 401 : ctx === 'forbidden' ? 403 : 404 });
  }

  const rows: string[][] = [['phone', 'status', 'updated_at', 'via', 'method', 'detected']];
  let cursor: string | null = null;
  do {
    const page = await listSuppressions(ctx.tenantId, { limit: 500, cursor });
    for (const r of page.data) {
      rows.push([
        `+1${r.phone}`,
        'opted_out',
        new Date(r.at).toISOString(),
        r.via,
        r.method || '',
        r.keyword || '',
      ]);
    }
    cursor = page.hasMore ? page.nextCursor : null;
  } while (cursor);

  return new NextResponse(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="delivered-consent.csv"',
    },
  });
}
