import { NextRequest, NextResponse } from 'next/server';
import { withApiKey } from '@/lib/api/auth';
import { listSuppressions } from '@/lib/api/opt-out';
import { toCsv } from '@/lib/csv';
import type { ApiContext } from '@/lib/api/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** The whole suppression list as CSV - the portable audit artifact. */
export const GET = withApiKey(async (_req: NextRequest, ctx: ApiContext) => {
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
});
