import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/console-auth';
import { getTenantIdByUid } from '@/lib/api/tenants';
import { revokeKey } from '@/lib/api/keys';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function DELETE(
  req: NextRequest,
  { params }: { params: { keyId: string } }
) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantIdByUid(user.uid);
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 404 });

  const ok = await revokeKey(tenantId, params.keyId);
  if (!ok) return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
