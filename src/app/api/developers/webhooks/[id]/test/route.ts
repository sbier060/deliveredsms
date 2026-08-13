import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/console-auth';
import { getTenantIdByUid } from '@/lib/api/tenants';
import { getEndpoint, sendTestEvent } from '@/lib/api/webhooks';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** POST — fire a signed test.ping at the endpoint and report what happened. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantIdByUid(user.uid);
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 404 });
  const endpoint = await getEndpoint(tenantId, params.id);
  if (!endpoint) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const result = await sendTestEvent(tenantId, endpoint);
  return NextResponse.json({ result });
}
