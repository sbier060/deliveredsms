import { NextRequest } from 'next/server';
import { withApiKey } from '@/lib/api/auth';
import { apiList } from '@/lib/api/response';
import { listEvents } from '@/lib/api/events';
import type { ApiContext } from '@/lib/api/types';

export const runtime = 'nodejs';
export const maxDuration = 15;

export const GET = withApiKey(async (req: NextRequest, ctx: ApiContext) => {
  const url = req.nextUrl;
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 25));
  const page = await listEvents(ctx.tenantId, {
    limit,
    cursor: url.searchParams.get('cursor'),
    type: url.searchParams.get('type'),
  });
  return apiList(page.data, page.hasMore, page.nextCursor);
});
