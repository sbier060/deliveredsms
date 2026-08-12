import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/console-auth';
import { getTenantIdByUid, getTenant } from '@/lib/api/tenants';
import { getUsageMonth } from '@/lib/api/usage';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantIdByUid(user.uid);
  const tenant = tenantId ? await getTenant(tenantId) : null;
  if (!tenantId || !tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 });

  const monthCount = Math.min(6, Math.max(1, Number(req.nextUrl.searchParams.get('months')) || 3));
  const months: Array<{ month: string; messages: number; lookups: number; requests: number }> = [];
  const now = new Date();
  for (let i = 0; i < monthCount; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const yyyymm = `${d.getUTCFullYear()}${`${d.getUTCMonth() + 1}`.padStart(2, '0')}`;
    const days = await getUsageMonth(tenantId, yyyymm);
    let messages = 0;
    let lookups = 0;
    let requests = 0;
    for (const day of Object.values(days)) {
      messages += (day.messages_sent || 0) + (day.messages_test || 0);
      lookups += day.lookups || 0;
      requests += day.api_requests || 0;
    }
    months.push({
      month: `${d.getUTCFullYear()}-${`${d.getUTCMonth() + 1}`.padStart(2, '0')}`,
      messages,
      lookups,
      requests,
    });
  }
  return NextResponse.json({ months, quotas: tenant.quotas });
}
