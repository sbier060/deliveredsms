import { NextRequest } from 'next/server';
import { withApiKey } from '@/lib/api/auth';
import { apiList } from '@/lib/api/response';
import { listSuppressions } from '@/lib/api/opt-out';
import type { ApiContext } from '@/lib/api/types';

export const runtime = 'nodejs';
export const maxDuration = 15;

/** The tenant's current suppression list (numbers that revoked consent). */
export const GET = withApiKey(async (req: NextRequest, ctx: ApiContext) => {
  const url = req.nextUrl;
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 25));
  const page = await listSuppressions(ctx.tenantId, {
    limit,
    cursor: url.searchParams.get('cursor'),
  });
  return apiList(
    page.data.map((row) => ({
      object: 'consent',
      phone: `+1${row.phone}`,
      status: 'opted_out',
      updated_at: new Date(row.at).toISOString(),
      via: row.via,
      ...(row.method ? { method: row.method } : {}),
      ...(row.keyword ? { detected: row.keyword } : {}),
      ...(row.confidence !== undefined ? { confidence: row.confidence } : {}),
    })),
    page.hasMore,
    page.nextCursor
  );
});
